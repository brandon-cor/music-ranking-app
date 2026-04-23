// Fixed pill navbar aligned with nero.fan: search, flame wordmark, profile
import { useNavigate } from 'react-router-dom';

function SearchIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function NeroFlame() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2c0 0-2 2.5-2 5.5C10 9.5 11 12 12 12s2-1.5 2-4.5C14 4.5 12 2 12 2zm-1.2 8.3C9.5 12.5 8.5 14 8.2 16c-.4 2.5.8 4.8 3.1 5.4 1.1.3 2.1.1 2.7-.1 2.1-.5 3.2-2.2 2.6-4.1-.3-1.1-1-2-1.8-2.6-.2-.1-.3-.2-.3-.2-.1-.1-.1-.1-.1-.1z" />
    </svg>
  );
}

export function NeroNav() {
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex justify-center px-4 pt-4">
      <div className="flex w-full max-w-4xl items-center justify-between gap-3 rounded-full border border-white/10 bg-card px-4 py-2.5 shadow-lg ring-1 ring-black/10">
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/60 transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
          aria-label="Search"
          onClick={() => navigate('/')}
        >
          <SearchIcon />
        </button>

        <a
          href="https://www.nero.fan/"
          target="_blank"
          rel="noreferrer"
          className="flex select-none items-center gap-1.5 text-base font-medium tracking-tight text-white transition hover:opacity-90"
        >
          <NeroFlame />
          <span>nero</span>
        </a>

        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/60 transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
          aria-label="Open nero.fan"
          onClick={() => {
            window.open('https://www.nero.fan/', '_blank', 'noopener,noreferrer');
          }}
        >
          <UserIcon />
        </button>
      </div>
    </header>
  );
}
