'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Landmark, Quote, Sparkles, Users, X } from 'lucide-react';

import type { PaperResult } from '@/lib/types';

type QuickPeekPanelProps = {
  paper: PaperResult | null;
  onClose: () => void;
  onOpenPaper: (paper: PaperResult) => void;
};

function previewOverview(paper: PaperResult): { heading: string; text: string } {
  const abstract = paper.abstract?.trim();
  if (abstract) {
    return { heading: 'Abstract', text: abstract };
  }
  const mainReason = paper.rationale_structured?.main_reason?.trim();
  if (mainReason) {
    return { heading: 'Search rationale', text: mainReason };
  }
  return { heading: 'Search rationale', text: paper.rationale.trim() };
}

export function QuickPeekPanel({ paper, onClose, onOpenPaper }: QuickPeekPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const overview = paper ? previewOverview(paper) : null;
  const matchingPoints = paper?.rationale_structured?.matching_points?.slice(0, 3) ?? [];
  const benchmarks = paper?.structured_summary?.benchmarks?.slice(0, 8) ?? [];
  const keyFindings = paper?.structured_summary?.key_findings?.slice(0, 4) ?? [];

  useEffect(() => {
    if (!paper) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, paper]);

  return (
    <AnimatePresence>
      {paper ? (
        <motion.div
          className='fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/18 p-4 backdrop-blur-[4px] sm:items-center sm:p-8'
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.section
            role='dialog'
            aria-modal='true'
            aria-labelledby='quick-peek-title'
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.99 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(event) => event.stopPropagation()}
            className='relative flex max-h-[min(90vh,56rem)] w-full max-w-[64rem] flex-col overflow-hidden rounded-[2.2rem] border border-white/85 bg-white/96 shadow-[0_40px_120px_rgba(15,23,42,0.24)]'
          >
            <button
              ref={closeButtonRef}
              type='button'
              onClick={onClose}
              aria-label='Close quick peek'
              className='absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white/94 text-slate-500 transition hover:border-indigo-200 hover:text-indigo-600'
            >
              <X className='h-4.5 w-4.5' />
            </button>

            <div className='custom-scrollbar overflow-y-auto'>
              <div className='flex flex-col'>
                <div className='relative min-h-[16rem] border-b border-slate-100 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.12),transparent_40%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)]'>
                  {paper.main_image_url ? (
                    <>
                      <img
                        src={paper.main_image_url}
                        alt='Paper preview'
                        className='max-h-[22rem] w-full object-cover object-top'
                      />
                      <div className='absolute inset-0 bg-gradient-to-t from-slate-950/16 via-transparent to-white/8' />
                    </>
                  ) : (
                    <div className='flex min-h-[16rem] flex-col items-center justify-center px-8 py-12 text-center'>
                      <div className='mb-5 flex h-20 w-20 items-center justify-center rounded-[1.8rem] border border-white/80 bg-white/72 shadow-scholar-sm'>
                        <Sparkles className='h-8 w-8 text-indigo-500' />
                      </div>
                      <p className='font-scholar max-w-[30rem] text-[1rem] italic leading-8 text-slate-500'>
                        No preview figure is available for this paper, but the structured metadata below is ready to inspect.
                      </p>
                    </div>
                  )}
                </div>

                <div className='flex flex-col px-6 py-6 sm:px-8 sm:py-8'>
                  <div className='flex flex-wrap gap-2'>
                    <span className='rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[0.64rem] font-bold uppercase tracking-[0.22em] text-indigo-600'>
                      {paper.venue.toUpperCase()} {paper.year} {paper.track ? `· ${paper.track}` : ''}
                    </span>
                    <span className={`rounded-full border px-3 py-1 text-[0.64rem] font-bold uppercase tracking-[0.22em] ${
                      paper.verdict.toLowerCase() === 'satisfied'
                        ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                        : paper.verdict.toLowerCase() === 'partial'
                          ? 'border-amber-100 bg-amber-50 text-amber-700'
                          : 'border-slate-200 bg-slate-100 text-slate-600'
                    }`}>
                      {paper.verdict}
                    </span>
                  </div>

                  <h2 id='quick-peek-title' className='mt-5 text-[clamp(1.8rem,3vw,2.45rem)] font-black leading-[1.08] tracking-[-0.05em] text-slate-950'>
                    {paper.title}
                  </h2>

                  {paper.authors && paper.authors.length > 0 ? (
                    <div className='mt-5 flex items-start gap-3 text-[0.98rem] leading-7 text-slate-700'>
                      <Users className='mt-1 h-4.5 w-4.5 flex-shrink-0 text-indigo-400' />
                      <span>{paper.authors.join(', ')}</span>
                    </div>
                  ) : null}

                  {paper.affiliations && paper.affiliations.length > 0 ? (
                    <div className='font-scholar mt-3 flex items-start gap-3 text-[0.98rem] italic leading-7 text-slate-500'>
                      <Landmark className='mt-1 h-4.5 w-4.5 flex-shrink-0 text-slate-300' />
                      <span>{paper.affiliations.join(' · ')}</span>
                    </div>
                  ) : null}

                  {overview ? (
                    <div className='mt-7 rounded-[1.5rem] border border-slate-200/90 bg-slate-50/90 px-5 py-5'>
                      <div className='text-[0.68rem] font-bold uppercase tracking-[0.22em] text-slate-400'>{overview.heading}</div>
                      <p className='font-scholar mt-3 text-[1rem] leading-8 text-slate-700'>
                        {overview.text}
                      </p>
                    </div>
                  ) : null}

                  {matchingPoints.length ? (
                    <div className='mt-6 rounded-[1.5rem] border border-slate-200/90 bg-slate-50/90 px-5 py-5'>
                      <div className='flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-slate-400'>
                        <Quote className='h-3.5 w-3.5 text-indigo-400' />
                        Why this surfaced
                      </div>
                      <ul className='mt-3 space-y-2 text-[0.96rem] leading-7 text-slate-700'>
                        {matchingPoints.map((item) => (
                          <li key={item} className='flex gap-2'>
                            <span className='mt-[0.72rem] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-400' />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className='mt-6 grid gap-6 lg:grid-cols-[1.12fr_0.88fr]'>
                    <div className='space-y-6'>
                      {paper.structured_summary?.methodology ? (
                        <div className='rounded-[1.4rem] border border-slate-200/85 bg-white px-5 py-5'>
                          <div className='text-[0.66rem] font-bold uppercase tracking-[0.2em] text-slate-400'>Methodology</div>
                          <p className='mt-2 text-[0.95rem] leading-7 text-slate-600'>
                            {paper.structured_summary.methodology}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    <div className='space-y-6'>
                      {keyFindings.length ? (
                        <div className='rounded-[1.4rem] border border-slate-200/85 bg-white px-5 py-5'>
                          <div className='text-[0.66rem] font-bold uppercase tracking-[0.2em] text-slate-400'>Key findings</div>
                          <ul className='mt-3 space-y-2 text-[0.94rem] leading-7 text-slate-600'>
                            {keyFindings.map((item) => (
                              <li key={item} className='flex gap-2'>
                                <span className='mt-[0.68rem] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-400' />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {benchmarks.length ? (
                        <div className='rounded-[1.4rem] border border-slate-200/85 bg-white px-5 py-5'>
                          <div className='text-[0.66rem] font-bold uppercase tracking-[0.2em] text-slate-400'>Benchmarks</div>
                          <div className='mt-3 flex flex-wrap gap-2'>
                            {benchmarks.map((item) => (
                              <span
                                key={item}
                                className='rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[0.72rem] font-semibold text-slate-600'
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className='mt-8 flex border-t border-slate-100 pt-6'>
                    <button
                      type='button'
                      onClick={() => onOpenPaper(paper)}
                      className='inline-flex w-full items-center justify-center gap-2 rounded-[1.35rem] border border-slate-200 bg-white px-5 py-3.5 text-[0.76rem] font-bold uppercase tracking-[0.22em] text-slate-800 transition hover:border-indigo-500 hover:bg-indigo-600 hover:text-white'
                    >
                      Explore manuscript
                      <ArrowRight className='h-4 w-4' />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
