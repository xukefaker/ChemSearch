'use client';

import { useState, useRef, useEffect } from 'react';
import { OverlayPanel } from '@/components/overlay-panel';
import { bucketLabel } from '@/lib/presentation';
import type { PaperResult, PaperChatCitation } from '@/lib/types';
import { chatWithPaper } from '@/lib/client-api';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Quote, BookOpen, SearchCode, Info } from 'lucide-react';
import Zoom from 'react-medium-image-zoom';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

type PaperDetailDrawerProps = {
  paper: PaperResult | null;
  open: boolean;
  onClose: () => void;
  onOpenTrace: () => void;
};

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  citations?: PaperChatCitation[];
};

export function PaperDetailDrawer({ paper, open, onClose, onOpenTrace }: PaperDetailDrawerProps) {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'chat'>('details');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setChatHistory([]);
      setActiveTab('details');
    }
  }, [open, paper]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isTyping]);

  if (!paper) return null;

  const handleSendMessage = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg: ChatMessage = { role: 'user', content: input };
    setChatHistory((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await chatWithPaper({
        paper_id: paper.paper_id,
        query: input,
        history: chatHistory.slice(-4),
      });

      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', content: response.answer, citations: response.citations },
      ]);
    } catch {
      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I failed to analyze the paper details. Server might be busy.' },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const evidenceGroups = Object.entries(paper.evidence_chunks).filter(([, chunks]) => chunks.length > 0);

  // 预处理器：拦截纯文本的 [1] 并转换为 Markdown Link 格式 [[1]](#cite-1)
  const processMessageContent = (content: string) => {
    // 正则解释：查找 [数字]，且前面不是 [，后面不是 (，避免破坏已有的 Markdown Link
    return content.replace(/(?<!\[)\[(\d+)\](?!\()/g, '[[$1]](#cite-$1)');
  };

  return (
    <OverlayPanel
      open={open}
      title={paper.title}
      description={`${paper.venue.toUpperCase()} ${paper.year} · ${paper.paper_id}`}
      onClose={onClose}
    >
      <div className="flex flex-col h-full min-h-[600px]">
        {/* Tab 控制器 */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl mb-8 w-fit self-center shadow-inner">
           <button 
             onClick={() => setActiveTab('details')}
             className={`px-6 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${activeTab === 'details' ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] text-indigo-600' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}
           >
             Paper Overview
           </button>
           <button 
             onClick={() => setActiveTab('chat')}
             className={`px-6 py-2 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'chat' ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] text-indigo-600' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}
           >
             Deep Chat
             <Sparkles className="w-3.5 h-3.5" />
           </button>
        </div>

        <div className="flex-1 overflow-visible relative">
          <AnimatePresence mode="wait">
            {activeTab === 'details' ? (
              <motion.div 
                key="details"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="space-y-10 pb-4"
              >
                {/* Mineru 图片 Lightbox 放大部分 */}
                {paper.main_image_url && (
                  <section className="rounded-3xl overflow-hidden border border-slate-200/60 shadow-lg group relative">
                     <div className="bg-white/80 backdrop-blur-md px-5 py-3 border-b border-slate-100/50 flex items-center justify-between absolute top-0 w-full z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                           <SearchCode className="w-3 h-3 text-indigo-500" />
                           Mineru Visual Extraction
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Click to zoom</span>
                     </div>
                     <Zoom>
                        <img 
                          src={paper.main_image_url} 
                          alt="Paper Key Figure" 
                          className="w-full h-auto object-contain bg-[#f8f9fa] cursor-zoom-in hover:opacity-95 transition-opacity" 
                        />
                     </Zoom>
                  </section>
                )}

                {/* 核心理由 & 评分 */}
                <section className="relative p-7 rounded-[2rem] bg-indigo-50/50 border border-indigo-100/50">
                  <div className="absolute -top-3 -left-3 w-10 h-10 bg-white rounded-2xl shadow-sm border border-indigo-50 flex items-center justify-center transform -rotate-6">
                     <Quote className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="ml-4 mb-3">
                     <span className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em]">Relevance Rationale</span>
                  </div>
                  <div className="prose prose-sm prose-slate prose-indigo max-w-none prose-p:leading-relaxed prose-p:text-[15px] prose-p:font-medium prose-p:text-slate-700 ml-4">
                     <ReactMarkdown>{paper.rationale}</ReactMarkdown>
                  </div>
                </section>

                {/* 证据区块 */}
                <section className="space-y-6">
                   <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <h3 className="text-[13px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-slate-400" />
                        Retrieved Evidence
                      </h3>
                      <button onClick={onOpenTrace} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider transition-colors">Trace Internal Query</button>
                   </div>

                   <div className="grid gap-6">
                     {evidenceGroups.map(([bucketId, chunks]) => (
                       <div key={bucketId} className="space-y-4">
                          <div className="text-[11px] font-bold text-slate-500 bg-slate-100/60 px-3 py-1.5 rounded-lg w-fit border border-slate-200/40 uppercase tracking-widest">{bucketLabel(bucketId)}</div>
                          {chunks.map((chunk) => (
                            <div key={chunk.chunk_id} className="p-6 rounded-[1.5rem] bg-white border border-slate-200/60 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-md transition-all group relative overflow-hidden">
                               <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-400 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                               <div className="prose prose-sm prose-slate max-w-none text-[14.5px] leading-[1.8] text-slate-600 font-serif">
                                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{chunk.text}</ReactMarkdown>
                               </div>
                               <div className="mt-5 pt-4 border-t border-slate-50 flex justify-between items-center text-[10px] font-bold text-slate-400 italic uppercase tracking-wider">
                                  <span className="flex items-center gap-1"><Info className="w-3 h-3" /> Score: {chunk.score.toFixed(3)}</span>
                                  <span className="text-indigo-500/80">p.{chunk.page_start} — {chunk.heading}</span>
                               </div>
                            </div>
                          ))}
                       </div>
                     ))}
                   </div>
                </section>
              </motion.div>
            ) : (
              <motion.div 
                key="chat"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="flex flex-col h-full max-h-[72vh]"
              >
                {/* 对话消息列表 */}
                <div className="flex-1 overflow-y-auto space-y-6 pr-3 mb-4 min-h-[400px] custom-scrollbar pb-10">
                  {chatHistory.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-5 opacity-60">
                       <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center shadow-inner border border-slate-100">
                          <Sparkles className="w-8 h-8 text-indigo-400" />
                       </div>
                       <div className="text-sm font-black text-slate-500 uppercase tracking-[0.2em]">Deep Interrogation</div>
                       <p className="text-[14px] text-slate-500 max-w-[300px] leading-relaxed">Ask highly specific questions about methodologies, datasets, or architectural details.</p>
                       <div className="flex gap-2 mt-4">
                          <span className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-widest border border-slate-200/50">Math Supported</span>
                          <span className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-widest border border-slate-200/50">Markdown Ready</span>
                       </div>
                    </div>
                  )}

                  {chatHistory.map((msg, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                       <div className={`max-w-[92%] px-6 py-5 rounded-[1.8rem] shadow-sm ${
                         msg.role === 'user' 
                         ? 'bg-indigo-600 text-white font-medium shadow-indigo-200 rounded-br-sm' 
                         : 'bg-white border border-slate-200/80 text-slate-800 rounded-bl-sm'
                       }`}>
                          <div className={`prose max-w-none ${msg.role === 'user' ? 'prose-invert prose-p:text-white' : 'prose-slate prose-indigo'} 
                            prose-sm leading-relaxed
                            prose-headings:font-bold prose-headings:tracking-tight
                            prose-pre:bg-slate-50 prose-pre:border prose-pre:border-slate-200 prose-pre:text-slate-800 prose-code:text-indigo-600
                            prose-p:text-[15px] prose-li:text-[15px]`}
                          >
                             <ReactMarkdown 
                               remarkPlugins={[remarkGfm, remarkMath]} 
                               rehypePlugins={[rehypeKatex]}
                               components={{
                                 // 纯 CSS 的内联引用魔法弹窗 (Inline Popover)
                                 a({ href, children, ...props }) {
                                   const text = String(children);
                                   const match = href?.match(/^#cite-(\d+)$/);
                                   
                                   if (match && msg.citations) {
                                      const citationIndex = parseInt(match[1]) - 1;
                                      const cite = msg.citations[citationIndex];
                                      
                                      if (cite) {
                                        return (
                                          <span className="relative inline-block group cursor-help mx-0.5">
                                            {/* 引用锚点按钮 */}
                                            <span className="inline-flex items-center justify-center text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-sm align-super group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-sm">
                                              {text}
                                            </span>
                                            {/* 悬停弹出的 Snippet 浮窗 */}
                                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-4 bg-white rounded-2xl shadow-2xl border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[100] pointer-events-none">
                                              <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-50 pb-1.5 flex justify-between items-center">
                                                Source Snippet
                                                <span className="bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded shadow-sm">p.{cite.page_start}</span>
                                              </span>
                                              <span className="block text-[12.5px] leading-relaxed text-slate-600 font-serif italic text-left">
                                                &ldquo;{cite.snippet}&rdquo;
                                              </span>
                                              {/* 向下的小箭头 */}
                                              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-b border-r border-slate-100 transform rotate-45" />
                                            </span>
                                          </span>
                                        );
                                      }
                                   }
                                   return <a href={href} className="text-indigo-600 hover:underline" {...props}>{children}</a>;
                                 }
                               }}
                             >
                               {/* 这里调用预处理器拦截纯文本 [1] */}
                               {msg.role === 'assistant' ? processMessageContent(msg.content) : msg.content}
                             </ReactMarkdown>
                          </div>
                          
                          {/* 底部完整引用列表 - 作为参考目录 */}
                          {msg.citations && msg.citations.length > 0 && (
                            <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">
                               <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-1.5">
                                 <BookOpen className="w-3 h-3" />
                                 Full Reference List
                               </div>
                               <div className="grid gap-2">
                                 {msg.citations.map((cite, ci) => (
                                   <div key={ci} className="group flex gap-3 text-[12px] bg-slate-50/50 border border-slate-200/50 p-3 rounded-xl text-slate-600 leading-relaxed hover:bg-white hover:border-indigo-200 hover:shadow-sm transition-all">
                                      <div className="inline-flex items-center justify-center text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-sm h-fit shadow-sm">
                                        [{ci + 1}]
                                      </div>
                                      <div>
                                        <span className="font-serif italic">&ldquo;{cite.snippet.slice(0, 180)}...&rdquo;</span> 
                                        <span className="ml-2 font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] shadow-sm">p.{cite.page_start}</span>
                                      </div>
                                   </div>
                                 ))}
                               </div>
                            </div>
                          )}
                       </div>
                    </motion.div>
                  ))}
                  
                  {/* 骨架屏 (Skeleton Loading) */}
                  {isTyping && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-start"
                    >
                       <div className="bg-white border border-slate-200/60 p-6 rounded-[1.8rem] rounded-bl-sm shadow-sm w-full max-w-[85%]">
                          <div className="flex items-center gap-3 mb-4">
                             <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                             <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Synthesizing Answer</span>
                          </div>
                          <div className="space-y-3">
                            <div className="h-2.5 bg-slate-100 rounded-full w-3/4 animate-pulse" />
                            <div className="h-2.5 bg-slate-100 rounded-full w-full animate-pulse animation-delay-150" />
                            <div className="h-2.5 bg-slate-100 rounded-full w-5/6 animate-pulse animation-delay-300" />
                          </div>
                       </div>
                    </motion.div>
                  )}
                  <div ref={scrollRef} />
                </div>

                {/* 输入框 */}
                <div className="relative mt-auto pt-3 bg-white border-t border-slate-50">
                   <input 
                     type="text" 
                     value={input}
                     onChange={(e) => setInput(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                     placeholder="E.g., What is the main objective function used in this model?"
                     className="w-full pl-6 pr-14 py-4.5 rounded-[2rem] bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 text-[15px] placeholder:text-slate-400 outline-none transition-all shadow-inner"
                   />
                   <button 
                     disabled={isTyping || !input.trim()}
                     onClick={handleSendMessage}
                     className="absolute right-2.5 top-2.5 w-11 h-11 bg-slate-900 rounded-full flex items-center justify-center text-white hover:bg-indigo-600 disabled:bg-slate-200 disabled:text-slate-400 transition-all active:scale-95 shadow-md"
                   >
                     <Send className="w-4.5 h-4.5" />
                   </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </OverlayPanel>
  );
}
