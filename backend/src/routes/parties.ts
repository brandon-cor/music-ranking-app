import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { toSafeParty, toSafeUser } from '../lib/serialize';

const router = Router();

// POST /api/parties — create a new party (host flow). Guests and the host both
// need to sign in with their own Spotify account after creation, so the home
// page no longer exposes rating-window or max-songs knobs; only how many songs
// each user gets to queue.
router.post('/', async (req, res) => {
  try {
    const { name, hostName, songs_per_user } = req.body as {
      name: string;
      hostName: string;
      songs_per_user?: number;
    };

    if (!name || !hostName) {
      res.status(400).json({ error: 'name and hostName are required' });
      return;
    }

    const perUser = Math.min(10, Math.max(1, songs_per_user ?? 3));

    const party = await prisma.party.create({
      data: {
        name,
        rating_window_seconds: 30,
        songs_per_user: perUser,
      },
    });

    const host = await prisma.user.create({
      data: { name: hostName, party_id: party.id },
    });

    const updatedParty = await prisma.party.update({
      where: { id: party.id },
      data: { host_id: host.id },
      include: { users: true, songs: true },
    });

    res.json({ party: toSafeParty(updatedParty), user: toSafeUser(host) });
  } catch (error) {
    console.error('POST /api/parties', error);
    res.status(500).json({ error: 'Failed to create party' });
  }
});

// GET /api/parties/:id — get party state (tokens stripped, spotify_connected flag)
router.get('/:id', async (req, res) => {
  try {
    const party = await prisma.party.findUnique({
      where: { id: req.params.id },
      include: {
        users: true,
        songs: { orderBy: { order: 'asc' } },
      },
    });

    if (!party) {
      res.status(404).json({ error: 'Party not found' });
      return;
    }

    if (party.status === 'ended') {
      res.status(410).json({ error: 'This party has ended', code: 'PARTY_ENDED' });
      return;
    }

    res.json(toSafeParty(party));
  } catch (error) {
    console.error('GET /api/parties/:id', error);
    res.status(500).json({ error: 'Failed to fetch party' });
  }
});

// POST /api/parties/:id/join — join an existing party as a guest
router.post('/:id/join', async (req, res) => {
  try {
    const { name } = req.body as { name: string };

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const party = await prisma.party.findUnique({ where: { id: req.params.id } });
    if (!party) {
      res.status(404).json({ error: 'Party not found' });
      return;
    }
    if (party.status === 'ended') {
      res.status(400).json({ error: 'This party has already ended' });
      return;
    }

    const user = await prisma.user.create({
      data: { name, party_id: party.id },
    });

    res.json({ user: toSafeUser(user) });
  } catch (error) {
    console.error('POST /api/parties/:id/join', error);
    res.status(500).json({ error: 'Failed to join party' });
  }
});

// POST /api/parties/:id/songs — add a song. Each user can queue up to
// `songs_per_user` tracks; we count by added_by_user_id.
router.post('/:id/songs', async (req, res) => {
  try {
    const {
      spotify_id,
      title,
      artist,
      cover_url,
      added_by,
      added_by_user_id,
      start_time_ms,
    } = req.body as {
      spotify_id: string;
      title: string;
      artist: string;
      cover_url: string;
      added_by: string;
      added_by_user_id: string;
      start_time_ms?: number;
    };

    if (!added_by_user_id) {
      res.status(400).json({ error: 'added_by_user_id is required' });
      return;
    }

    const party = await prisma.party.findUnique({
      where: { id: req.params.id },
      include: { songs: true },
    });

    if (!party) {
      res.status(404).json({ error: 'Party not found' });
      return;
    }

    const usersOwnCount = party.songs.filter((s) => s.added_by_user_id === added_by_user_id).length;
    if (usersOwnCount >= party.songs_per_user) {
      res.status(400).json({
        error: `You've used all ${party.songs_per_user} of your picks`,
      });
      return;
    }

    const alreadyQueued = party.songs.some((s) => s.spotify_id === spotify_id);
    if (alreadyQueued) {
      res.status(400).json({ error: 'This song is already in the queue' });
      return;
    }

    const song = await prisma.song.create({
      data: {
        party_id: party.id,
        spotify_id,
        title,
        artist,
        cover_url,
        added_by,
        added_by_user_id,
        order: party.songs.length,
        start_time_ms: start_time_ms ?? 0,
      },
    });

    res.json({ song });
  } catch (error) {
    console.error('POST /api/parties/:id/songs', error);
    res.status(500).json({ error: 'Failed to add song' });
  }
});

// GET /api/parties/:id/results — final ranked results (only meaningful after party ends)
router.get('/:id/results', async (req, res) => {
  try {
    const party = await prisma.party.findUnique({
      where: { id: req.params.id },
      include: { users: true },
    });

    if (!party) {
      res.status(404).json({ error: 'Party not found' });
      return;
    }

    const userCount = party.users.length || 1;

    const songs = await prisma.song.findMany({
      where: { party_id: party.id },
      include: { ratings: true },
      orderBy: { order: 'asc' },
    });

    const results = songs
      .map((song) => {
        const totalScore = song.ratings.reduce((sum, r) => sum + r.score, 0);
        const avgScore = totalScore / userCount;
        const firstVote =
          song.ratings.length > 0
            ? song.ratings.reduce((earliest, r) =>
                r.voted_at < earliest ? r.voted_at : earliest,
              song.ratings[0].voted_at)
            : null;

        return { ...song, avgScore, firstVote };
      })
      .sort((a, b) => {
        if (Math.abs(b.avgScore - a.avgScore) > 0.001) return b.avgScore - a.avgScore;
        const aFire = a.ratings.filter((r) => r.score === 5).length;
        const bFire = b.ratings.filter((r) => r.score === 5).length;
        if (bFire !== aFire) return bFire - aFire;
        if (a.firstVote && b.firstVote) {
          return new Date(a.firstVote).getTime() - new Date(b.firstVote).getTime();
        }
        return 0;
      });

    res.json({ results });
  } catch (error) {
    console.error('GET /api/parties/:id/results', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

export default router;
