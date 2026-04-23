import { Server, Socket } from 'socket.io';
import { prisma } from '../lib/prisma';
import { toSafeParty, toSafeUser } from '../lib/serialize';

interface ActiveRatingTimer {
  timer: ReturnType<typeof setTimeout>;
  songId: string;
  endsAt: number;
  /** Full-window duration in ms (for client ring math). */
  durationMs: number;
  showScores: boolean;
}

interface PausedRating {
  songId: string;
  remainingMs: number;
  durationMs: number;
  showScores: boolean;
}

// one timer per party — tracks the active rating window
const ratingTimers = new Map<string, ActiveRatingTimer>();
// host paused playback: timer cleared, remaining time stored until resume
const pausedRatings = new Map<string, PausedRating>();
// prevents duplicate rating:close when the last two votes land in the same tick
const ratingFinalizedKeys = new Set<string>();

// grace period for host reconnects (page refresh / quick nav). if the host
// doesn't come back within this window, the party is considered abandoned.
const HOST_DISCONNECT_GRACE_MS = 5000;
const hostGraceTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Host first, then other members sorted by id (stable round-robin order). */
function sortUsersForRoundRobin(party: { host_id: string | null }, users: { id: string }[]) {
  if (!party.host_id) {
    return [...users].sort((a, b) => a.id.localeCompare(b.id));
  }
  const host = users.find((u) => u.id === party.host_id);
  const rest = users
    .filter((u) => u.id !== party.host_id)
    .sort((a, b) => a.id.localeCompare(b.id));
  return host ? [host, ...rest] : [...users].sort((a, b) => a.id.localeCompare(b.id));
}

/** Interleave songs by user (round 1 pick from each, round 2, …). */
function interleaveByUser<T extends { added_by_user_id: string | null }>(
  users: { id: string }[],
  songs: T[],
): T[] {
  const groups = users.map((u) => songs.filter((s) => s.added_by_user_id === u.id));
  const orphans = songs.filter(
    (s) => !s.added_by_user_id || !users.some((u) => u.id === s.added_by_user_id),
  );
  const maxLen = Math.max(0, ...groups.map((g) => g.length));
  const out: T[] = [];
  for (let i = 0; i < maxLen; i++) {
    for (const g of groups) {
      if (i < g.length) out.push(g[i]);
    }
  }
  return [...out, ...orphans];
}

async function startParty(io: Server, partyId: string) {
  const party = await prisma.party.findUnique({
    where: { id: partyId },
    include: {
      users: true,
      songs: { orderBy: { order: 'asc' } },
    },
  });
  if (!party || party.status !== 'lobby') return;
  if (party.songs.length < 1) return;

  const usersOrdered = sortUsersForRoundRobin(party, party.users);
  const interleaved = interleaveByUser(usersOrdered, party.songs);

  await prisma.$transaction(
    interleaved.map((s, i) =>
      prisma.song.update({ where: { id: s.id }, data: { order: i } }),
    ),
  );
  await prisma.user.updateMany({ where: { party_id: partyId }, data: { is_ready: false } });
  await prisma.party.update({ where: { id: partyId }, data: { status: 'playing' } });

  const updated = await prisma.party.findUnique({
    where: { id: partyId },
    include: {
      users: { orderBy: { id: 'asc' } },
      songs: { orderBy: { order: 'asc' } },
    },
  });
  if (updated) {
    io.in(`party:${partyId}`).emit('party:state', toSafeParty(updated));
    io.in(`party:${partyId}`).emit('party:start');
  }
}

async function maybeAutoStart(io: Server, partyId: string) {
  const party = await prisma.party.findUnique({
    where: { id: partyId },
    include: { users: true, songs: true },
  });
  if (!party || party.status !== 'lobby') return;
  if (party.songs.length < 1) return;
  if (!party.users.every((u) => u.is_ready)) return;
  const host = party.users.find((u) => u.id === party.host_id);
  if (!host?.spotify_access_token) return;
  await startParty(io, partyId);
}

function clearRatingTimer(partyId: string) {
  const existing = ratingTimers.get(partyId);
  if (existing) clearTimeout(existing.timer);
  ratingTimers.delete(partyId);
}

function clearPausedRating(partyId: string) {
  pausedRatings.delete(partyId);
}

