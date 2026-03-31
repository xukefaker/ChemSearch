'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Search, Sparkles } from 'lucide-react';

import { GlobalSearchPalette } from '@/components/global-search-palette';
import { PaperResultCard, PaperResultCardSkeleton } from '@/components/paper-result-card';
import { QuickPeekPanel } from '@/components/quick-peek-panel';
import { SplitPaneWorkspace } from '@/components/split-pane-workspace';
import { createSearchJob, fetchSearchJob, fetchSearchJobResult } from '@/lib/client-api';
import type { PaperChatCitation, PaperResult, SearchJobProgress, SearchJobStatus } from '@/lib/types';

type SearchMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'search_results';
  results?: PaperResult[];
  status?: 'loading' | 'completed' | 'error';
  currentStage?: string;
  stageMessage?: string;
  progress?: SearchJobProgress | null;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  citations?: PaperChatCitation[];
};

const SAMPLE_QUERIES = [
  'Find ACL 2024 long papers that run experiments on the MATH dataset.',
  'Find ACL 2024 long papers that introduce a new benchmark or evaluation suite.',
  'Find ACL 2024 long papers that compare multi-agent systems against single-agent baselines.',
];

const QUERY_SUGGESTION_GROUPS = [
  {
    label: 'Dataset / Benchmark',
    items: [
      'Find ACL 2024 long papers that evaluate on the GAIA benchmark.',
      'Find ACL 2024 long papers that introduce a new benchmark or evaluation suite.',
      'Find ACL 2024 long papers that report experiments on the MATH dataset.',
    ],
  },
  {
    label: 'Method / Evaluation',
    items: [
      'Find ACL 2024 long papers that compare multi-agent systems against single-agent baselines.',
      'Find ACL 2024 long papers that study reasoning or deliberation strategies.',
      'Find ACL 2024 long papers that report ablations for routing or planning modules.',
    ],
  },
] as const;

const SKELETON_VARIANTS = ['tall', 'balanced', 'compact', 'balanced', 'tall', 'compact'] as const;

const SEARCH_STAGE_SEQUENCE = [
  { id: 'loading_index', short: 'Index', label: 'Load offline indexes' },
  { id: 'planning_query', short: 'Plan', label: 'Parse the query' },
  { id: 'candidate_generation', short: 'Recall', label: 'Generate candidate papers' },
  { id: 'section_narrowing', short: 'Sections', label: 'Narrow to relevant sections' },
  { id: 'evidence_assembly', short: 'Evidence', label: 'Assemble evidence packs' },
  { id: 'final_verifier', short: 'Verify', label: 'Run the final verifier' },
  { id: 'saving_trace', short: 'Save', label: 'Persist the trace' },
] as const;

const SEARCH_STAGE_META = Object.fromEntries(
  SEARCH_STAGE_SEQUENCE.map((stage) => [stage.id, stage]),
) as Record<string, (typeof SEARCH_STAGE_SEQUENCE)[number]>;

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function getStageMeta(stage: string | undefined) {
  if (!stage) {
    return null;
  }
  return SEARCH_STAGE_META[stage] ?? null;
}

function formatProgressDetail(stage: string | undefined, progress: SearchJobProgress | null | undefined): string | null {
  if (!progress) {
    return null;
  }

  const completed = progress.completed_items;
  const total = progress.total_items;
  if (completed != null && total != null && total > 0) {
    if (stage === 'section_narrowing') {
      return `${completed} / ${total} candidate papers narrowed to relevant sections`;
    }
    if (stage === 'evidence_assembly') {
      return `${completed} / ${total} candidate papers assembled into evidence packs`;
    }
    if (stage === 'final_verifier') {
      return `${completed} / ${total} candidate papers verified by the final model`;
    }
  }

  if (progress.stage_index > 0 && progress.stage_total > 0) {
    return `Stage ${progress.stage_index} of ${progress.stage_total}`;
  }
  return null;
}

