// Fixed pill navbar aligned with nero.fan: search, wordmark, profile
import { useNavigate } from 'react-router-dom';
import neroLogo from '../nero.png';

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
          <img src={neroLogo} alt="" className="h-5 w-5 object-contain" width={20} height={20} aria-hidden />
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
