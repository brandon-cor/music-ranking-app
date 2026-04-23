import { Router } from 'express';
import { prisma } from '../lib/prisma';
import {
  getAuthUrl,
  exchangeCode,
  getToken,
  refreshToken,
  searchTracks,
  playTrack,
} from '../lib/spotify';

const router = Router();

// GET /api/spotify/auth?partyId=xxx — kick off Spotify OAuth for the host
router.get('/auth', (req, res) => {
  const { partyId } = req.query as { partyId: string };
  if (!partyId) {
    res.status(400).json({ error: 'partyId is required' });
    return;
  }
  res.redirect(getAuthUrl(partyId));
});

// GET /api/spotify/callback — Spotify redirects here after user grants access
router.get('/callback', async (req, res) => {
  const { code, state: partyId, error } = req.query as {
    code?: string;
    state?: string;
    error?: string;
  };

  if (error || !code || !partyId) {
    res.redirect(`${process.env.FRONTEND_URL}/?error=spotify_denied`);
    return;
  }

  try {
    const tokens = await exchangeCode(code);

    await prisma.party.update({
      where: { id: partyId },
      data: {
        spotify_access_token: tokens.access_token,
        spotify_refresh_token: tokens.refresh_token,
      },
    });

    res.redirect(`${process.env.FRONTEND_URL}/party/${partyId}/lobby?spotify=connected`);
  } catch (err) {
    console.error('Spotify callback error', err);
    res.redirect(`${process.env.FRONTEND_URL}/?error=spotify_failed`);
  }
});

// GET /api/spotify/token/:partyId — return current access token to the host's frontend
// (needed to initialize the Web Playback SDK)
router.get('/token/:partyId', async (req, res) => {
  try {
    const token = await getToken(req.params.partyId);
    res.json({ token });
  } catch {
    // token missing or expired — try a refresh
    try {
      const token = await refreshToken(req.params.partyId);
      res.json({ token });
    } catch {
      res.status(401).json({ error: 'No Spotify token. Please connect Spotify.' });
    }
  }
});

// GET /api/spotify/search?q=...&partyId=... — search tracks
router.get('/search', async (req, res) => {
  const { q, partyId } = req.query as { q: string; partyId: string };

  if (!q || !partyId) {
    res.status(400).json({ error: 'q and partyId are required' });
    return;
  }

  try {
    let token = await getToken(partyId);
    let tracks;
    try {
      tracks = await searchTracks(q, token);
    } catch (err) {
      if ((err as Error).message === 'SPOTIFY_UNAUTHORIZED') {
        // silently refresh and retry once
        token = await refreshToken(partyId);
        tracks = await searchTracks(q, token);
      } else {
        throw err;
      }
    }
    res.json({ tracks });
  } catch (error) {
    console.error('Spotify search error', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// POST /api/spotify/play — tell Spotify to play a track on the host's browser device
router.post('/play', async (req, res) => {
  const { partyId, spotifyUri, deviceId } = req.body as {
    partyId: string;
    spotifyUri: string;
    deviceId: string;
  };

  if (!partyId || !spotifyUri || !deviceId) {
    res.status(400).json({ error: 'partyId, spotifyUri, and deviceId are required' });
    return;
  }

  try {
    let token = await getToken(partyId);
    try {
      await playTrack(token, spotifyUri, deviceId);
    } catch {
      token = await refreshToken(partyId);
      await playTrack(token, spotifyUri, deviceId);
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('Spotify play error', error);
    res.status(500).json({ error: 'Failed to start playback' });
  }
});

export default router;
