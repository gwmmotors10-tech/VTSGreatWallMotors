
import React, { useState, useEffect, useMemo } from 'react';
import { ProductionBatch, LineMessage, User } from '../types';
import { db } from '../services/supabaseService';
import { ArrowLeft, Megaphone, ChevronRight } from 'lucide-react';

interface Props {
  user: User;
  onBack: () => void;
}

export default function Andon({ user, onBack }: Props) {
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [lineMessages, setLineMessages] = useState<LineMessage[]>([]);

  useEffect(() => {
    const fetchData = async () => {
        const [b, lm] = await Promise.all([db.getBatches(), db.getLineMessages()]);
        setBatches(b);
        setLineMessages(lm);
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const activeMessages = useMemo(() => {
    return lineMessages.filter(m => {
        if (!m.message || m.message.trim() === '') return false;
        if (!m.expiresAt) return true;
        return new Date(m.expiresAt).getTime() > Date.now();
    });
  }, [lineMessages]);

  const renderBatchCard = (line: 'B-Line' | 'P-Line', colorTheme: 'green' | 'blue') => {
      const active = batches.find(b => b.line === line && b.status === 'ACTIVE');
      const upcoming = batches
        .filter(b => b.line === line && b.status === 'UPCOMING')
        .sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];

      const textClass = colorTheme === 'green' ? 'text-green-500' : 'text-blue-500';
      const themeClass = colorTheme === 'green' ? 'border-green-500 shadow-green-900/30' : 'border-blue-500 shadow-blue-900/30';

      return (
        <div className={`rounded-[1.5rem] border-2 shadow-2xl bg-slate-900 p-3 flex flex-col h-full ${themeClass} overflow-hidden`}>
            <h3 className={`text-5xl font-black mb-1 ${textClass} tracking-tighter uppercase leading-tight`}>{line}</h3>
            <div className="flex-1 flex flex-col gap-2 min-h-0">
                <div className="bg-slate-950/50 p-3 rounded-[1.2rem] border border-slate-800 shadow-inner flex flex-col flex-1 min-h-0">
                    <div className="text-slate-500 text-[10px] font-black mb-1 uppercase tracking-widest">Current Batch</div>
                    {active ? (
                        <div className="flex flex-col flex-1 min-h-0">
                            <div className="flex justify-between items-end border-b border-slate-800 pb-1 mb-2">
                                <div className="text-white text-3xl font-black truncate max-w-[55%] leading-tight">{active.name}</div>
                                <div className={`text-7xl font-mono font-black ${textClass} leading-none drop-shadow-md`}>{active.totalQty}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                                {Object.entries(active.colors).filter(([_,v]) => (v as number) > 0).map(([k,v]) => (
                                    <div key={k} className="bg-slate-900 p-2 rounded-xl border border-slate-800 flex justify-between items-center shadow-lg hover:border-slate-700 transition-colors">
                                        <span className="text-[10px] font-black text-slate-300 uppercase truncate mr-2 tracking-tight">{k}</span>
                                        <span className="text-4xl font-mono font-black text-white">{v as number}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : <div className="flex-1 flex items-center justify-center text-slate-800 text-4xl font-black italic opacity-20 uppercase tracking-widest">Standby</div>}
                </div>
                {upcoming && (
                    <div className="bg-slate-800/20 p-3 rounded-[1.2rem] border border-slate-700/50 border-dashed h-[25%] shrink-0 flex flex-col justify-center">
                        <div className="text-slate-500 text-[9px] font-black mb-1 uppercase flex items-center gap-2 tracking-widest">
                           <ChevronRight size={12} /> Next
                        </div>
                        <div className="flex justify-between items-center px-2 border-b border-slate-700/30 pb-1">
                           <div className="text-white text-xl font-black truncate">{upcoming.name}</div>
                           <div className="text-3xl font-mono text-slate-500 font-black">{upcoming.totalQty}</div>
                        </div>
                        <div className="flex gap-2 mt-2 px-2 overflow-x-auto no-scrollbar">
                          {Object.entries(upcoming.colors).filter(([_,v]) => (v as number) > 0).map(([k,v]) => (
                             <span key={k} className="bg-slate-900/80 px-2.5 py-1 rounded text-[9px] font-black border border-slate-700 whitespace-nowrap text-slate-400">
                               {k}: {v as number}
                             </span>
                          ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
      );
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 p-3 overflow-hidden">
       <div className="flex items-center gap-3 mb-2 shrink-0">
            <button onClick={onBack} className="p-2 bg-slate-800 rounded-xl hover:bg-slate-700 transition active:scale-95"><ArrowLeft size={20} /></button>
            <h2 className="text-4xl font-black tracking-tighter text-white uppercase leading-none">Andon Monitoring</h2>
       </div>
       {activeMessages.length > 0 && (
           <div className="mb-3 h-20 bg-slate-950 border-[3px] border-red-600 shadow-[0_0_30px_rgba(239,68,68,0.2)] rounded-[1.2rem] flex items-center overflow-hidden shrink-0">
               <div className="bg-red-600 text-white h-full flex items-center px-6 gap-3 font-black text-2xl italic z-20 shadow-[8px_0_15px_rgba(0,0,0,0.5)] uppercase">
                  <Megaphone size={28} className="animate-bounce" /> Alert
               </div>
               <div className="flex-1 flex items-center justify-center px-8">
                   <span className="text-red-600 font-black text-5xl text-center line-clamp-1 uppercase drop-shadow-sm">
                       {activeMessages[0].message}
                   </span>
               </div>
           </div>
       )}
       <div className="flex-1 grid grid-cols-2 gap-3 min-h-0 pb-1">
          {renderBatchCard('B-Line', 'green')}
          {renderBatchCard('P-Line', 'blue')}
       </div>
    </div>
  );
}
