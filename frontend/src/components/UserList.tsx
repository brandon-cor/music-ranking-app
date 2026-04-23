import type { User } from '../types';

interface UserListProps {
  users: User[];
  hostId: string | null;
  currentUserId: string | null;
  /** When set, users in this list get a check mark (e.g. voted on current song). */
  votedUserIds?: string[];
}

const COLORS = [
  'bg-purple-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-pink-500',
  'bg-orange-500',
  'bg-teal-500',
  'bg-red-500',
  'bg-indigo-500',
];

function avatarColor(userId: string): string {
  let hash = 0;
  for (const ch of userId) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return COLORS[hash % COLORS.length];
}

export default function UserList({ users, hostId, currentUserId, votedUserIds }: UserListProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {users.map((user) => (
        <div
          key={user.id}
          className="flex items-center gap-2 rounded-full border border-border/30 bg-card/40 px-3 py-1.5"
        >
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${avatarColor(user.id)}`}
          >
            {user.name.charAt(0).toUpperCase()}
          </span>
          <span className="text-sm font-medium text-gray-300">
            {user.name}
            {user.id === hostId && (
              <span className="ml-1 text-xs text-accent">👑</span>
            )}
            {user.id === currentUserId && (
              <span className="ml-1 text-gray-500 text-xs">(you)</span>
            )}
            {votedUserIds?.includes(user.id) && (
              <span className="ml-1 text-xs text-success" aria-label="Voted">
                ✓
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
