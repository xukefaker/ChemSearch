'use client';

import { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

import { usePresence } from '@/lib/animation/use-presence';

type QuerySuggestionGroup = {
  label: string;
  items: readonly string[];
};

type GlobalSearchPaletteProps = {
  open: boolean;
  value: string;
  isSearching: boolean;
  suggestionGroups: readonly QuerySuggestionGroup[];
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (query: string) => void;
};

export function GlobalSearchPalette({
  open,
  value,
  isSearching,
  suggestionGroups,
  onChange,
  onClose,
  onSubmit,
}: GlobalSearchPaletteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { mounted, phase } = usePresence(open, 220);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!mounted) {
    return null;
  }

  return (
    <div className='fixed inset-0 z-[120]' onClick={onClose}>
      <div className='psa-overlay-backdrop absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.18),rgba(15,23,42,0.32))]' data-state={phase} />
      <div className='flex min-h-full items-start justify-center px-4 pb-8 pt-[12vh] sm:px-8'>
        <div
          data-state={phase}
          onClick={(event) => event.stopPropagation()}
          className='psa-modal-surface relative w-full max-w-[820px] overflow-hidden rounded-[2rem] border border-white/80 bg-white/94 shadow-[0_36px_100px_rgba(15,23,42,0.22),0_18px_44px_rgba(79,70,229,0.08)]'
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit(value);
            }}
            className='contents'
          >
            <div className='border-b border-slate-100 px-5 py-5 sm:px-6'>
              <div className='flex items-center gap-3'>
                <div className='flex h-12 w-12 items-center justify-center rounded-[1.1rem] bg-indigo-50 text-indigo-600'>
                  <Search className='h-5 w-5' />
                </div>
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(event) => onChange(event.target.value)}
                  placeholder='Search papers, datasets, methods, or evidence...'
                  className='min-w-0 flex-1 border-0 bg-transparent text-[1.05rem] font-medium text-slate-900 outline-none placeholder:text-slate-400'
                />
                <button
                  type='button'
                  onClick={onClose}
                  className='inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900'
                >
                  <X className='h-4.5 w-4.5' />
                </button>
              </div>
              <div className='mt-4 flex items-center justify-between gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400'>
                <span>Global search</span>
                <span>Press Esc to close</span>
              </div>
            </div>

            <div className='space-y-5 px-5 py-5 sm:px-6 sm:py-6'>
              {suggestionGroups.map((group) => (
                <section key={group.label}>
                  <div className='mb-3 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-slate-400'>{group.label}</div>
                  <div className='flex flex-wrap gap-2'>
                    {group.items.map((query) => (
                      <button
                        key={query}
                        type='button'
                        onClick={() => onChange(query)}
                        className='rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-left text-[0.8rem] font-medium leading-5 text-slate-600 transition hover:border-indigo-200 hover:bg-white hover:text-indigo-600'
                      >
                        {query}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className='border-t border-slate-100 px-5 py-4 sm:px-6'>
              <div className='flex items-center justify-end gap-3'>
                <button
                  type='button'
                  onClick={onClose}
                  className='rounded-full border border-slate-200 bg-white px-4 py-2 text-[0.74rem] font-bold uppercase tracking-[0.18em] text-slate-500 transition hover:border-slate-300 hover:text-slate-800'
                >
                  Close
                </button>
                <button
                  type='submit'
                  disabled={isSearching || value.trim().length === 0}
                  className='inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-[0.74rem] font-bold uppercase tracking-[0.18em] text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-300'
                >
                  <Search className='h-4 w-4' />
                  Search
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
