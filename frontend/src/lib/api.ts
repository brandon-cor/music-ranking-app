import type { Party, User, Song, SpotifyTrack, SongResult } from '../types';

const BASE = '/api';

// thrown when the API returns a non-2xx response. carries the http status and
// any backend-provided code so callers can react to specific failures (e.g. 410).
export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || 'Request failed', res.status, data.code);
  }
  return data as T;
}

// party endpoints

export async function createParty(payload: {
  name: string;
  hostName: string;
  songs_per_user?: number;
}): Promise<{ party: Party; user: User }> {
  return request('/parties', { method: 'POST', body: JSON.stringify(payload) });
}

export async function getParty(partyId: string): Promise<Party> {
  return request(`/parties/${partyId}`);
}

export async function joinParty(partyId: string, name: string): Promise<{ user: User }> {
  return request(`/parties/${partyId}/join`, { method: 'POST', body: JSON.stringify({ name }) });
}

export async function addSong(
  partyId: string,
  track: SpotifyTrack,
  addedByUser: { id: string; name: string },
  startTimeMs = 0,
): Promise<{ song: Song }> {
  return request(`/parties/${partyId}/songs`, {
    method: 'POST',
    body: JSON.stringify({
      spotify_id: track.id,
      title: track.name,
      artist: track.artists.map((a) => a.name).join(', '),
      cover_url: track.album.images[0]?.url ?? '',
      added_by: addedByUser.name,
      added_by_user_id: addedByUser.id,
      start_time_ms: startTimeMs,
    }),
  });
}

export async function getResults(partyId: string): Promise<{ results: SongResult[] }> {
  return request(`/parties/${partyId}/results`);
}

// spotify endpoints

export async function getSpotifyToken(userId: string): Promise<{ token: string }> {
  return request(`/spotify/token/${userId}`);
}

export async function searchSpotify(
  partyId: string,
  q: string,
): Promise<{ tracks: SpotifyTrack[] }> {
  return request(`/spotify/search?partyId=${encodeURIComponent(partyId)}&q=${encodeURIComponent(q)}`);
}

export async function spotifyPlay(
  userId: string,
  spotifyUri: string,
  deviceId: string,
  positionMs = 0,
) {
  return request('/spotify/play', {
    method: 'POST',
    body: JSON.stringify({ userId, spotifyUri, deviceId, positionMs }),
  });
}
