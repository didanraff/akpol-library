import { BookOpen } from 'lucide-react';
import { useState } from 'react';
import { getSafeCoverUrl } from '../lib/api.ts';

interface BookCoverProps {
  src: string;
  title: string;
  author?: string;
  className?: string;
}

export function BookCover({ src, title, author, className = '' }: BookCoverProps) {
  const [failed, setFailed] = useState(false);
  const safeSrc = getSafeCoverUrl(src);

  if (!safeSrc || failed) {
    return (
      <div
        className={`relative flex flex-col justify-between bg-gradient-to-br from-slate-800 via-slate-900 to-teal-950 p-4 text-slate-100 select-none ${className}`}
      >
        <div className="flex items-center justify-between border-b border-white/15 pb-2">
          <span className="font-mono text-[11px] tracking-wider text-teal-300">PUSTAKA</span>
          <BookOpen className="h-4 w-4 text-teal-300" aria-hidden="true" />
        </div>
        <div className="my-auto py-3">
          <p className="font-display text-sm font-semibold leading-snug line-clamp-3 text-white">
            {title}
          </p>
          {author && <p className="mt-1.5 text-xs text-slate-300 truncate">{author}</p>}
        </div>
        <div className="border-t border-white/15 pt-2 text-[11px] text-slate-400">
          Edisi Koleksi Digital
        </div>
      </div>
    );
  }

  return (
    <img
      src={safeSrc}
      alt={`Sampul buku ${title}`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover bg-slate-100 ${className}`}
    />
  );
}
