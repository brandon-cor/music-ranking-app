// Shared Spotify Web Playback SDK hook. Every user (host + guests) initializes
// their own player with their own access token so they can stream clip previews
// in the lobby and, for the host, the real party playback on their device.
import { useEffect, useRef, useState } from 'react';
import { getSpotifyToken } from './api';
import type { SpotifyPlayer } from '../types';

interface UseSpotifyPlayerResult {
  deviceId: string | null;
  /** Same ref as `player` — useful for imperative calls inside callbacks. */
  playerRef: React.MutableRefObject<SpotifyPlayer | null>;
  /** Live player instance for components that need to subscribe (e.g. progress UI). */
  player: SpotifyPlayer | null;
  errorMessage: string | null;
  clearError: () => void;
}

/**
 * Initializes a Spotify Web Playback SDK instance for the given user. The
 * player stays connected for the lifetime of the component and disconnects
 * on unmount. Pass `enabled = false` to skip initialization entirely.
 */
export function useUserSpotifyPlayer(
  userId: string | null | undefined,
  enabled = true,
): UseSpotifyPlayerResult {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [player, setPlayer] = useState<SpotifyPlayer | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const playerRef = useRef<SpotifyPlayer | null>(null);

  useEffect(() => {
    if (!enabled || !userId) return;

    let cancelled = false;

    const init = async () => {
      try {
        await getSpotifyToken(userId);
      } catch {
        if (!cancelled) {
          setErrorMessage('Connect your Spotify account to play and preview songs.');
        }
        return;
      }

      const bootSdk = () => {
        if (cancelled) return;

        const onPlayerError = (message: string) => {
          console.warn(message);
          setErrorMessage(
            'Spotify playback is unavailable in this browser. Open the app in Chrome, reconnect Spotify, then try again.',
          );
        };

        const player: SpotifyPlayer = new window.Spotify.Player({
          name: 'Nero Party',
          /** Fetch a fresh token on every SDK request so expiry and refresh stay in sync with the server. */
          getOAuthToken: (cb) => {
            void getSpotifyToken(userId)
              .then((res) => cb(res.token))
              .catch(() => {
                onPlayerError('Spotify token refresh failed');
              });
          },
          volume: 0.8,
        });

        player.addListener('ready', (data) => {
          if (cancelled) return;
          const { device_id } = data as { device_id: string };
          setDeviceId(device_id);
          setErrorMessage(null);
        });
        player.addListener('not_ready', () => {
          if (cancelled) return;
          setDeviceId(null);
        });
        player.addListener('initialization_error', () => onPlayerError('Spotify SDK initialization failed'));
        player.addListener('authentication_error', () => onPlayerError('Spotify SDK authentication failed'));
        player.addListener('account_error', () => onPlayerError('Spotify SDK account check failed'));
        player.addListener('playback_error', () => onPlayerError('Spotify playback error'));

        player.connect().then((success) => {
          if (!success) onPlayerError('Spotify player failed to connect');
        });

        playerRef.current = player;
        setPlayer(player);
      };

      if (window.Spotify) {
        bootSdk();
      } else {
        window.onSpotifyWebPlaybackSDKReady = bootSdk;
      }
    };

    init();

    return () => {
      cancelled = true;
      playerRef.current?.disconnect();
      playerRef.current = null;
      setPlayer(null);
      setDeviceId(null);
    };
  }, [userId, enabled]);

  return {
    deviceId,
    playerRef,
    player,
    errorMessage,
    clearError: () => setErrorMessage(null),
  };
}
