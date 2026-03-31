import { PaperResultCard } from '@/components/paper-result-card';
import type { PaperResult } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';

type PaperResultListProps = {
  papers: PaperResult[];
  emptyMessage: string;
  onOpenPaper: (paper: PaperResult) => void;
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1, // 卡片依次延迟弹出
    }
  }
};

export function PaperResultList({
  papers,
  emptyMessage,
  onOpenPaper,
}: PaperResultListProps) {
  if (papers.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className='rounded-[1.4rem] border border-dashed border-black/10 bg-white/70 px-5 py-6 text-sm text-slate-500'
      >
        {emptyMessage}
      </motion.div>
    );
  }

  return (
    <motion.div 
      variants={container}
      initial='hidden'
      animate='show'
      className='grid grid-cols-1 gap-6' // 如果你想做成两列，可以改为 md:grid-cols-2
    >
      <AnimatePresence>
        {papers.map((paper) => (
          <PaperResultCard
            key={paper.paper_id}
            paper={paper}
            onOpenPaper={onOpenPaper}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
