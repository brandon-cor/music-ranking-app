import { motion, AnimatePresence } from 'framer-motion';
import type { Song } from '../types';

interface NowPlayingProps {
  song: Song | null;
}

export default function NowPlaying({ song }: NowPlayingProps) {
  return (
    <AnimatePresence mode="wait">
      {song ? (
        <motion.div
          key={song.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex items-center gap-6"
        >
          <div className="relative shrink-0">
            <img
              src={song.cover_url}
              alt={`${song.title} cover`}
              className="w-24 h-24 rounded-lg object-cover shadow-2xl"
            />
            {/* pulsing ring to indicate something is playing */}
            <span className="absolute -inset-1 rounded-lg border-2 border-accent/40 animate-ping" />
          </div>

          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-accent">
              Now Playing
            </p>
            <h2 className="text-2xl font-black truncate leading-tight">{song.title}</h2>
            <p className="text-gray-400 text-sm truncate mt-1">{song.artist}</p>
            <p className="text-gray-600 text-xs mt-1">added by {song.added_by}</p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-gray-600 text-sm"
        >
          No song playing yet
        </motion.div>
      )}
    </AnimatePresence>
  );
}
