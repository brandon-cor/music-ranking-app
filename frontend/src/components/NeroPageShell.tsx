// Shared app chrome: nero.fan–style nav, wireframe + radial glow, main content
import type { ReactNode } from 'react';
import { NeroNav } from './NeroNav';
import { WireframeBackground } from './WireframeBackground';

interface NeroPageShellProps {
  children: ReactNode;
  className?: string;
}

export function NeroPageShell({ children, className = '' }: NeroPageShellProps) {
  return (
    <div className={`relative min-h-screen bg-background text-foreground ${className}`}>
      <NeroNav />
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <WireframeBackground />
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(34,197,94,0.1),transparent_60%)]"
          aria-hidden
        />
      </div>
      <div className="relative z-10 pt-20">{children}</div>
    </div>
  );
}
