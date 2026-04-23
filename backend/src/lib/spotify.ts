import { prisma } from './prisma';

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

// build the Spotify OAuth authorization URL
export function getAuthUrl(partyId: string): string {
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
    state: partyId,
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

// exchange auth code for access + refresh tokens
export async function exchangeCode(code: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const creds = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
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

// get a fresh access token using the stored refresh token
export async function refreshToken(partyId: string): Promise<string> {
  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party?.spotify_refresh_token) throw new Error('No refresh token stored');

  const creds = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: party.spotify_refresh_token,
    }),
  });
  if (!res.ok) throw new Error('Failed to refresh Spotify token');
  const data = (await res.json()) as { access_token: string };

  await prisma.party.update({
    where: { id: partyId },
    data: { spotify_access_token: data.access_token },
  });
  return data.access_token;
}

// get a valid access token, refreshing if needed
export async function getToken(partyId: string): Promise<string> {
  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party?.spotify_access_token) throw new Error('No Spotify token for this party');
  return party.spotify_access_token;
}

// search Spotify tracks
export async function searchTracks(query: string, token: string) {
  const url = `${SPOTIFY_API_BASE}/search?q=${encodeURIComponent(query)}&type=track&limit=10`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new Error('SPOTIFY_UNAUTHORIZED');
  if (!res.ok) throw new Error('Spotify search failed');
  const data = (await res.json()) as { tracks: { items: SpotifyTrack[] } };
  return data.tracks.items;
}

// tell Spotify to play a track on a specific device, optionally from a given position
export async function playTrack(token: string, spotifyUri: string, deviceId: string, positionMs = 0) {
  const res = await fetch(`${SPOTIFY_API_BASE}/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uris: [spotifyUri], position_ms: positionMs }),
  });
  // 204 = success with no body; 200 is also fine
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
