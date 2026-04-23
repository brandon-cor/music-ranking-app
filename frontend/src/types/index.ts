export interface Party {
  id: string;
  name: string;
  status: 'lobby' | 'playing' | 'ended';
  rating_window_seconds: number;
  max_songs: number;
  songs_per_user: number;
  show_scores: boolean;
  host_id: string | null;
  current_song_id: string | null;
  songs: Song[];
  users: User[];
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  party_id: string;
  is_ready: boolean;
  spotify_connected: boolean;
}

export interface Song {
  id: string;
  party_id: string;
  spotify_id: string;
  title: string;
  artist: string;
  cover_url: string;
  added_by: string;
  added_by_user_id: string | null;
  order: number;
  start_time_ms: number;
}

export interface Rating {
  id: string;
  song_id: string;
  user_id: string;
  score: number;
  voted_at: string;
}

export interface SongResult extends Song {
  ratings: Rating[];
  avgScore: number;
  firstVote: string | null;
}

export interface RatingWindowState {
  songId: string;
  endsAt: number;
  duration: number;
}

// Spotify search result shape from our backend
export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
  uri: string;
  duration_ms: number;
}

// Injected by the Spotify Web Playback SDK script in index.html
declare global {
  interface Window {
    Spotify: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume: number;
      }) => SpotifyPlayer;
    };
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

export interface SpotifyPlayer {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, cb: (data: unknown) => void) => void;
  removeListener: (event: string) => void;
  getCurrentState: () => Promise<unknown>;
  setVolume: (volume: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  togglePlay: () => Promise<void>;
  // must be called inside a user gesture to unlock the browser's audio context
  activateElement: () => void;
}