/** Opens the rating window and starts the server-side timer for this song. */
function openRatingWindow(
  io: Server,
  partyId: string,
  songId: string,
  durationSec: number,
  showScores: boolean,
) {
  ratingFinalizedKeys.delete(`${partyId}:${songId}`);
  clearRatingTimer(partyId);
  clearPausedRating(partyId);

  const durationMs = durationSec * 1000;
  const endsAt = Date.now() + durationMs;

  io.to(`party:${partyId}`).emit('rating:open', {
    songId,
    endsAt,
    duration: durationSec,
  });

  const timer = setTimeout(() => {
    void finalizeRatingWindow(io, partyId, songId, showScores);
  }, durationMs);

  ratingTimers.set(partyId, { timer, songId, endsAt, durationMs, showScores });
}

/** Ends the rating window for one song: clears timer, emits rating:close once per song. */
async function finalizeRatingWindow(
  io: Server,
  partyId: string,
  songId: string,
  showScores: boolean,
) {
  const dedupeKey = `${partyId}:${songId}`;
  if (ratingFinalizedKeys.has(dedupeKey)) return;
  ratingFinalizedKeys.add(dedupeKey);
  clearRatingTimer(partyId);
  clearPausedRating(partyId);

  let scores: { songId: string; avgScore: number; voteCount: number } | null = null;
  if (showScores) {
    scores = await getSongScores(partyId, songId);
  }
  io.to(`party:${partyId}`).emit('rating:close', { songId, scores });
}

