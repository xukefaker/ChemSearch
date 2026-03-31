'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

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

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className={`fixed inset-0 z-[100] flex items-center ${alignmentClassName} p-4 sm:p-6`}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className='absolute inset-0 bg-slate-900/40 backdrop-blur-sm'
          />

          {/* Modal Content */}
          <motion.section
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`relative z-10 w-full max-w-4xl max-h-[90vh] flex flex-col bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200/50 ${widthClassName || ''}`}
          >
            <header className='px-8 py-6 border-b border-slate-100 flex items-start justify-between gap-6 bg-white/80 backdrop-blur-md sticky top-0 z-20'>
              <div className='min-w-0'>
                <div className='text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-1.5'>Paper Analytics</div>
                <h2 className='text-xl font-extrabold text-slate-900 leading-tight'>{title}</h2>
                {description && <p className='mt-2 text-sm font-medium text-slate-400'>{description}</p>}
              </div>
              <button
                onClick={onClose}
                className='w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-all flex-shrink-0'
              >
                <X className='w-5 h-5' />
              </button>
            </header>

            <div className='flex-1 overflow-y-auto px-8 py-8 custom-scrollbar'>
              {children}
            </div>

            <footer className='px-8 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-end'>
               <button 
                 onClick={onClose}
                 className='px-6 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-indigo-600 transition-all'
               >
                 Close Detail
               </button>
            </footer>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}
