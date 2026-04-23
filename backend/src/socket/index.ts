import { Server, Socket } from 'socket.io';
import { prisma } from '../lib/prisma';

// one timer per party — tracks the active rating window
const ratingTimers = new Map<string, ReturnType<typeof setTimeout>>();

// grace period for host reconnects (page refresh / quick nav). if the host
// doesn't come back within this window, the party is considered abandoned.
const HOST_DISCONNECT_GRACE_MS = 5000;
const hostGraceTimers = new Map<string, ReturnType<typeof setTimeout>>();

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

      // tell everyone else someone joined
      socket.to(`party:${partyId}`).emit('user:joined', { user });

      // send the joining client the current party snapshot
      const { spotify_access_token: _, spotify_refresh_token: __, ...safeParty } = party;
      socket.emit('party:state', safeParty);
    });

    // party:start — host starts the party, broadcast to all guests in lobby
    socket.on('party:start', async ({ partyId: pid }: { partyId: string }) => {
      const { userId } = socket.data as { userId: string };
      const p = await prisma.party.findUnique({ where: { id: pid } });
      if (!p || p.host_id !== userId) return;

      await prisma.party.update({ where: { id: pid }, data: { status: 'playing' } });
      // tell everyone in the room (host navigates themselves on the client)
      socket.to(`party:${pid}`).emit('party:start');
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
    });

    // rating:open — host opens the rating window; server owns the timer
    socket.on('rating:open', async ({ songId }: { songId: string }) => {
      const { partyId, userId } = socket.data as { partyId: string; userId: string };
      if (!partyId || !userId) return;

      const party = await prisma.party.findUnique({ where: { id: partyId } });
      if (!party || party.host_id !== userId) return;

      // cancel any existing timer for this party (shouldn't happen but be safe)
      const existing = ratingTimers.get(partyId);
      if (existing) clearTimeout(existing);

      const durationMs = party.rating_window_seconds * 1000;
      const endsAt = Date.now() + durationMs;

      io.to(`party:${partyId}`).emit('rating:open', {
        songId,
        endsAt,
        duration: party.rating_window_seconds,
      });

      // auto-close when time runs out
      const timer = setTimeout(async () => {
        ratingTimers.delete(partyId);

        // calculate interim results if show_scores is on
        let scores: { songId: string; avgScore: number; voteCount: number } | null = null;
        if (party.show_scores) {
          scores = await getSongScores(partyId, songId);
        }

        io.to(`party:${partyId}`).emit('rating:close', { songId, scores });
      }, durationMs);

      ratingTimers.set(partyId, timer);
    });

    // rating:submit — user submits their score for the current song
    socket.on(
      'rating:submit',
      async ({ songId, score }: { songId: string; score: number }) => {
        const { partyId, userId } = socket.data as { partyId: string; userId: string };
        if (!partyId || !userId) return;

        // clamp score to 0–100
        const clampedScore = Math.min(100, Math.max(0, Math.round(score)));

        try {
          const rating = await prisma.rating.upsert({
            where: { song_id_user_id: { song_id: songId, user_id: userId } },
            update: { score: clampedScore, voted_at: new Date() },
            create: { song_id: songId, user_id: userId, score: clampedScore },
          });

          // only the submitter gets the confirmation
          socket.emit('rating:confirmed', { rating });

          // broadcast vote count so everyone can see the tally
          const voteCount = await prisma.rating.count({ where: { song_id: songId } });
          io.to(`party:${partyId}`).emit('rating:tally', { songId, voteCount });
        } catch (error) {
          console.error('rating:submit error', error);
        }
      },
    );

    // party:end — host ends the party and triggers the podium reveal
    socket.on('party:end', async () => {
      const { partyId, userId } = socket.data as { partyId: string; userId: string };
      if (!partyId || !userId) return;

      const party = await prisma.party.findUnique({
        where: { id: partyId },
        include: { users: true },
      });
      if (!party || party.host_id !== userId) return;

      // clear any active timer
      const timer = ratingTimers.get(partyId);
      if (timer) {
        clearTimeout(timer);
        ratingTimers.delete(partyId);
      }

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

          // clean up rating timer if one was running
          const ratingTimer = ratingTimers.get(partyId);
          if (ratingTimer) {
            clearTimeout(ratingTimer);
            ratingTimers.delete(partyId);
          }

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