export function setupSocket(io: Server) {
  io.on('connection', (socket: Socket) => {
    // party:join — user joins a party room and receives current state
    socket.on('party:join', async ({ partyId, userId }: { partyId: string; userId: string }) => {
      socket.join(`party:${partyId}`);
      socket.data.partyId = partyId;
      socket.data.userId = userId;

      const [party, user] = await Promise.all([
        prisma.party.findUnique({
          where: { id: partyId },
          include: {
            users: true,
            songs: { orderBy: { order: 'asc' } },
          },
        }),
        prisma.user.findUnique({ where: { id: userId } }),
      ]);

      if (!party || !user) {
        socket.emit('party:not_found');
        return;
      }

      // party already closed (host abandoned or explicitly ended) — kick the user
      if (party.status === 'ended') {
        socket.emit('party:closed', { reason: 'ended' });
        return;
      }

      // host is rejoining within the grace window — cancel the pending end
      if (party.host_id === userId) {
        const pending = hostGraceTimers.get(partyId);
        if (pending) {
          clearTimeout(pending);
          hostGraceTimers.delete(partyId);
        }
      }

      socket.to(`party:${partyId}`).emit('user:joined', { user: toSafeUser(user) });

      socket.emit('party:state', toSafeParty(party));
      void maybeAutoStart(io, partyId);
    });

    // user:spotify_connected — the caller just finished OAuth; tell the room
    // so everyone can see their "connected" flag update; auto-start may run
    // when everyone is ready and the queue has songs.
    socket.on('user:spotify_connected', async () => {
      const { partyId, userId } = socket.data as { partyId?: string; userId?: string };
      if (!partyId || !userId) return;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return;
      io.to(`party:${partyId}`).emit('user:updated', { user: toSafeUser(user) });
      await maybeAutoStart(io, partyId);
    });

    socket.on('user:ready', async ({ ready }: { ready: boolean }) => {
      const { partyId, userId } = socket.data as { partyId?: string; userId?: string };
      if (!partyId || !userId) return;
      const user = await prisma.user.update({
        where: { id: userId },
        data: { is_ready: !!ready },
      });
      io.to(`party:${partyId}`).emit('user:updated', { user: toSafeUser(user) });
      await maybeAutoStart(io, partyId);
    });

    // party:start — host-only manual start (same reorder + broadcast as auto-start)
    socket.on('party:start', async ({ partyId: pid }: { partyId: string }) => {
      const { userId } = socket.data as { userId: string };
      const p = await prisma.party.findUnique({ where: { id: pid } });
      if (!p || p.host_id !== userId) return;
      await startParty(io, pid);
    });

    // song:play — host starts the next song
    socket.on('song:play', async ({ songId }: { songId: string }) => {
      const { partyId, userId } = socket.data as { partyId: string; userId: string };
      if (!partyId || !userId) return;

      const party = await prisma.party.findUnique({ where: { id: partyId } });
      if (!party || party.host_id !== userId) return;

      const song = await prisma.song.findUnique({ where: { id: songId } });
      if (!song) return;

      await prisma.party.update({
        where: { id: partyId },
        data: { current_song_id: songId, status: 'playing' },
      });

      // broadcast to everyone in the room (including the host)
      io.to(`party:${partyId}`).emit('song:play', { song });

      openRatingWindow(
        io,
        partyId,
        songId,
        party.rating_window_seconds,
        party.show_scores,
      );
    });

    // rating:open — host can still open manually; server owns the timer (same as auto-open)
    socket.on('rating:open', async ({ songId }: { songId: string }) => {
      const { partyId, userId } = socket.data as { partyId: string; userId: string };
      if (!partyId || !userId) return;

      const party = await prisma.party.findUnique({ where: { id: partyId } });
      if (!party || party.host_id !== userId) return;

      openRatingWindow(
        io,
        partyId,
        songId,
        party.rating_window_seconds,
        party.show_scores,
      );
    });

    // song:pause — host paused Spotify during rating; freeze server timer + broadcast
    socket.on('song:pause', async () => {
      const { partyId, userId } = socket.data as { partyId: string; userId: string };
      if (!partyId || !userId) return;

      const active = ratingTimers.get(partyId);
      if (!active) return;

      const party = await prisma.party.findUnique({ where: { id: partyId } });
      if (!party || party.host_id !== userId) return;

      const remainingMs = Math.max(0, active.endsAt - Date.now());
      clearTimeout(active.timer);
      ratingTimers.delete(partyId);

      pausedRatings.set(partyId, {
        songId: active.songId,
        remainingMs,
        durationMs: active.durationMs,
        showScores: active.showScores,
      });

      io.to(`party:${partyId}`).emit('rating:pause', {
        songId: active.songId,
        remainingMs,
      });
    });

    // song:resume — host resumed playback; restart timer from remaining ms
    socket.on('song:resume', async () => {
      const { partyId, userId } = socket.data as { partyId: string; userId: string };
      if (!partyId || !userId) return;

      const paused = pausedRatings.get(partyId);
      if (!paused) return;

      const party = await prisma.party.findUnique({ where: { id: partyId } });
      if (!party || party.host_id !== userId) return;

      const { songId, remainingMs, durationMs, showScores } = paused;
      pausedRatings.delete(partyId);

      if (remainingMs <= 0) {
        await finalizeRatingWindow(io, partyId, songId, showScores);
        return;
      }

      const endsAt = Date.now() + remainingMs;
      const timer = setTimeout(() => {
        void finalizeRatingWindow(io, partyId, songId, showScores);
      }, remainingMs);

      ratingTimers.set(partyId, { timer, songId, endsAt, durationMs, showScores });

      io.to(`party:${partyId}`).emit('rating:resume', {
        songId,
        endsAt,
        durationMs,
      });
    });

    // song:skip — host ends the rating window early (same payload as timer close)
    socket.on('song:skip', async () => {
      const { partyId, userId } = socket.data as { partyId: string; userId: string };
      if (!partyId || !userId) return;

      if (!ratingTimers.has(partyId) && !pausedRatings.has(partyId)) return;

      const party = await prisma.party.findUnique({ where: { id: partyId } });
      if (!party || party.host_id !== userId) return;

      const songId = party.current_song_id;
      if (!songId) return;

      await finalizeRatingWindow(io, partyId, songId, party.show_scores);
    });

    // rating:submit — user submits their score for the current song
    socket.on(
      'rating:submit',
      async ({ songId, score }: { songId: string; score: number }) => {
        const { partyId, userId } = socket.data as { partyId: string; userId: string };
        if (!partyId || !userId) return;

        // clamp score to 1–5 (emoji ratings: skull / woah / fire)
        const clampedScore = Math.min(5, Math.max(1, Math.round(score)));

        try {
          const rating = await prisma.rating.upsert({
            where: { song_id_user_id: { song_id: songId, user_id: userId } },
            update: { score: clampedScore, voted_at: new Date() },
            create: { song_id: songId, user_id: userId, score: clampedScore },
          });

          // only the submitter gets the confirmation
          socket.emit('rating:confirmed', { rating });

          // broadcast vote count and who has voted so clients can show per-user checks
          const ratingsRows = await prisma.rating.findMany({
            where: { song_id: songId },
            select: { user_id: true },
          });
          const voteCount = ratingsRows.length;
          const votedUserIds = ratingsRows.map((r) => r.user_id);
          io.to(`party:${partyId}`).emit('rating:tally', { songId, voteCount, votedUserIds });

          const partyFull = await prisma.party.findUnique({
            where: { id: partyId },
            include: { users: true },
          });
          if (
            partyFull &&
            partyFull.users.length > 0 &&
            voteCount >= partyFull.users.length
          ) {
            await finalizeRatingWindow(io, partyId, songId, partyFull.show_scores);
          }
        } catch (error) {
          console.error('rating:submit error', error);
        }
      },
    );

    // party:abandon — host navigated away from /play without formally ending the party.
    // Ends the session immediately and notifies all guests (but not the departing host socket).
    socket.on('party:abandon', async () => {
      const { partyId, userId } = socket.data as { partyId: string; userId: string };
      if (!partyId || !userId) return;

      const party = await prisma.party.findUnique({ where: { id: partyId } });
      if (!party || party.host_id !== userId) return;

      clearRatingTimer(partyId);
      clearPausedRating(partyId);

      await prisma.party.update({ where: { id: partyId }, data: { status: 'ended' } });

      // broadcast only to guests — the host is already leaving
      socket.to(`party:${partyId}`).emit('party:closed', { reason: 'host_left' });
    });

    // party:end — host ends the party and triggers the podium reveal
    socket.on('party:end', async () => {
      const { partyId, userId } = socket.data as { partyId: string; userId: string };
      if (!partyId || !userId) return;

      const party = await prisma.party.findUnique({
        where: { id: partyId },
        include: { users: true },
      });
      if (!party || party.host_id !== userId) return;

      clearRatingTimer(partyId);
      clearPausedRating(partyId);

      await prisma.party.update({ where: { id: partyId }, data: { status: 'ended' } });

      const results = await getPartyResults(partyId, party.users.length);
      io.to(`party:${partyId}`).emit('party:end', { results });
    });

    socket.on('disconnect', async () => {
      const { partyId, userId } = socket.data as { partyId?: string; userId?: string };
      if (!partyId || !userId) return;

      io.to(`party:${partyId}`).emit('user:left', { userId });

      // if the disconnecting user is the host, start a grace timer.
      // if they don't reconnect in time, the party is closed for everyone.
      try {
        const party = await prisma.party.findUnique({ where: { id: partyId } });
        if (!party || party.status === 'ended' || party.host_id !== userId) return;

        // if the host has another open socket in this room, no need to end yet
        const remaining = await io.in(`party:${partyId}`).fetchSockets();
        const hostStillConnected = remaining.some(
          (s) => s.id !== socket.id && s.data?.userId === userId,
        );
        if (hostStillConnected) return;

        // already a pending grace timer — leave it alone
        if (hostGraceTimers.has(partyId)) return;

        const timer = setTimeout(async () => {
          hostGraceTimers.delete(partyId);

          // double-check the host hasn't returned in the meantime
          const stillEmpty = await io.in(`party:${partyId}`).fetchSockets();
          const hostBack = stillEmpty.some((s) => s.data?.userId === userId);
          if (hostBack) return;

          clearRatingTimer(partyId);
          clearPausedRating(partyId);

          await prisma.party.update({
            where: { id: partyId },
            data: { status: 'ended' },
          });

          io.to(`party:${partyId}`).emit('party:closed', { reason: 'host_left' });
        }, HOST_DISCONNECT_GRACE_MS);

        hostGraceTimers.set(partyId, timer);
      } catch (error) {
        console.error('disconnect handler error', error);
      }
    });
  });
}