function SearchProgressPanel({ message }: { message: SearchMessage }) {
  const progress = message.progress ?? null;
  const stageMeta = getStageMeta(message.currentStage);
  const overallProgressPercent = clampPercentage(Math.round((progress?.overall_progress ?? 0) * 100));
  const detail = formatProgressDetail(message.currentStage, progress);
  const activeStageIndex = progress?.stage_index ?? 0;

  return (
    <div className="mt-6 w-full max-w-[560px] rounded-[1.6rem] border border-indigo-100/90 bg-white/96 p-5 shadow-scholar-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-slate-400">Live pipeline progress</div>
          <div className="mt-2 text-[0.96rem] font-semibold tracking-tight text-slate-900">
            {stageMeta?.label ?? message.stageMessage ?? 'Preparing the search pipeline'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[1.35rem] font-black tracking-tight text-slate-950">{overallProgressPercent}%</div>
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">Overall</div>
        </div>
      </div>

      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#4f46e5_0%,#6366f1_55%,#60a5fa_100%)] transition-[width] duration-500"
          style={{ width: `${overallProgressPercent}%` }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {SEARCH_STAGE_SEQUENCE.map((stage, index) => {
          const stageNumber = index + 1;
          const isCompleted = activeStageIndex > stageNumber || message.status === 'completed';
          const isActive = message.currentStage === stage.id;
          return (
            <div
              key={stage.id}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] transition-colors ${
                isCompleted
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : isActive
                    ? 'border-slate-300 bg-slate-950 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-400'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isCompleted ? 'bg-indigo-500' : isActive ? 'bg-cyan-300' : 'bg-slate-300'
                }`}
              />
              {stage.short}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-2 text-[0.74rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {message.stageMessage || 'Searching'}
      </div>

      {detail ? <div className="mt-2 text-[0.82rem] leading-6 text-slate-500">{detail}</div> : null}
    </div>
  );
}

function SearchSuggestionPanel({
  onSelect,
  variant,
}: {
  onSelect: (query: string) => void;
  variant: 'hero' | 'dock';
}) {
  const compact = variant === 'dock';

  return (
    <div className={`rounded-[1.65rem] border border-white/85 bg-white/92 shadow-scholar-lg backdrop-blur-xl ${
      compact ? 'p-4' : 'p-5'
    }`}>
      <div className='mb-3 flex items-center justify-between gap-3'>
        <div className='text-[0.68rem] font-bold uppercase tracking-[0.22em] text-slate-400'>Query suggestions</div>
        <div className='text-[0.68rem] font-medium text-slate-400'>Click to draft, then edit freely</div>
      </div>

      <div className={`grid gap-3 ${compact ? 'lg:grid-cols-2' : 'md:grid-cols-2'}`}>
        {QUERY_SUGGESTION_GROUPS.map((group) => (
          <div key={group.label} className='rounded-[1.3rem] border border-slate-100 bg-slate-50/80 p-3.5'>
            <div className='mb-3 text-[0.66rem] font-bold uppercase tracking-[0.22em] text-slate-400'>{group.label}</div>
            <div className='flex flex-wrap gap-2'>
              {group.items.map((query) => (
                <button
                  key={query}
                  type='button'
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={() => onSelect(query)}
                  className='rounded-full border border-white/80 bg-white px-3.5 py-2 text-left text-[0.77rem] font-medium leading-5 text-slate-600 shadow-scholar-sm transition hover:border-indigo-200 hover:text-indigo-600'
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SearchResultsSkeletonGrid() {
  return (
    <div className='grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3'>
      {SKELETON_VARIANTS.map((variant, index) => (
        <PaperResultCardSkeleton key={`${variant}-${index}`} variant={variant} />
      ))}
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<SearchMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<PaperResult | null>(null);
  const [previewPaper, setPreviewPaper] = useState<PaperResult | null>(null);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [paletteInput, setPaletteInput] = useState('');
  const [chatSessions, setChatSessions] = useState<Record<string, ChatMessage[]>>({});

  const searchScrollRef = useRef<HTMLElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);
  const pendingSearchScrollTopRef = useRef<number | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composerRegionRef = useRef<HTMLDivElement | null>(null);
  const searchInFlightRef = useRef(false);
  const hasSearchHistory = messages.length > 0;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  useEffect(() => {
    if (selectedPaper) {
      return;
    }

    const pendingScrollTop = pendingSearchScrollTopRef.current;
    if (pendingScrollTop !== null) {
      const frameId = window.requestAnimationFrame(() => {
        searchScrollRef.current?.scrollTo({ top: pendingScrollTop, behavior: 'auto' });
        pendingSearchScrollTopRef.current = null;
        previousMessageCountRef.current = messages.length;
      });
      return () => window.cancelAnimationFrame(frameId);
    }

    if (messages.length > previousMessageCountRef.current && hasSearchHistory) {
      scrollToBottom();
    }
    previousMessageCountRef.current = messages.length;
  }, [hasSearchHistory, messages.length, scrollToBottom, selectedPaper]);

  const activeLoadingMessage = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.status === 'loading') {
        return messages[index];
      }
    }
    return null;
  }, [messages]);

  const openSearchPalette = useCallback((prefill?: string) => {
    const nextValue = prefill ?? input.trim() ?? '';
    setPaletteInput(nextValue);
    setPreviewPaper(null);
    setIsComposerFocused(false);
    setIsPaletteOpen(true);
  }, [input]);

  const closeSearchPalette = useCallback(() => {
    setIsPaletteOpen(false);
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery || searchInFlightRef.current) {
      return;
    }
    searchInFlightRef.current = true;

    const userMessage: SearchMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: normalizedQuery,
    };

    const assistantId = `${Date.now()}-assistant`;
    const loadingMessage: SearchMessage = {
      id: assistantId,
      role: 'assistant',
      content: 'Running evidence-aware scholarly retrieval.',
      status: 'loading',
      currentStage: 'queued',
      stageMessage: 'Submitting the search job.',
      progress: null,
    };

    setMessages((previous) => [...previous, userMessage, loadingMessage]);
    setInput('');
    setIsSearching(true);
    setPreviewPaper(null);

    try {
      const job = await createSearchJob({ query: normalizedQuery, top_k: 15, display_k: 10 });
      let lastStatus: SearchJobStatus = job;

      setMessages((previous) =>
        previous.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                currentStage: job.stage,
                stageMessage: job.message,
                progress: job.progress ?? null,
              }
            : message,
        ),
      );

      while (lastStatus.status !== 'completed' && lastStatus.status !== 'failed') {
        await new Promise((resolve) => setTimeout(resolve, 900));
        lastStatus = await fetchSearchJob(job.job_id);

        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  currentStage: lastStatus.stage,
                  stageMessage: lastStatus.message,
                  progress: lastStatus.progress ?? null,
                }
              : message,
          ),
        );
      }

      if (lastStatus.status === 'completed') {
        const result = await fetchSearchJobResult(job.job_id);
        const displayPapers = result.display_results;

        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: `Search complete. ${displayPapers.length} papers are ready for review.`,
                  status: 'completed',
                  type: 'search_results',
                  results: displayPapers,
                  progress: lastStatus.progress ?? null,
                }
              : message,
          ),
        );
        return;
      }

      throw new Error('Search failed.');
    } catch {
      setMessages((previous) =>
        previous.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: 'The search did not complete successfully.',
                status: 'error',
                progress: null,
              }
            : message,
        ),
      );
    } finally {
      searchInFlightRef.current = false;
      setIsSearching(false);
    }
  }, []);

  const handleGlobalSearchSubmit = useCallback((query: string) => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery || isSearching) {
      return;
    }

    setIsPaletteOpen(false);
    setPaletteInput('');
    setPreviewPaper(null);
    if (selectedPaper) {
      setSelectedPaper(null);
    }
    void handleSearch(normalizedQuery);
  }, [handleSearch, isSearching, selectedPaper]);

  const updateChatSession = useCallback((paperId: string, nextMessages: ChatMessage[]) => {
    setChatSessions((previous) => ({ ...previous, [paperId]: nextMessages }));
  }, []);

  const handleQuickPeek = useCallback((paper: PaperResult) => {
    setPreviewPaper(paper);
  }, []);

  const handleOpenPaper = useCallback((paper: PaperResult) => {
    pendingSearchScrollTopRef.current = searchScrollRef.current?.scrollTop ?? 0;
    setPreviewPaper(null);
    setSelectedPaper(paper);
  }, []);

  const handleBackFromPaper = useCallback(() => {
    setSelectedPaper(null);
  }, []);

  useEffect(() => {
    const handleWindowKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openSearchPalette();
        return;
      }

      if (event.key === 'Escape' && isPaletteOpen) {
        event.preventDefault();
        closeSearchPalette();
      }
    };

    window.addEventListener('keydown', handleWindowKeydown);
    return () => {
      window.removeEventListener('keydown', handleWindowKeydown);
    };
  }, [closeSearchPalette, isPaletteOpen, openSearchPalette]);

  const renderQueryForm = useCallback(
    (variant: 'hero' | 'dock') => {
      const isHero = variant === 'hero';
      const showSuggestions = isComposerFocused && !isSearching;

      return (
        <div
          ref={composerRegionRef}
          onFocusCapture={() => setIsComposerFocused(true)}
          onBlurCapture={(event) => {
            const nextTarget = event.relatedTarget;
            if (nextTarget instanceof Node && composerRegionRef.current?.contains(nextTarget)) {
              return;
            }
            setIsComposerFocused(false);
          }}
          className='w-full space-y-4'
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSearch(input);
            }}
            className={`w-full transition-all duration-300 ${isComposerFocused ? 'relative z-30' : ''}`}
          >
            <div
              className={`relative transition-all duration-300 ${
                isHero
                  ? 'rounded-[2.1rem] border border-white/80 bg-white/84 shadow-scholar-lg backdrop-blur-xl'
                  : 'rounded-[2rem] border border-white/84 bg-white/92 shadow-scholar-lg backdrop-blur-xl'
              } ${
                isComposerFocused
                  ? 'border-indigo-200/90 bg-white shadow-[0_30px_70px_rgba(15,23,42,0.12),0_10px_24px_rgba(79,70,229,0.08)]'
                  : ''
              }`}
            >
              <textarea
                ref={composerTextareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={isSearching}
                rows={isHero ? 4 : 2}
                placeholder='Ask for papers, datasets, methods, or evidence.'
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing) {
                    return;
                  }
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void handleSearch(input);
                  }
                }}
                className={`w-full resize-none rounded-[2rem] border-0 bg-transparent pr-20 text-slate-900 outline-none placeholder:text-slate-400 ${
                  isHero
                    ? 'min-h-[10.5rem] px-7 py-7 text-[1.04rem] leading-8 sm:text-[1.1rem]'
                    : 'min-h-[6.9rem] px-6 py-5 text-[0.98rem] leading-7 sm:text-[1.02rem]'
                }`}
              />
              <button
                type='submit'
                disabled={isSearching || input.trim().length === 0}
                className={`absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full bg-slate-950 text-white transition-all hover:bg-indigo-600 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300 ${
                  isHero ? 'h-12 w-12' : 'h-11 w-11'
                }`}
              >
                {isSearching ? <Loader2 className='h-5 w-5 animate-spin' /> : <Search className='h-5 w-5' />}
              </button>

              {isHero ? (
                <div className='pointer-events-none absolute inset-x-6 bottom-4 flex items-center justify-between text-[0.72rem] font-medium text-slate-400'>
                  <span>Shift + Enter for a new line</span>
                  <span>Evidence-aware search</span>
                </div>
              ) : null}
            </div>
          </form>

          <AnimatePresence initial={false}>
            {showSuggestions ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className={isHero ? 'relative z-30' : 'relative z-30'}
              >
                <SearchSuggestionPanel
                  variant={variant}
                  onSelect={(query) => {
                    setInput(query);
                    composerTextareaRef.current?.focus();
                  }}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      );
    },
    [handleSearch, input, isComposerFocused, isSearching],
  );

  if (selectedPaper) {
    return (
      <div className="h-dvh bg-[#f8fafc]">
        <SplitPaneWorkspace
          key={selectedPaper.paper_id}
          paper={selectedPaper}
          initialChatHistory={chatSessions[selectedPaper.paper_id] || []}
          onChatHistoryUpdate={(nextMessages) => updateChatSession(selectedPaper.paper_id, nextMessages)}
          onBack={handleBackFromPaper}
          onOpenGlobalSearch={() => openSearchPalette()}
        />
        <GlobalSearchPalette
          open={isPaletteOpen}
          value={paletteInput}
          isSearching={isSearching}
          suggestionGroups={QUERY_SUGGESTION_GROUPS}
          onChange={setPaletteInput}
          onClose={closeSearchPalette}
          onSubmit={handleGlobalSearchSubmit}
        />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-transparent text-slate-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-8rem] top-[-9rem] h-[26rem] w-[26rem] rounded-full bg-indigo-200/25 blur-3xl" />
        <div className="absolute right-[-10rem] top-[8rem] h-[30rem] w-[30rem] rounded-full bg-cyan-100/30 blur-3xl" />
        <div className="absolute bottom-[-12rem] left-1/2 h-[26rem] w-[40rem] -translate-x-1/2 rounded-full bg-slate-200/30 blur-3xl" />
      </div>
      <AnimatePresence>
        {isComposerFocused ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='pointer-events-none absolute inset-0 z-20 bg-[linear-gradient(180deg,rgba(15,23,42,0.06),rgba(15,23,42,0.14))] backdrop-blur-[2px]'
          />
        ) : null}
      </AnimatePresence>

      <header className="glass-header sticky top-0 z-40">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-slate-950 shadow-scholar-md">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-[0.95rem] font-black tracking-tight text-slate-950">Scholar Agent</div>
              <div className="text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-slate-400">Neural literature interface</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openSearchPalette()}
            className="inline-flex items-center gap-3 rounded-full border border-white/75 bg-white/80 px-4 py-2 text-[0.72rem] font-bold uppercase tracking-[0.18em] text-slate-600 shadow-scholar-sm backdrop-blur-xl transition hover:border-indigo-200 hover:text-indigo-600"
          >
            <Search className="h-3.5 w-3.5" />
            Search
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.64rem] text-slate-400">
              ⌘K
            </span>
          </button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {!hasSearchHistory ? (
          <motion.main
            key="hero"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="relative z-30 flex flex-1 items-center"
          >
            <div className="mx-auto flex w-full max-w-[1440px] flex-1 items-center px-5 py-10 sm:px-8">
              <section className="mx-auto w-full max-w-[1040px] text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/86 px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.24em] text-indigo-600 shadow-scholar-sm backdrop-blur-xl">
                  <span className="h-2 w-2 rounded-full bg-indigo-500" />
                  Scholar-grade retrieval
                </div>

                <h1 className="mt-8 text-[clamp(3.2rem,8vw,6.4rem)] font-black tracking-[-0.075em] text-slate-950">
                  Search papers with
                  <span className="block text-indigo-600">scholarly precision.</span>
                </h1>

                <p className="font-scholar mx-auto mt-6 max-w-[760px] text-[1.16rem] italic leading-8 text-slate-500 sm:text-[1.32rem]">
                  A cleaner interface for finding relevant papers, opening the right manuscript, and following the evidence all the way into the paper itself.
                </p>

                <div className="mx-auto mt-12 max-w-[900px]">{renderQueryForm('hero')}</div>

                {!isComposerFocused ? (
                  <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                    {SAMPLE_QUERIES.map((query) => (
                      <button
                        key={query}
                        type="button"
                        onClick={() => setInput(query)}
                        className="rounded-full border border-white/70 bg-white/72 px-4 py-2 text-[0.82rem] font-medium text-slate-600 shadow-scholar-sm backdrop-blur-xl transition hover:border-indigo-200 hover:bg-white hover:text-indigo-600"
                      >
                        {query}
                      </button>
                    ))}
                  </div>
                ) : null}
              </section>
            </div>
          </motion.main>
        ) : (
          <motion.div
            key="thread"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="relative z-30 flex flex-1 flex-col"
          >
            <main ref={searchScrollRef} className="custom-scrollbar flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-[1440px] px-5 pb-12 pt-10 sm:px-8">
                <div className="mx-auto max-w-[1220px] space-y-8">
                  {messages.map((message) => (
                    <section
                      key={message.id}
                      className="flex justify-center"
                    >
                      <div className="w-full max-w-[1180px]">
                        <div className="min-w-0 flex-1 space-y-5">
                          <div
                            className={`rounded-[2rem] border px-6 py-5 ${
                              message.role === 'user'
                                ? 'ml-auto w-fit max-w-[min(100%,52rem)] border-slate-200/80 bg-white/86 text-slate-900 shadow-scholar-lg backdrop-blur-xl'
                                : message.type === 'search_results'
                                  ? 'border-transparent bg-transparent px-0 py-0 shadow-none'
                                  : 'mr-auto w-fit max-w-[min(100%,54rem)] border-slate-200/90 bg-white/90 text-slate-700 shadow-scholar-lg backdrop-blur-xl'
                            }`}
                          >
                            {message.type !== 'search_results' ? (
                              <div className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.24em] text-slate-400">
                                {message.role === 'user' ? 'Query' : 'Search system'}
                              </div>
                            ) : null}

                            <div
                              className={`${
                                message.type === 'search_results'
                                  ? 'text-[1.75rem] font-black tracking-tight text-slate-950'
                                  : message.role === 'user'
                                    ? 'font-scholar text-[1.18rem] italic leading-9 text-slate-700'
                                    : 'text-[1rem] leading-8'
                              }`}
                            >
                              {message.content}
                            </div>

                            {message.status === 'loading' ? <SearchProgressPanel message={message} /> : null}
                          </div>

                          {message.status === 'loading' ? <SearchResultsSkeletonGrid /> : null}

                          {message.type === 'search_results' && message.results ? (
                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
                              {message.results.map((paper) => (
                                <PaperResultCard
                                  key={paper.paper_id}
                                  paper={paper}
                                  onOpenPaper={handleOpenPaper}
                                  onQuickPeek={handleQuickPeek}
                                />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </section>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            </main>

            <footer className="glass-header sticky bottom-0 z-30 border-t border-white/70">
              <div className="mx-auto w-full max-w-[1440px] px-5 py-4 sm:px-8">
                <div className="mx-auto max-w-[1080px] space-y-3">
                  {activeLoadingMessage?.stageMessage ? (
                    <div className="text-center text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {activeLoadingMessage.stageMessage}
                      {activeLoadingMessage.progress ? ` • ${clampPercentage(Math.round(activeLoadingMessage.progress.overall_progress * 100))}%` : ''}
                    </div>
                  ) : null}
                  {renderQueryForm('dock')}
                </div>
              </div>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>

      <QuickPeekPanel
        paper={previewPaper}
        onClose={() => setPreviewPaper(null)}
        onOpenPaper={(paper) => handleOpenPaper(paper)}
      />
      <GlobalSearchPalette
        open={isPaletteOpen}
        value={paletteInput}
        isSearching={isSearching}
        suggestionGroups={QUERY_SUGGESTION_GROUPS}
        onChange={setPaletteInput}
        onClose={closeSearchPalette}
        onSubmit={handleGlobalSearchSubmit}
      />
    </div>
  );
}
