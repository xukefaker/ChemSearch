'use client';

import { X } from 'lucide-react';

import { usePresence } from '@/lib/animation/use-presence';

export type ManuscriptOutlineItem = {
  blockId: string;
  title: string;
  depth: number;
  pageStart: number;
};

type ManuscriptOutlineProps = {
  items: ManuscriptOutlineItem[];
  activeBlockId: string | null;
  previewBlockId?: string | null;
  cueBlockId?: string | null;
  onSelect: (blockId: string) => void;
};

type ManuscriptOutlineSheetProps = ManuscriptOutlineProps & {
  open: boolean;
  onClose: () => void;
};

export function ManuscriptOutlineRail({ items, activeBlockId, previewBlockId = null, cueBlockId = null, onSelect }: ManuscriptOutlineProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <aside className="sticky top-6 w-[15rem] flex-shrink-0 self-start rounded-[1.6rem] border border-slate-200/85 bg-white/88 p-4 shadow-scholar-sm backdrop-blur-xl">
      <div className="mb-3 text-[0.66rem] font-bold uppercase tracking-[0.22em] text-slate-400">Outline</div>
      <div className="max-h-[calc(100vh-12rem)] space-y-1 overflow-y-auto pr-1">
        {items.map((item) => {
          const isActive = item.blockId === activeBlockId;
          const isPreview = item.blockId === previewBlockId;
          const hasCue = item.blockId === cueBlockId;
          return (
            <button
              key={item.blockId}
              type="button"
              onClick={() => onSelect(item.blockId)}
              className={`flex w-full items-start justify-between gap-3 rounded-[1rem] px-3 py-2 text-left transition ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : isPreview
                    ? 'bg-indigo-50/60 text-indigo-600'
                    : hasCue
                      ? 'bg-white text-slate-700 ring-1 ring-indigo-100 shadow-[0_8px_20px_rgba(99,102,241,0.06)]'
                      : 'text-slate-500 hover:bg-slate-50'
              }`}
              style={{ paddingLeft: `${0.75 + Math.min(item.depth, 3) * 0.55}rem` }}
            >
              <span className={`line-clamp-2 text-[0.8rem] leading-5 ${isActive || isPreview ? 'font-semibold' : 'font-medium'}`}>{item.title}</span>
              <span className="mt-0.5 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-slate-400">P.{item.pageStart}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export function ManuscriptOutlineSheet({
  items,
  activeBlockId,
  previewBlockId = null,
  cueBlockId = null,
  onSelect,
  open,
  onClose,
}: ManuscriptOutlineSheetProps) {
  const { mounted, phase } = usePresence(open, 180);

  if (items.length === 0 || !mounted) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-[90] flex items-end justify-center p-4">
      <div className="psa-overlay-backdrop absolute inset-0 bg-slate-950/18" data-state={phase} onClick={onClose} />
      <section
        data-state={phase}
        onClick={(event) => event.stopPropagation()}
        className="psa-modal-surface relative flex max-h-[78vh] w-full max-w-[30rem] flex-col overflow-hidden rounded-[1.9rem] border border-white/85 bg-white/96 shadow-[0_30px_80px_rgba(15,23,42,0.18)]"
      >
        <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4">
          <div>
            <div className="text-[0.66rem] font-bold uppercase tracking-[0.22em] text-slate-400">Outline</div>
            <div className="mt-1 text-[1rem] font-black tracking-tight text-slate-950">Jump to section</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-indigo-200 hover:text-indigo-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-1">
            {items.map((item) => {
              const isActive = item.blockId === activeBlockId;
              const isPreview = item.blockId === previewBlockId;
              const hasCue = item.blockId === cueBlockId;
              return (
                <button
                  key={item.blockId}
                  type="button"
                  onClick={() => {
                    onSelect(item.blockId);
                    onClose();
                  }}
                  className={`flex w-full items-start justify-between gap-3 rounded-[1rem] px-3 py-3 text-left transition ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : isPreview
                        ? 'bg-indigo-50/60 text-indigo-600'
                        : hasCue
                          ? 'bg-white text-slate-700 ring-1 ring-indigo-100 shadow-[0_8px_20px_rgba(99,102,241,0.06)]'
                          : 'text-slate-600 hover:bg-slate-50'
                  }`}
                  style={{ paddingLeft: `${0.75 + Math.min(item.depth, 3) * 0.55}rem` }}
                >
                  <span className={`line-clamp-2 text-[0.88rem] leading-6 ${isActive || isPreview ? 'font-semibold' : 'font-medium'}`}>{item.title}</span>
                  <span className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-slate-400">P.{item.pageStart}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
