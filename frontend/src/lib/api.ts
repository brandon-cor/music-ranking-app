import type { Party, User, Song, SpotifyTrack, SongResult } from '../types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}

// party endpoints

export async function createParty(payload: {
  name: string;
  hostName: string;
  rating_window_seconds?: number;
  max_songs?: number;
  show_scores?: boolean;
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
  addedBy: string,
): Promise<{ song: Song }> {
  return request(`/parties/${partyId}/songs`, {
    method: 'POST',
    body: JSON.stringify({
      spotify_id: track.id,
      title: track.name,
      artist: track.artists.map((a) => a.name).join(', '),
      cover_url: track.album.images[0]?.url ?? '',
      added_by: addedBy,
    }),
  });
}

export async function getResults(partyId: string): Promise<{ results: SongResult[] }> {
  return request(`/parties/${partyId}/results`);
}

// spotify endpoints

export async function getSpotifyToken(partyId: string): Promise<{ token: string }> {
  return request(`/spotify/token/${partyId}`);
}

export async function searchSpotify(
  partyId: string,
  q: string,
): Promise<{ tracks: SpotifyTrack[] }> {
  return request(`/spotify/search?partyId=${encodeURIComponent(partyId)}&q=${encodeURIComponent(q)}`);
}

export async function spotifyPlay(partyId: string, spotifyUri: string, deviceId: string) {
  return request('/spotify/play', {
    method: 'POST',
    body: JSON.stringify({ partyId, spotifyUri, deviceId }),
  });
}
