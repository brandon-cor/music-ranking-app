// Shared serializers that strip Spotify tokens from user/party payloads before
// sending them over the wire, while exposing a simple `spotify_connected` flag.
import type { Party, Song, User } from '@prisma/client';

export interface SafeUser {
  id: string;
  name: string;
  party_id: string;
  spotify_connected: boolean;
}

export interface SafeParty {
  id: string;
  name: string;
  status: string;
  rating_window_seconds: number;
  max_songs: number;
  songs_per_user: number;
  show_scores: boolean;
  host_id: string | null;
  current_song_id: string | null;
  songs: Song[];
  users: SafeUser[];
  createdAt: Date;
}

export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    name: user.name,
    party_id: user.party_id,
    spotify_connected: !!user.spotify_access_token,
  };
}

export function toSafeParty(
  party: Party & { songs?: Song[]; users?: User[] },
): SafeParty {
  return {
    id: party.id,
    name: party.name,
    status: party.status,
    rating_window_seconds: party.rating_window_seconds,
    max_songs: party.max_songs,
    songs_per_user: party.songs_per_user,
    show_scores: party.show_scores,
    host_id: party.host_id,
    current_song_id: party.current_song_id,
    songs: party.songs ?? [],
    users: (party.users ?? []).map(toSafeUser),
    createdAt: party.createdAt,
  };
}
