// iPod shuffle–style host playback chrome: track info, album art, progress, play/pause
import { useCallback, useEffect, useState } from 'react';
import type { Song, SpotifyPlayer } from '../types';

/** Minimal shape returned by Spotify Web Playback SDK getCurrentState() */
interface SpotifyWebPlaybackState {
  paused: boolean;
  position: number;
  track_window: { current_track: { duration_ms: number } | null };
}

function parseState(raw: unknown): { position: number; duration: number; paused: boolean } | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<SpotifyWebPlaybackState>;
  const pos = typeof s.position === 'number' ? s.position : 0;
  const paused = s.paused === true;
  const track = s.track_window?.current_track;
  const duration = track && typeof track.duration_ms === 'number' ? track.duration_ms : 0;
  return { position: pos, duration, paused };
}

function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export interface IPodPlayerProps {
  song: Song | null;
  isHost: boolean;
  player: SpotifyPlayer | null;
  /** Seek back to the party clip start (host only). */
  onReplayClip?: () => void;
  /** End the rating window early (host only, while rating is open). */
  onSkipRating?: () => void;
  showSkip?: boolean;
  /** Stretch to parent height and grow the art area (live Player middle column). */
  fillHeight?: boolean;
}

export function IPodPlayer({
  song,
  isHost,
  player,
  onReplayClip,
  onSkipRating,
  showSkip = false,
  fillHeight = false,
}: IPodPlayerProps) {
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(true);

  const refresh = useCallback(async () => {
    if (!player || !isHost) {
      setPosition(0);
      setDuration(0);
      setPaused(true);
      return;
    }
    const raw = await player.getCurrentState();
    const parsed = parseState(raw);
    if (!parsed) {
      setPosition(0);
      setDuration(0);
      setPaused(true);
      return;
    }
    setPosition(parsed.position);
    setDuration(parsed.duration);
    setPaused(parsed.paused);
  }, [player, isHost]);

  useEffect(() => {
    void refresh();
  }, [refresh, song?.id]);

  useEffect(() => {
    if (!player || !isHost) return;

    const onState = () => {
      void refresh();
    };
    player.addListener('player_state_changed', onState);
    const id = window.setInterval(() => {
      void refresh();
    }, 500);

    return () => {
      clearInterval(id);
      player.removeListener('player_state_changed');
    };
  }, [player, isHost, refresh]);

  const showProgress = isHost && duration > 0;
  const progressPct = showProgress ? Math.min(100, (position / duration) * 100) : 0;
  const canToggle = isHost && !!player && !!song;
  const canReplay = isHost && !!onReplayClip && !!song;
  const canSkip = isHost && showSkip && !!onSkipRating;

  const handlePlayPause = () => {
    if (!canToggle) return;
    void player?.togglePlay();
  };

  return (
    <div
      className={`rounded-[28px] bg-gradient-to-b from-zinc-300 to-zinc-500 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_20px_40px_rgba(0,0,0,0.35)] ${
        fillHeight ? 'flex h-full min-h-[320px] flex-col' : ''
      }`}
      data-testid="ipod-player"
    >
      <div
        className={`overflow-hidden rounded-2xl bg-zinc-900 p-3 shadow-inner sm:p-4 ${
          fillHeight ? 'flex min-h-0 flex-1 flex-col' : ''
        }`}
      >
        <div
          className={`flex items-stretch gap-2 sm:gap-3 ${
            fillHeight
              ? 'min-h-0 flex-1 flex-col sm:flex-row sm:items-center'
              : 'min-h-[4.5rem] sm:min-h-[5.5rem]'
          }`}
        >
          <div
            className={`flex min-w-0 flex-col justify-center text-left text-white ${
              fillHeight ? 'shrink-0 sm:flex-1' : 'flex-1'
            }`}
          >
            {song ? (
              <>
                <p className="truncate text-sm font-bold leading-tight sm:text-base">{song.title}</p>
                <p className="mt-1 truncate text-xs text-zinc-400 sm:text-sm">{song.artist}</p>
              </>
            ) : (
              <p className="text-sm text-zinc-500">No song playing</p>
            )}
          </div>
          <div
            className={`relative shrink-0 ${
              fillHeight
                ? 'mx-auto mt-3 aspect-square h-[min(18rem,calc(100%-1rem))] max-h-72 w-[min(18rem,calc(100%-1rem))] max-w-full sm:mx-0 sm:mt-0 sm:h-[min(20rem,45vh)] sm:w-[min(20rem,45vh)]'
                : 'h-16 w-16 sm:h-20 sm:w-20'
            }`}
          >
            {song ? (
              <img src={song.cover_url} alt="" className="h-full w-full rounded-lg object-cover shadow-md" />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center rounded-lg bg-zinc-800 text-center text-[10px] text-zinc-500"
                aria-hidden
              >
                —
              </div>
            )}
          </div>
        </div>

        <div className={`${fillHeight ? 'mt-4 shrink-0' : 'mt-3'}`}>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800"
            role="progressbar"
            aria-valuenow={Math.round(progressPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Playback position"
          >
            <div
              className="h-full rounded-full bg-white/90 transition-[width] duration-200 ease-out"
              style={{ width: `${showProgress ? progressPct : 0}%` }}
            />
          </div>
          {isHost && (
            <div className="mt-1 flex justify-between text-[10px] tabular-nums text-zinc-500">
              <span>{formatMs(position)}</span>
              <span>{formatMs(Math.max(0, duration))}</span>
            </div>
          )}
        </div>
      </div>

      <div className={`flex items-center justify-center gap-4 sm:gap-6 ${fillHeight ? 'mt-5 shrink-0' : 'mt-5'}`}>
        <button
          type="button"
          disabled={!canReplay}
          onClick={() => onReplayClip?.()}
          aria-label="Replay clip from start"
          title="Replay 30s clip from your chosen start"
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-zinc-600/80 bg-zinc-800/90 text-zinc-200 shadow-md transition active:scale-95 ${
            canReplay ? 'hover:bg-zinc-700' : 'cursor-not-allowed opacity-35'
          }`}
        >
          <ReplayIcon />
        </button>

        <button
          type="button"
          disabled={!canToggle}
          onClick={handlePlayPause}
          aria-label={paused ? 'Play' : 'Pause'}
          className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_4px_8px_rgba(0,0,0,0.25),inset_0_-2px_4px_rgba(0,0,0,0.08)] transition active:scale-95 ${
            canToggle ? 'hover:bg-zinc-100' : 'cursor-not-allowed opacity-40'
          }`}
        >
          {paused ? (
            <span className="ml-0.5 block h-0 w-0 border-y-[9px] border-l-[14px] border-y-transparent border-l-zinc-800" />
          ) : (
            <span className="flex gap-1.5" aria-hidden>
              <span className="h-6 w-1 rounded-sm bg-zinc-800" />
              <span className="h-6 w-1 rounded-sm bg-zinc-800" />
            </span>
          )}
        </button>

        <button
          type="button"
          disabled={!canSkip}
          onClick={() => onSkipRating?.()}
          aria-label="Skip rating and go to next song"
          title="Skip rating (host)"
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-zinc-600/80 bg-zinc-800/90 text-zinc-200 shadow-md transition active:scale-95 ${
            canSkip ? 'hover:bg-zinc-700' : 'cursor-not-allowed opacity-35'
          }`}
        >
          <SkipIcon />
        </button>
      </div>
    </div>
  );
}

function ReplayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 12a9 9 0 1 1 3 7.5" strokeLinecap="round" />
      <path d="M3 16v-4h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SkipIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 6v12l10-6L7 6zm10 0h2v12h-2V6z" />
    </svg>
  );
}
