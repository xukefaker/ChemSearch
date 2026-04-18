'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

import { usePresence } from '@/lib/animation/use-presence';

type OverlayPanelProps = {
  open: boolean;
  title: string;
  description?: string;
  side?: 'right' | 'center';
  widthClassName?: string;
  onClose: () => void;
  children: React.ReactNode;
};

export function OverlayPanel({
  open,
  title,
  description,
  side = 'center',
  widthClassName,
  onClose,
  children,
}: OverlayPanelProps) {
  const alignmentClassName = side === 'right' ? 'justify-end' : 'justify-center';
  const { mounted, phase } = usePresence(open, 220);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!mounted) {
    return null;
  }

  return (
    <div className={`fixed inset-0 z-[100] flex items-center ${alignmentClassName} p-4 sm:p-6`}>
      <div data-state={phase} onClick={onClose} className='psa-overlay-backdrop absolute inset-0 bg-slate-900/40' />

      <section
        data-state={phase}
        className={`psa-modal-surface relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2.5rem] border border-slate-200/50 bg-white shadow-2xl ${widthClassName || ''}`}
      >
        <header className='sticky top-0 z-20 flex items-start justify-between gap-6 border-b border-slate-100 bg-white/92 px-8 py-6'>
          <div className='min-w-0'>
            <div className='mb-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600'>Paper Analytics</div>
            <h2 className='text-xl font-extrabold leading-tight text-slate-900'>{title}</h2>
            {description && <p className='mt-2 text-sm font-medium text-slate-400'>{description}</p>}
          </div>
          <button
            onClick={onClose}
            className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-900'
          >
            <X className='h-5 w-5' />
          </button>
        </header>

        <div className='custom-scrollbar flex-1 overflow-y-auto px-8 py-8'>{children}</div>

        <footer className='flex justify-end border-t border-slate-100 bg-slate-50/50 px-8 py-4'>
          <button
            onClick={onClose}
            className='rounded-xl bg-slate-900 px-6 py-2 text-sm font-bold text-white transition-all hover:bg-indigo-600'
          >
            Close Detail
          </button>
        </footer>
      </section>
    </div>
  );
}
