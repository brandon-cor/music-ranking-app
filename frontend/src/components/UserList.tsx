import type { User } from '../types';

interface UserListProps {
  users: User[];
  hostId: string | null;
  currentUserId: string | null;
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

export default function UserList({ users, hostId, currentUserId }: UserListProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {users.map((user) => (
        <div key={user.id} className="flex items-center gap-2 bg-white/5 rounded-full px-3 py-1.5">
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${avatarColor(user.id)}`}
          >
            {user.name.charAt(0).toUpperCase()}
          </span>
          <span className="text-sm font-medium text-gray-300">
            {user.name}
            {user.id === hostId && (
              <span className="ml-1 text-gold text-xs">👑</span>
            )}
            {user.id === currentUserId && (
              <span className="ml-1 text-gray-500 text-xs">(you)</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
