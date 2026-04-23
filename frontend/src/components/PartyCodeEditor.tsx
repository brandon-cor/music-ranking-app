// reusable party code field with quick copy feedback
import { useState } from 'react';

interface PartyCodeEditorProps {
  partyCode: string;
  className?: string;
}

export function PartyCodeEditor({ partyCode, className = '' }: PartyCodeEditorProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard
      .writeText(partyCode)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch(() => {
        setIsCopied(false);
      });
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label className="sr-only" htmlFor="party-code-editor">
        Party Code
      </label>
      <input
        id="party-code-editor"
        readOnly
        value={partyCode}
        onFocus={(event) => event.currentTarget.select()}
        className="w-56 rounded-full border border-border/50 bg-card/80 px-3 py-2 font-mono text-xs text-white"
      />
      <button
        onClick={handleCopy}
        className="shrink-0 rounded-full border border-border/50 bg-card/60 px-3 py-2 text-xs font-semibold text-white transition hover:bg-card"
      >
        {isCopied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}
