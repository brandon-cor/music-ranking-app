// Spotify REST routes. Auth/tokens are per-user; playback routes take a userId
// so the caller can be either the host (main playback) or a guest (clip preview).
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import {
  getAuthUrl,
  parseAuthState,
  exchangeCode,
  getToken,
  refreshToken,
  searchTracks,
  playTrack,
  transferPlayback,
  accessTokenExpiresAt,
} from '../lib/spotify';

const router = Router();

// GET /api/spotify/auth?userId=xxx&partyId=yyy — kick off OAuth for a given user
router.get('/auth', (req, res) => {
  const { userId, partyId } = req.query as { userId?: string; partyId?: string };
  if (!userId || !partyId) {
    res.status(400).json({ error: 'userId and partyId are required' });
    return;
  }
  res.redirect(getAuthUrl(userId, partyId));
});

// GET /api/spotify/callback — Spotify redirects here after user grants access
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query as {
    code?: string;
    state?: string;
    error?: string;
  };

  if (error || !code || !state) {
    res.redirect(`${process.env.FRONTEND_URL}/?error=spotify_denied`);
    return;
  }

  const parsed = parseAuthState(state);
  if (!parsed) {
    res.redirect(`${process.env.FRONTEND_URL}/?error=spotify_bad_state`);
    return;
  }
  const { userId, partyId } = parsed;

  try {
    const tokens = await exchangeCode(code);

    await prisma.user.update({
      where: { id: userId },
      data: {
        spotify_access_token: tokens.access_token,
        spotify_refresh_token: tokens.refresh_token,
        spotify_token_expires_at: accessTokenExpiresAt(tokens.expires_in),
      },
    });

    res.redirect(`${process.env.FRONTEND_URL}/party/${partyId}/lobby?spotify=connected`);
  } catch (err) {
    console.error('Spotify callback error', err);
    res.redirect(`${process.env.FRONTEND_URL}/?error=spotify_failed`);
  }
});

// GET /api/spotify/token/:userId — return the user's current access token (needed
// to initialize the Web Playback SDK in their own browser).
router.get('/token/:userId', async (req, res) => {
  try {
    const token = await getToken(req.params.userId);
    res.json({ token });
  } catch {
    try {
      const token = await refreshToken(req.params.userId);
      res.json({ token });
    } catch {
      res.status(401).json({ error: 'No Spotify token. Please connect Spotify.' });
    }
  }
});

// GET /api/spotify/search?q=...&partyId=... — search via the party host's token
// so guests without their own premium still see results (they still need their
// own premium auth to actually stream/preview).
router.get('/search', async (req, res) => {
  const { q, partyId } = req.query as { q: string; partyId: string };

  if (!q || !partyId) {
    res.status(400).json({ error: 'q and partyId are required' });
    return;
  }

  try {
    const party = await prisma.party.findUnique({ where: { id: partyId } });
    if (!party?.host_id) {
      res.status(400).json({ error: 'Party has no host' });
      return;
    }
    const hostId = party.host_id;

    let token = await getToken(hostId);
    let tracks;
    try {
      tracks = await searchTracks(q, token);
    } catch (err) {
      if ((err as Error).message === 'SPOTIFY_UNAUTHORIZED') {
        token = await refreshToken(hostId);
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

// POST /api/spotify/play — stream a track on the caller's own device. The
// caller's userId determines which Spotify account + token is used; host uses
// this for party playback, guests use it for clip previews.
router.post('/play', async (req, res) => {
  const { userId, spotifyUri, deviceId, positionMs } = req.body as {
    userId: string;
    spotifyUri: string;
    deviceId: string;
    positionMs?: number;
  };

  if (!userId || !spotifyUri || !deviceId) {
    res.status(400).json({ error: 'userId, spotifyUri, and deviceId are required' });
    return;
  }

  try {
    let token = await getToken(userId);
    const startMs = positionMs ?? 0;

    const transferAndPlay = async (t: string) => {
      await transferPlayback(t, deviceId);
      await playTrack(t, spotifyUri, deviceId, startMs);
    };

    try {
      await transferAndPlay(token);
    } catch {
      token = await refreshToken(userId);
      await transferAndPlay(token);
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('Spotify play error', error);
    res.status(500).json({ error: 'Failed to start playback' });
  }
});

export default router;
