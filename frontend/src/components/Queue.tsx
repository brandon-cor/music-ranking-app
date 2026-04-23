import type { Song } from '../types';

interface QueueProps {
  songs: Song[];
  currentSongId: string | null;
}

export default function Queue({ songs, currentSongId }: QueueProps) {
  if (songs.length === 0) {
    return <p className="text-gray-600 text-sm italic">Queue is empty</p>;
  }

  return (
    <ol className="flex flex-col gap-2">
      {songs.map((song, i) => {
        const isCurrent = song.id === currentSongId;
        const isPlayed = currentSongId
          ? song.order < (songs.find((s) => s.id === currentSongId)?.order ?? 0)
          : false;

        return (
          <li
            key={song.id}
            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
              isCurrent
                ? 'bg-gold/10 border border-gold/30'
                : isPlayed
                  ? 'opacity-40'
                  : 'bg-white/5'
            }`}
          >
            <span
              className={`text-sm font-bold w-5 text-center shrink-0 ${
                isCurrent ? 'text-gold' : 'text-gray-600'
              }`}
            >
              {i + 1}
            </span>

            <img
              src={song.cover_url}
              alt=""
              className="w-10 h-10 rounded object-cover shrink-0"
            />

            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-semibold truncate ${isCurrent ? 'text-white' : 'text-gray-300'}`}
              >
                {song.title}
              </p>
              <p className="text-xs text-gray-500 truncate">{song.artist}</p>
            </div>

            {isCurrent && (
              <span className="text-xs text-gold font-bold uppercase tracking-wide shrink-0">
                ▶ playing
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
