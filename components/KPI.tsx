
import React, { useState, useEffect, useMemo } from 'react';
import { User, ProductionBatch, RequestPart, INITIAL_CAR_MODELS, INITIAL_COLORS } from '../types';
import { db } from '../services/supabaseService';
import { ArrowLeft, Megaphone, Users, Wrench, Clock, AlertTriangle, Activity, Zap, Plus, Layers, Edit3, Trash2, Minus, X, Send, Save } from 'lucide-react';

interface Props {
  user: User;
  onBack: () => void;
}

export default function KPI({ user, onBack }: Props) {
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [allRequests, setAllRequests] = useState<RequestPart[]>([]);
  const [reworkers, setReworkers] = useState<User[]>([]);
  const [fastRepairCount, setFastRepairCount] = useState(0);
  const [boxRepairCount, setBoxRepairCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Batch Form
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchForm, setBatchForm] = useState<Partial<ProductionBatch>>({
    name: '', line: 'B-Line', models: [], colors: {}, status: 'UPCOMING'
  });
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);

  // Broadcast
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastLine, setBroadcastLine] = useState<'B-Line' | 'P-Line'>('B-Line');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastDuration, setBroadcastDuration] = useState('10');

  useEffect(() => {
    const fetch = async () => {
      const [b, r, u, rw, fv, spots] = await Promise.all([
        db.getBatches(), db.getRequests(), db.getUsers(), db.getReworks(), db.getVehicles(), db.getSpots('BOX_REPAIR')
      ]);
      setBatches(b);
      setAllRequests(r);
      setReworkers(u.filter(usr => usr.role === 'Reworker' && usr.reworkerStatus === 'ONLINE'));
      setFastRepairCount(fv.filter(v => v.status === 'FAST REPAIR').length);
      setBoxRepairCount(spots.filter(s => s.vin !== null).length);
    };
    fetch();
    const interval = setInterval(fetch, 5000);
    const clock = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => { clearInterval(interval); clearInterval(clock); };
  }, []);

  const handleSaveBatch = async () => {
    if (!batchForm.name) return alert("Enter batch name.");
    const qty = Object.values(batchForm.colors || {}).reduce((a: number, b: number) => a + b, 0);
    if (qty === 0) return alert("Total quantity must be > 0.");

    if (editingBatchId) {
      await db.updateBatch(editingBatchId, batchForm);
    } else {
      await db.addBatch({
        ...batchForm,
        id: `batch-${Date.now()}`,
        totalQty: qty,
        createdAt: new Date().toISOString()
      } as ProductionBatch, user.fullName);
    }
    setShowBatchModal(false);
    setEditingBatchId(null);
  };

  const handleDecrement = async (batchId: string, color: string) => {
    await db.decrementBatchQty(batchId, color);
  };

  const handleIncrement = async (batchId: string, color: string) => {
    await db.incrementBatchQty(batchId, color);
  };

  const handleBroadcast = async () => {
    if(!broadcastMsg.trim()) return alert("Enter message.");
    await db.setLineMessage(broadcastLine, broadcastMsg, parseInt(broadcastDuration));
    setShowBroadcast(false);
    setBroadcastMsg('');
    alert("Alert deployed to Andon.");
  };

  const pendingRequests = allRequests.filter(req => req.status === 'PENDING');

  return (
    <div className="flex flex-col min-h-screen pb-10 gap-6">
       {pendingRequests.length > 0 && (
          <div className="bg-red-600/10 border-2 border-red-600 rounded-2xl h-16 flex items-center shadow-[0_0_25px_rgba(239,68,68,0.3)] shrink-0 overflow-hidden">
             <div className="bg-red-600 h-full px-6 flex items-center gap-2 font-black text-white italic shadow-lg">
                <AlertTriangle size={24} /> PENDING REQUESTS ({pendingRequests.length})
             </div>
             <div className="flex-1 px-8 flex items-center gap-8 marquee overflow-hidden">
                {pendingRequests.map(req => (
                   <span key={req.id} className="text-red-500 font-black whitespace-nowrap uppercase tracking-tighter text-lg">{req.partName} - {req.line || req.vin?.slice(-6)}</span>
                ))}
             </div>
          </div>
       )}

       <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition active:scale-95 shadow-lg"><ArrowLeft /></button>
                <h2 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">Production KPI</h2>
            </div>
            <button onClick={() => setShowBroadcast(true)} className="bg-red-600 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl hover:bg-red-700 transition-all active:scale-95">
              <Megaphone size={18} /> Broadcast Alert
            </button>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             {['B-Line', 'P-Line'].map(line => {
                const active = batches.find(b => b.line === line && b.status === 'ACTIVE');
                const queue = batches.filter(b => b.line === line && b.status === 'UPCOMING')
                                    .sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                const colorAccent = line === 'B-Line' ? 'text-green-500' : 'text-blue-500';
                return (
                   <div key={line} className={`bg-slate-900 border border-slate-800/50 p-8 rounded-[2.5rem] flex flex-col gap-6 shadow-2xl relative overflow-hidden`}>
                      <div className="absolute top-0 right-0 p-8 text-slate-800 opacity-10 pointer-events-none"><Activity size={100} /></div>
                      <div className="flex justify-between items-center z-10">
                        <h3 className="text-4xl font-black text-white tracking-tighter uppercase">{line}</h3>
                        <button onClick={() => { setEditingBatchId(null); setBatchForm({ name:'', line: line as any, models:[], colors:{}, status:'UPCOMING' }); setShowBatchModal(true); }} className="bg-blue-600 p-3 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2">
                           <Plus size={20} /> New Batch
                        </button>
                      </div>
                      
                      <div className="flex-1 space-y-4 z-10">
                         {active ? (
                            <div className="bg-slate-950/40 p-6 rounded-3xl border border-slate-800/50 shadow-inner">
                               <div className="flex justify-between items-start">
                                  <div>
                                     <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Active Batch</span>
                                     <div className="text-3xl font-black text-white uppercase truncate drop-shadow-md">{active.name}</div>
                                  </div>
                                  <div className={`text-6xl font-mono font-black ${colorAccent}`}>{active.totalQty}</div>
                               </div>
                               <div className="grid grid-cols-2 gap-3 mt-4 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                  {Object.entries(active.colors).filter(([_,v]) => (v as number) > 0).map(([color, qty]) => (
                                     <div key={color} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex justify-between items-center group hover:border-slate-600 transition-all shadow-md">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-tight truncate w-24">{color}</span>
                                            <span className="text-2xl font-mono font-black text-white">{qty as number}</span>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button onClick={() => handleDecrement(active.id, color)} className="p-2 bg-red-600/10 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm">
                                            <Minus size={16} />
                                          </button>
                                          <button onClick={() => handleIncrement(active.id, color)} className="p-2 bg-green-600/10 text-green-500 rounded-xl hover:bg-green-600 hover:text-white transition-all shadow-sm">
                                            <Plus size={16} />
                                          </button>
                                        </div>
                                     </div>
                                  ))}
                               </div>
                               <button onClick={() => { setEditingBatchId(active.id); setBatchForm({...active}); setShowBatchModal(true); }} className="mt-4 w-full py-3 bg-slate-800 rounded-xl text-xs font-bold uppercase hover:bg-slate-700 transition-all border border-slate-700 tracking-widest">Edit Batch Info</button>
                            </div>
                         ) : <div className="text-center py-20 opacity-30 italic font-black uppercase tracking-widest text-2xl">Standby</div>}
                         
                         {queue.length > 0 && (
                           <div className="mt-4">
                              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest px-2">Upcoming Queue ({queue.length})</span>
                              <div className="space-y-2 mt-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                                 {queue.map(q => (
                                    <div key={q.id} className="flex flex-col bg-slate-800/40 p-4 rounded-2xl border border-slate-700 gap-2 hover:bg-slate-800/60 transition-all shadow-sm">
                                       <div className="flex justify-between items-center">
                                         <span className="font-black text-slate-200 uppercase tracking-tight truncate max-w-[60%]">{q.name}</span>
                                         <div className="flex items-center gap-3">
                                            <span className="font-mono text-slate-400 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-700">{q.totalQty}</span>
                                            <button onClick={() => { setEditingBatchId(q.id); setBatchForm({...q}); setShowBatchModal(true); }} className="text-blue-500 hover:text-blue-400 transition-colors"><Edit3 size={16}/></button>
                                            <button onClick={() => { if(confirm("Remove from queue?")) db.deleteBatch(q.id) }} className="text-red-500 hover:text-red-400 transition-colors"><Trash2 size={16}/></button>
                                         </div>
                                       </div>
                                       <div className="flex flex-wrap gap-1.5 mt-1">
                                          {Object.entries(q.colors).filter(([_,v]) => (v as number) > 0).map(([k,v]) => (
                                             <span key={k} className="text-[9px] bg-slate-900/60 px-2 py-0.5 rounded-lg border border-slate-700/50 text-slate-400 font-bold uppercase tracking-tighter">
                                               {k}: {v as number}
                                             </span>
                                          ))}
                                       </div>
                                    </div>
                                 ))}
                              </div>
                           </div>
                         )}
                      </div>
                   </div>
                );
             })}
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl flex items-center gap-4 hover:border-orange-500/30 transition-all">
             <div className="p-4 bg-orange-600/20 text-orange-500 rounded-2xl"><Wrench size={32} /></div>
             <div><p className="text-xs text-slate-500 uppercase font-black tracking-widest">Box Repair</p><h4 className="text-3xl font-black text-white">{boxRepairCount}</h4></div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl flex items-center gap-4 hover:border-yellow-500/30 transition-all">
             <div className="p-4 bg-yellow-600/20 text-yellow-500 rounded-2xl"><Zap size={32} /></div>
             <div><p className="text-xs text-slate-500 uppercase font-black tracking-widest">Fast Repair</p><h4 className="text-3xl font-black text-white">{fastRepairCount}</h4></div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl flex items-center gap-4 hover:border-blue-500/30 transition-all">
             <div className="p-4 bg-blue-600/20 text-blue-500 rounded-2xl"><Users size={32} /></div>
             <div><p className="text-xs text-slate-500 uppercase font-black tracking-widest">Reworkers</p><h4 className="text-3xl font-black text-white">{reworkers.length}</h4></div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl flex items-center gap-4 hover:border-purple-500/30 transition-all">
             <div className="p-4 bg-purple-600/20 text-purple-500 rounded-2xl"><Layers size={32} /></div>
             <div><p className="text-xs text-slate-500 uppercase font-black tracking-widest">Pending Parts</p><h4 className="text-3xl font-black text-white">{pendingRequests.length}</h4></div>
          </div>
       </div>

       {showBatchModal && (
          <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
             <div className="bg-slate-900 border border-slate-700 p-8 rounded-[3rem] w-full max-w-2xl shadow-2xl space-y-6 overflow-y-auto max-h-[90vh] custom-scrollbar">
                <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                   <h3 className="text-2xl font-black uppercase text-blue-500 tracking-tighter">{editingBatchId ? 'Edit' : 'Create'} Production Batch</h3>
                   <button onClick={() => setShowBatchModal(false)} className="text-slate-500 hover:text-white transition-colors"><X size={32}/></button>
                </div>
                <div className="grid grid-cols-2 gap-8">
                   <div className="space-y-6">
                      <div>
                         <label className="text-[10px] text-slate-500 font-black uppercase mb-1 block tracking-widest">Batch Identification</label>
                         <input className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl outline-none focus:border-blue-500 transition-all text-white font-bold" value={batchForm.name} onChange={e => setBatchForm({...batchForm, name: e.target.value})} placeholder="Batch ID..." />
                      </div>
                      <div>
                         <label className="text-[10px] text-slate-500 font-black uppercase mb-1 block tracking-widest">Target Line</label>
                         <select disabled={!!editingBatchId} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl outline-none focus:border-blue-500 transition-all text-white font-bold" value={batchForm.line} onChange={e => setBatchForm({...batchForm, line: e.target.value as any})}>
                            <option value="B-Line">B-Line</option>
                            <option value="P-Line">P-Line</option>
                         </select>
                      </div>
                      <div>
                         <label className="text-[10px] text-slate-500 font-black uppercase mb-1 block tracking-widest">Initial Status</label>
                         <select className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl outline-none focus:border-blue-500 transition-all text-white font-bold" value={batchForm.status} onChange={e => setBatchForm({...batchForm, status: e.target.value as any})}>
                            <option value="ACTIVE">ACTIVE NOW</option>
                            <option value="UPCOMING">IN QUEUE</option>
                         </select>
                      </div>
                   </div>
                   <div className="space-y-4">
                      <label className="text-[10px] text-slate-500 font-black uppercase block tracking-widest">Unit Breakdown by Color</label>
                      <div className="space-y-2 h-[320px] overflow-y-auto pr-2 custom-scrollbar bg-slate-950/50 p-3 rounded-2xl border border-slate-800">
                         {INITIAL_COLORS.map(color => (
                            <div key={color} className="flex items-center gap-3 bg-slate-900 p-2.5 rounded-xl border border-slate-800 hover:border-slate-700 transition-all">
                               <span className="text-[10px] font-black flex-1 truncate text-slate-300 uppercase">{color}</span>
                               <div className="flex items-center gap-2">
                                  <button onClick={() => setBatchForm({...batchForm, colors: {...(batchForm.colors || {}), [color]: Math.max(0, (batchForm.colors?.[color] || 0) - 1)}})} className="p-1 bg-slate-800 rounded-lg text-slate-500 hover:text-red-500 transition-colors"><Minus size={14}/></button>
                                  <input type="number" className="w-14 bg-slate-950 border border-slate-800 p-1.5 rounded-lg text-center font-mono font-bold text-white text-sm" value={batchForm.colors?.[color] || 0} onChange={e => setBatchForm({...batchForm, colors: {...(batchForm.colors || {}), [color]: Math.max(0, parseInt(e.target.value) || 0)}})} />
                                  <button onClick={() => setBatchForm({...batchForm, colors: {...(batchForm.colors || {}), [color]: (batchForm.colors?.[color] || 0) + 1}})} className="p-1 bg-slate-800 rounded-lg text-slate-500 hover:text-green-500 transition-colors"><Plus size={14}/></button>
                               </div>
                            </div>
                         ))}
                      </div>
                   </div>
                </div>
                <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                   <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 uppercase font-black">Total Payload</span>
                      <span className="text-3xl font-mono font-black text-blue-500">{Object.values(batchForm.colors || {}).reduce((a, b) => (a as number) + (b as number), 0)}</span>
                   </div>
                   <button onClick={handleSaveBatch} className="bg-blue-600 px-12 py-5 rounded-2xl font-black uppercase text-sm tracking-widest shadow-2xl hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-3">
                      <Save size={20} /> {editingBatchId ? 'Update Batch' : 'Finalize Planning'}
                   </button>
                </div>
             </div>
          </div>
       )}

       {showBroadcast && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-4 backdrop-blur-md">
             <div className="bg-slate-900 border border-slate-700 p-8 rounded-[3rem] w-full max-w-sm shadow-2xl space-y-6">
                <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                  <h3 className="text-xl font-black uppercase text-red-500 tracking-widest">Andon Broadcast</h3>
                  <button onClick={() => setShowBroadcast(false)} className="text-slate-500 hover:text-white transition-colors"><X size={24}/></button>
                </div>
                <div className="space-y-5">
                   <div>
                     <label className="text-[10px] text-slate-500 font-black uppercase mb-1 block">Target Display</label>
                     <select className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl outline-none focus:border-red-500 transition-all font-bold" value={broadcastLine} onChange={e => setBroadcastLine(e.target.value as any)}>
                        <option value="B-Line">B-Line</option>
                        <option value="P-Line">P-Line</option>
                     </select>
                   </div>
                   <div>
                     <label className="text-[10px] text-slate-500 font-black uppercase mb-1 block">Emergency Message</label>
                     <textarea className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl outline-none h-32 focus:border-red-500 transition-all text-white" placeholder="Type message..." value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} />
                   </div>
                   <div>
                     <label className="text-[10px] text-slate-500 font-black uppercase mb-1 block">Banner Duration (Minutes)</label>
                     <input type="number" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl outline-none focus:border-red-500 transition-all font-mono font-bold" value={broadcastDuration} onChange={e => setBroadcastDuration(e.target.value)} placeholder="Duration..." min="1" />
                   </div>
                </div>
                <button onClick={handleBroadcast} className="w-full bg-red-600 py-4 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl hover:bg-red-700 transition-all active:scale-95 uppercase text-sm tracking-widest">
                   <Send size={18} /> Deploy Alert
                </button>
             </div>
          </div>
       )}
    </div>
  );
}
