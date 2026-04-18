import { PaperResultCard } from '@/components/paper-result-card';
import { useSequencedReveal } from '@/lib/animation/use-sequenced-reveal';
import type { PaperResult } from '@/lib/types';

type PaperResultListProps = {
  papers: PaperResult[];
  emptyMessage: string;
  onOpenPaper: (paper: PaperResult) => void;
};

export function PaperResultList({
  papers,
  emptyMessage,
  onOpenPaper,
}: PaperResultListProps) {
  const scope = useSequencedReveal([papers.map((paper) => paper.paper_id).join('|')]);

  if (papers.length === 0) {
    return (
      <div className='psa-fade-up-enter rounded-[1.4rem] border border-dashed border-black/10 bg-white/70 px-5 py-6 text-sm text-slate-500'>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div ref={scope} className='grid grid-cols-1 gap-6'>
      {papers.map((paper) => (
        <div key={paper.paper_id} data-reveal-item>
          <PaperResultCard
            paper={paper}
            onOpenPaper={onOpenPaper}
          />
        </div>
      ))}
    </div>
  );
}
