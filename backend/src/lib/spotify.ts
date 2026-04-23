// Spotify OAuth + Web API helpers. Tokens are stored per-user (each user, host
// or guest, signs in with their own Spotify Premium account so they can stream
// clip previews on their own browser device).
import { prisma } from './prisma';

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

/** Refresh before Spotify rejects the token (access tokens last ~1h). */
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

/** Compute absolute expiry from Spotify's `expires_in` (seconds). */
export function accessTokenExpiresAt(expiresInSeconds: number): Date {
  return new Date(Date.now() + expiresInSeconds * 1000);
}

function tokenNeedsRefresh(expiresAt: Date | null): boolean {
  if (expiresAt === null) return true;
  return expiresAt.getTime() - TOKEN_EXPIRY_BUFFER_MS <= Date.now();
}

/** Build the Spotify OAuth authorize URL; state carries both userId and partyId. */
export function getAuthUrl(userId: string, partyId: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    scope: [
      'streaming',
      'user-read-email',
      'user-read-private',
      'user-read-playback-state',
      'user-modify-playback-state',
    ].join(' '),
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    state: `${userId}:${partyId}`,
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/** Parse the state value we packed in getAuthUrl back into its parts. */
export function parseAuthState(state: string): { userId: string; partyId: string } | null {
  const [userId, partyId] = state.split(':');
  if (!userId || !partyId) return null;
  return { userId, partyId };
}

export async function exchangeCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const creds = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
  ).toString('base64');
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    }),
  });
  if (!res.ok) throw new Error('Failed to exchange Spotify code');
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}

/** Refresh the access token for a given user, using their stored refresh token. */
export async function refreshToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.spotify_refresh_token) throw new Error('No refresh token stored for this user');

  const creds = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
  ).toString('base64');
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: user.spotify_refresh_token,
    }),
  });
  if (!res.ok) throw new Error('Failed to refresh Spotify token');
  const data = (await res.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
  };

  const expiresInSeconds = data.expires_in ?? 3600;
  const updateData: {
    spotify_access_token: string;
    spotify_token_expires_at: Date;
    spotify_refresh_token?: string;
  } = {
    spotify_access_token: data.access_token,
    spotify_token_expires_at: accessTokenExpiresAt(expiresInSeconds),
  };
  if (data.refresh_token) {
    updateData.spotify_refresh_token = data.refresh_token;
  }

  await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });
  return data.access_token;
}

/**
 * Returns a valid access token. Throws if missing or due for refresh so callers
 * can fall back to `refreshToken`.
 */
export async function getToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.spotify_access_token) throw new Error('No Spotify token for this user');
  if (tokenNeedsRefresh(user.spotify_token_expires_at)) {
    throw new Error('Spotify token expired or stale');
  }
  return user.spotify_access_token;
}

export async function searchTracks(query: string, token: string) {
  const url = `${SPOTIFY_API_BASE}/search?q=${encodeURIComponent(query)}&type=track&limit=10`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new Error('SPOTIFY_UNAUTHORIZED');
  if (!res.ok) throw new Error('Spotify search failed');
  const data = (await res.json()) as { tracks: { items: SpotifyTrack[] } };
  return data.tracks.items;
}

/** Move playback to the Web Playback SDK device before starting a track (often required for play to work). */
export async function transferPlayback(token: string, deviceId: string): Promise<void> {
  const res = await fetch(`${SPOTIFY_API_BASE}/me/player`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ device_ids: [deviceId], play: false }),
  });
  if (res.ok || res.status === 204) return;
  const body = await res.text().catch(() => '');
  throw new Error(`Spotify transfer ${res.status}: ${body}`);
}

export async function playTrack(
  token: string,
  spotifyUri: string,
  deviceId: string,
  positionMs = 0,
) {
  const res = await fetch(`${SPOTIFY_API_BASE}/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uris: [spotifyUri], position_ms: positionMs }),
  });
  if (res.ok || res.status === 204) return;
  const body = await res.text().catch(() => '');
  throw new Error(`Spotify API ${res.status}: ${body}`);
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
  uri: string;
  duration_ms: number;
}