// compute the ranked results for a party (non-voters count as 0)
async function getPartyResults(partyId: string, userCount: number) {
  const songs = await prisma.song.findMany({
    where: { party_id: partyId },
    include: { ratings: true },
    orderBy: { order: 'asc' },
  });

  const count = userCount || 1;

  return songs
    .map((song) => {
      const totalScore = song.ratings.reduce((sum, r) => sum + r.score, 0);
      const avgScore = totalScore / count;
      const firstVote =
        song.ratings.length > 0
          ? song.ratings.reduce((earliest, r) =>
              r.voted_at < earliest ? r.voted_at : earliest,
            song.ratings[0].voted_at)
          : null;
      return { ...song, avgScore: Math.round(avgScore * 10) / 10, firstVote };
    })
    .sort((a, b) => {
      if (Math.abs(b.avgScore - a.avgScore) > 0.01) return b.avgScore - a.avgScore;
      const aFire = a.ratings.filter((r) => r.score === 5).length;
      const bFire = b.ratings.filter((r) => r.score === 5).length;
      if (bFire !== aFire) return bFire - aFire;
      if (a.firstVote && b.firstVote) {
        return new Date(a.firstVote).getTime() - new Date(b.firstVote).getTime();
      }
      return 0;
    });
}

// score snapshot for a single song (used for mid-party show_scores)
async function getSongScores(partyId: string, songId: string) {
  const party = await prisma.party.findUnique({ where: { id: partyId }, include: { users: true } });
  const count = party?.users.length || 1;
  const ratings = await prisma.rating.findMany({ where: { song_id: songId } });
  const total = ratings.reduce((sum, r) => sum + r.score, 0);
  return { songId, avgScore: Math.round((total / count) * 10) / 10, voteCount: ratings.length };
}
