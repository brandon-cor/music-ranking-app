import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// POST /api/parties — create a new party (host flow)
router.post('/', async (req, res) => {
  try {
    const { name, hostName, rating_window_seconds, max_songs, show_scores } = req.body as {
      name: string;
      hostName: string;
      rating_window_seconds?: number;
      max_songs?: number;
      show_scores?: boolean;
    };

    if (!name || !hostName) {
      res.status(400).json({ error: 'name and hostName are required' });
      return;
    }

    // clamp rating window between 15 and 60 seconds
    const window = Math.min(60, Math.max(15, rating_window_seconds ?? 30));

    const party = await prisma.party.create({
      data: {
        name,
        rating_window_seconds: window,
        max_songs: max_songs ?? 20,
        show_scores: show_scores ?? false,
      },
    });

    // create the host user and link back to party
    const host = await prisma.user.create({
      data: { name: hostName, party_id: party.id },
    });

    const updatedParty = await prisma.party.update({
      where: { id: party.id },
      data: { host_id: host.id },
      include: { users: true, songs: true },
    });

    res.json({ party: updatedParty, user: host });
  } catch (error) {
    console.error('POST /api/parties', error);
    res.status(500).json({ error: 'Failed to create party' });
  }
});

// GET /api/parties/:id — get party state
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

    // ended parties are no longer joinable from the URL — only the podium
    // (which uses the results endpoint) can read them.
    if (party.status === 'ended') {
      res.status(410).json({ error: 'This party has ended', code: 'PARTY_ENDED' });
      return;
    }

    // never expose Spotify tokens over the wire
    const { spotify_access_token: _, spotify_refresh_token: __, ...safeParty } = party;
    res.json(safeParty);
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

    res.json({ user });
  } catch (error) {
    console.error('POST /api/parties/:id/join', error);
    res.status(500).json({ error: 'Failed to join party' });
  }
});

// POST /api/parties/:id/songs — add a song to the queue (any user)
router.post('/:id/songs', async (req, res) => {
  try {
    const { spotify_id, title, artist, cover_url, added_by, start_time_ms } = req.body as {
      spotify_id: string;
      title: string;
      artist: string;
      cover_url: string;
      added_by: string;
      start_time_ms?: number;
    };

    const party = await prisma.party.findUnique({
      where: { id: req.params.id },
      include: { songs: true },
    });

    if (!party) {
      res.status(404).json({ error: 'Party not found' });
      return;
    }
    if (party.songs.length >= party.max_songs) {
      res.status(400).json({ error: `Queue is full (max ${party.max_songs} songs)` });
      return;
    }
    // prevent duplicates in the queue
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
        // non-voters contribute 0, so divide by total user count
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
