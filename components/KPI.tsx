
import React, { useState, useEffect, useMemo } from 'react';
import { User, ProductionBatch, RequestPart, ReworkSession, Vehicle, ParkingSpot, INITIAL_COLORS, INITIAL_CAR_MODELS } from '../types';
import { db } from '../services/mockSupabase';
import { 
    ArrowLeft, Megaphone, Users, Wrench, Clock, AlertTriangle, ChevronRight, Activity, Zap, XCircle, Minus, TrendingUp, Send, Plus, Trash2 as TrashIcon, Layers, Settings2, Edit, CheckCircle2, ListOrdered, Play
} from 'lucide-react';

interface Props {
  user: User;
  onBack: () => void;
}

export default function KPI({ user, onBack }: Props) {
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [allRequests, setAllRequests] = useState<RequestPart[]>([]);
  const [reworkers, setReworkers] = useState<User[]>([]);
  const [activeRepairs, setActiveRepairs] = useState<ReworkSession[]>([]);
  const [fastRepairVehicles, setFastRepairVehicles] = useState<Vehicle[]>([]);
  const [boxRepairSpots, setBoxRepairSpots] = useState<ParkingSpot[]>([]);
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  const [showQueue, setShowQueue] = useState<false | 'B-Line' | 'P-Line'>(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const [availableModels, setAvailableModels] = useState<string[]>(INITIAL_CAR_MODELS);
  const [availableColors, setAvailableColors] = useState<string[]>(INITIAL_COLORS);

  const canManageMetadata = user.role === 'Admin' || user.permissions.includes('MANAGE_METADATA');

  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [broadcastLine, setBroadcastLine] = useState<'B-Line' | 'P-Line'>('B-Line');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastDuration, setBroadcastDuration] = useState('10');

  const [isAddBatchOpen, setIsAddBatchOpen] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [batchForm, setBatchForm] = useState({
      name: '',
      line: 'B-Line' as 'B-Line' | 'P-Line',
      status: 'UPCOMING' as 'ACTIVE' | 'UPCOMING',
      models: [] as string[],
      colors: {} as Record<string, number>
  });

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    const clock = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => {
      clearInterval(interval);
      clearInterval(clock);
    };
  }, []);

  const loadData = async () => {
    const [b, r, u, rw, fv, spots, vh] = await Promise.all([
      db.getBatches(),
      db.getRequests(),
      db.getUsers(),
      db.getReworks(),
      db.getVehicles(),
      db.getSpots('BOX_REPAIR'),
      db.getVehicles()
    ]);
    setBatches(b);
    setAllRequests(r);
    setReworkers(u.filter(usr => usr.role === 'Reworker' && usr.reworkerStatus === 'ONLINE'));
    setActiveRepairs(rw.filter(sess => sess.status === 'IN_PROGRESS' || sess.status === 'PAUSED'));
    setFastRepairVehicles(fv.filter(v => v.status === 'FAST REPAIR'));
    setBoxRepairSpots(spots.filter(s => s.vin !== null));
    setAllVehicles(vh);
  };

  const calculateDuration = (startTime: string, finishedTime?: string) => {
      const end = finishedTime ? new Date(finishedTime).getTime() : currentTime;
      const diff = end - new Date(startTime).getTime();
      const mins = Math.floor(diff / 60000);
      const hours = Math.floor(mins / 60);
      const secs = Math.floor((diff % 60000) / 1000);
      
      if (hours > 0) return `${hours}h ${mins % 60}m ${secs}s`;
      return `${mins}m ${secs}s`;
  };

  const handleDecrement = async (batchId: string, color: string) => {
      await db.decrementBatchQty(batchId, color);
      loadData();
  };

  const handleEditBatch = (batch: ProductionBatch) => {
      setEditingBatchId(batch.id);
      setBatchForm({
          name: batch.name,
          line: batch.line,
          status: batch.status as 'ACTIVE' | 'UPCOMING',
          models: batch.models,
          colors: { ...batch.colors }
      });
      setIsAddBatchOpen(true);
  };

  const handleDeleteBatch = async (batchId: string) => {
    if(!confirm("Delete this batch from queue?")) return;
    // Mock implementation for deleting batch
    // In a real app, db.deleteBatch(batchId)
    const { data, error } = await (db as any).supabase.from('production_batches').delete().eq('id', batchId);
    loadData();
  };

  const handleActivateBatch = async (batchId: string) => {
    if(!confirm("Set this batch as ACTIVE? Current active batch will be completed.")) return;
    const batch = batches.find(b => b.id === batchId);
    if(!batch) return;
    
    // Deactivate current active
    const currentActive = batches.find(b => b.line === batch.line && b.status === 'ACTIVE');
    if(currentActive) {
        await db.updateBatch(currentActive.id, { status: 'COMPLETED' as any });
    }
    
    // Activate new
    await db.updateBatch(batchId, { status: 'ACTIVE' as any });
    loadData();
  };

  const handleAddBatch = async () => {
      if (!batchForm.name) return alert('Enter batch name.');
      const totalQty = (Object.values(batchForm.colors) as number[]).reduce((a: number, b: number) => a + b, 0);
      if (totalQty === 0) return alert('Add at least one car quantity.');
      if (batchForm.models.length === 0) return alert('Select at least one model.');

      try {
          if (editingBatchId) {
              await db.updateBatch(editingBatchId, {
                  name: batchForm.name,
                  models: batchForm.models,
                  colors: batchForm.colors,
                  status: batchForm.status
              });
          } else {
              const newBatch: ProductionBatch = {
                  id: `batch-${Date.now()}`,
                  name: batchForm.name,
                  line: batchForm.line,
                  totalQty,
                  models: batchForm.models,
                  colors: batchForm.colors,
                  status: batchForm.status,
                  createdAt: new Date().toISOString()
              };
              await db.addBatch(newBatch);
          }
          setIsAddBatchOpen(false);
          setEditingBatchId(null);
          setBatchForm({ name: '', line: 'B-Line', status: 'UPCOMING', models: [], colors: {} });
          loadData();
      } catch (err) {
          alert("Error processing batch. Check database connection.");
      }
  };

  const handleBroadcastSubmit = async () => {
    if (!broadcastMsg.trim()) {
      alert('Please enter a message to broadcast.');
      return;
    }
    const duration = parseInt(broadcastDuration);
    try {
      await db.setLineMessage(broadcastLine, broadcastMsg, isNaN(duration) ? 10 : duration);
      setIsBroadcastOpen(false);
      setBroadcastMsg('');
      alert(`Message broadcasted to ${broadcastLine}.`);
    } catch (error) {
      console.error("Error broadcasting message:", error);
      alert("Failed to broadcast message.");
    }
  };

  const addMetadataItem = (type: 'MODEL' | 'COLOR') => {
      const name = prompt(`Enter new ${type.toLowerCase()} name:`);
      if (!name) return;
      if (type === 'MODEL') {
          setAvailableModels(prev => [...prev, name.toUpperCase()]);
      } else {
          setAvailableColors(prev => [...prev, name.toUpperCase()]);
      }
  };

  const removeMetadataItem = (type: 'MODEL' | 'COLOR', item: string) => {
      if (!confirm(`Remove ${item} from the list?`)) return;
      if (type === 'MODEL') {
          setAvailableModels(prev => prev.filter(i => i !== item));
      } else {
          setAvailableColors(prev => prev.filter(i => i !== item));
      }
  };

  const pendingRequests = allRequests.filter(req => req.status === 'PENDING');

  const upcomingForLine = useMemo(() => {
    if(!showQueue) return [];
    return batches
        .filter(b => b.line === showQueue && b.status === 'UPCOMING')
        .sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [batches, showQueue]);

  return (
    <div className="flex flex-col min-h-screen pb-10 gap-6">
       {/* Banner Neon Vermelho Fixo - Supply Parts */}
       {pendingRequests.length > 0 && (
          <div className="bg-red-600/10 border-2 border-red-600 rounded-2xl h-16 flex items-center shadow-[0_0_25px_rgba(239,68,68,0.3)] shrink-0">
             <div className="bg-red-600 h-full px-6 flex items-center gap-2 font-black text-white italic shadow-2xl">
                <AlertTriangle size={24} /> PENDING REQUESTS ({pendingRequests.length})
             </div>
             <div className="flex-1 px-8 flex items-center gap-8 overflow-hidden">
                {pendingRequests.slice(0, 4).map(req => (
                   <span key={req.id} className="text-red-500 font-black text-lg uppercase tracking-tighter whitespace-nowrap">
                      {req.partName} - {req.line || req.vin?.slice(-6) || '??'}
                   </span>
                ))}
                {pendingRequests.length > 4 && <span className="text-red-500 font-black">...</span>}
             </div>
          </div>
       )}

       <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-all shadow-lg"><ArrowLeft /></button>
                <h2 className="text-4xl font-black text-white tracking-tighter uppercase">Production Dashboard</h2>
            </div>
            <div className="flex gap-4">
                <button 
                    onClick={() => setIsBroadcastOpen(true)}
                    className="bg-white border-2 border-red-600 hover:bg-red-50 px-6 py-3 rounded-2xl font-black text-red-600 text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-red-500/10 active:scale-95 transition-all"
                >
                    <Megaphone size={18} /> Broadcast Alert
                </button>
            </div>
       </div>

       {/* Top Grid: Production Lines */}
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             {/* ... Production Lines content ... */}
             {['B-Line', 'P-Line'].map(line => {
                const active = batches.find(b => b.line === line && b.status === 'ACTIVE');
                const nextInLine = batches
                    .filter(b => b.line === line && b.status === 'UPCOMING')
                    .sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                const next = nextInLine[0];

                const colorAccent = line === 'B-Line' ? 'text-green-500' : 'text-blue-500';
                const borderAccent = line === 'B-Line' ? 'border-green-500/30' : 'border-blue-500/30';

                return (
                   <div key={line} className={`bg-slate-900 border ${borderAccent} p-8 rounded-[2.5rem] flex flex-col gap-6 shadow-2xl relative overflow-hidden group`}>
                      <div className="absolute top-0 right-0 p-8 text-slate-800 group-hover:text-blue-500/10 transition-colors pointer-events-none">
                         <Activity size={100} />
                      </div>
                      
                      <div className="flex justify-between items-center z-10">
                         <h3 className="text-4xl font-black text-white tracking-tighter uppercase">{line}</h3>
                         <div className="flex gap-2">
                            <button 
                                onClick={() => {
                                    setEditingBatchId(null);
                                    setBatchForm({ name: '', line: line as any, status: 'UPCOMING', models: [], colors: {} });
                                    setIsAddBatchOpen(true);
                                }}
                                className={`p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all shadow-lg border border-slate-700`}
                                title="Add to Queue"
                            >
                                <Plus size={20} />
                            </button>
                         </div>
                      </div>
                      
                      <div className="flex-1 z-10 space-y-4">
                         {active ? (
                            <div className="space-y-4">
                               <div className="flex justify-between items-start">
                                  <div className="flex flex-col">
                                     <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Active Batch</span>
                                        <button onClick={() => handleEditBatch(active)} className="text-slate-500 hover:text-white transition-colors">
                                            <Edit size={12} />
                                        </button>
                                     </div>
                                     <span className="text-3xl font-black text-white truncate drop-shadow-lg">{active.name}</span>
                                  </div>
                                  <div className={`text-6xl font-mono font-black ${colorAccent} leading-none`}>{active.totalQty}</div>
                               </div>
                               <div className="grid grid-cols-2 gap-3 mt-4 max-h-56 overflow-auto pr-2 custom-scrollbar">
                                  {Object.entries(active.colors).filter(([_, qty]) => (qty as number) > 0).map(([color, qty]) => (
                                     <div key={color} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex justify-between items-center shadow-lg group/item hover:border-blue-500 transition-colors">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-slate-500 font-black uppercase truncate tracking-widest">{color}</span>
                                            <span className="text-2xl font-mono font-black text-white">{qty as number}</span>
                                        </div>
                                        <button 
                                            onClick={() => handleDecrement(active.id, color)}
                                            className="p-3 bg-slate-900 text-slate-500 hover:bg-red-600/20 hover:text-red-500 rounded-xl transition-all shadow-inner border border-slate-800"
                                            title="Decrease Quantity"
                                        >
                                           <Minus size={20} />
                                        </button>
                                     </div>
                                  ))}
                               </div>
                            </div>
                         ) : (
                            <div className="flex flex-col items-center justify-center py-10 opacity-30">
                                <div className="text-slate-800 italic text-2xl font-black uppercase tracking-widest">Standby</div>
                            </div>
                         )}
                      </div>
                      <button 
                         onClick={() => setShowQueue(line as any)}
                         className="w-full bg-slate-800 hover:bg-blue-600 py-3 rounded-2xl font-black flex items-center justify-center gap-2 transition-all uppercase tracking-widest text-xs"
                      >
                         <ChevronRight size={18} /> Full Queue
                      </button>
                   </div>
                );
             })}
       </div>

       {/* ... Remaining components ... */}
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             {/* Column 1: Box Repair */}
             <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] shadow-2xl flex flex-col h-[450px]">
                <div className="flex items-center justify-between mb-6">
                   <h3 className="text-lg font-black text-white flex items-center gap-2 uppercase tracking-tighter">
                      <Wrench size={24} className="text-orange-500" /> BOX REPAIR ACTIVITY
                   </h3>
                </div>
                <div className="flex-1 overflow-auto space-y-3 custom-scrollbar no-scrollbar">
                   {boxRepairSpots.length === 0 && <p className="text-center text-slate-600 py-10 font-bold">No active box repair</p>}
                   {boxRepairSpots.map(spot => {
                      const vehicle = allVehicles.find(v => v.vin === spot.vin);
                      const isFinished = vehicle?.status === 'AOFF';
                      
                      return (
                        <div key={spot.id} className={`bg-slate-950 p-4 rounded-2xl border ${isFinished ? 'border-green-500/50' : 'border-slate-800'} flex flex-col gap-2`}>
                           <div className="flex justify-between items-center">
                              <span className={`text-sm font-mono font-black tracking-widest ${isFinished ? 'text-green-500' : 'text-blue-400'}`}>
                                 {spot.vin?.slice(-6)}
                              </span>
                              <span className="text-[8px] font-black uppercase text-slate-500">Spot #{spot.number}</span>
                           </div>
                           <div className={`flex justify-between items-center ${isFinished ? 'bg-green-950/20' : 'bg-slate-900/50'} p-2 rounded-lg`}>
                              <span className="text-[10px] font-black text-slate-200 uppercase tracking-widest">{spot.shop}</span>
                              <span className={`text-[9px] font-bold flex items-center gap-1 ${isFinished ? 'text-green-400' : 'text-orange-500'}`}>
                                 {isFinished ? <CheckCircle2 size={10}/> : <Clock size={10} />} 
                                 {spot.allocatedAt ? calculateDuration(spot.allocatedAt, vehicle?.finishedAt) : '??'}
                                 {isFinished && <span className="ml-1 text-[7px] bg-green-500/20 px-1 rounded">FINALIZADO</span>}
                              </span>
                           </div>
                        </div>
                      );
                   })}
                </div>
             </div>

             {/* Column 2: Online Reworkers */}
             <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] shadow-2xl flex flex-col h-[450px]">
                <div className="flex items-center justify-between mb-6">
                   <h3 className="text-lg font-black text-white flex items-center gap-2 uppercase tracking-tighter">
                      <Users size={24} className="text-blue-500" /> ONLINE REWORKERS
                   </h3>
                </div>
                <div className="flex-1 overflow-auto space-y-3 custom-scrollbar no-scrollbar">
                   {reworkers.length === 0 && <p className="text-center text-slate-600 py-10 font-bold">No reworkers online</p>}
                   {reworkers.map(rw => (
                      <div key={rw.id} className="flex flex-col gap-2 bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-sm">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-black text-xs border border-blue-500/20 text-blue-400">
                                {rw.fullName.slice(0,2).toUpperCase()}
                            </div>
                            <span className="text-sm font-black text-slate-200 tracking-tight">{rw.fullName}</span>
                         </div>
                      </div>
                   ))}
                </div>
             </div>

             {/* Column 3: Fast Repair Status */}
             <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] shadow-2xl flex flex-col h-[450px]">
                <div className="flex items-center justify-between mb-6">
                   <h3 className="text-lg font-black text-white flex items-center gap-2 uppercase tracking-tighter">
                      <Zap size={24} className="text-yellow-500" /> FAST REPAIR STATUS
                   </h3>
                </div>
                <div className="flex-1 overflow-auto custom-scrollbar no-scrollbar">
                   {fastRepairVehicles.length === 0 ? (
                       <p className="text-center text-slate-600 py-10 font-bold">No fast repair units</p>
                   ) : (
                       <table className="w-full text-left text-xs">
                           <thead className="bg-slate-950 text-slate-500 uppercase font-black tracking-widest sticky top-0">
                               <tr>
                                   <th className="p-3">VIN (8)</th>
                                   <th className="p-3">Duration</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-800">
                               {fastRepairVehicles.map(v => (
                                   <tr key={v.vin} className="bg-slate-950/40 hover:bg-slate-800 transition-colors">
                                       <td className="p-3 font-mono font-black text-yellow-500">{v.vin.slice(-8)}</td>
                                       <td className="p-3 font-mono text-slate-300">{calculateDuration(v.createdAt)}</td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                   )}
                </div>
             </div>
       </div>

       {/* ... Full Queue Modal ... */}
       {showQueue && (
           <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[150] p-6 backdrop-blur-xl">
               <div className="bg-slate-900 border border-slate-700 p-8 rounded-[3rem] w-full max-w-4xl shadow-2xl flex flex-col gap-6 max-h-[90vh]">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-6">
                        <div className="flex items-center gap-3">
                            <ListOrdered size={32} className="text-blue-500" />
                            <h3 className="text-3xl font-black text-white uppercase tracking-tighter">
                                {showQueue} Production Queue
                            </h3>
                        </div>
                        <button onClick={() => setShowQueue(false)} className="text-slate-500 hover:text-white transition-colors">
                            <XCircle size={32}/>
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto space-y-4 pr-4 custom-scrollbar">
                        {upcomingForLine.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 opacity-20">
                                <Layers size={100} />
                                <span className="text-2xl font-black uppercase italic">No batches in queue</span>
                            </div>
                        ) : (
                            upcomingForLine.map((batch, index) => (
                                <div key={batch.id} className="bg-slate-950 p-6 rounded-[2rem] border border-slate-800 flex flex-col gap-4 hover:border-blue-500/50 transition-all">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-black text-white shadow-lg">
                                                {index + 1}
                                            </div>
                                            <div>
                                                <h4 className="text-2xl font-black text-white uppercase tracking-tight">{batch.name}</h4>
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                    Planned: {new Date(batch.createdAt).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleActivateBatch(batch.id)}
                                                className="bg-green-600/20 text-green-500 p-3 rounded-2xl hover:bg-green-600 hover:text-white transition-all border border-green-500/30"
                                                title="Start Production Now"
                                            >
                                                <Play size={20} fill="currentColor" />
                                            </button>
                                            <button 
                                                onClick={() => handleEditBatch(batch)}
                                                className="bg-blue-600/20 text-blue-500 p-3 rounded-2xl hover:bg-blue-600 hover:text-white transition-all border border-blue-500/30"
                                                title="Edit Batch"
                                            >
                                                <Edit size={20} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteBatch(batch.id)}
                                                className="bg-red-600/20 text-red-500 p-3 rounded-2xl hover:bg-red-600 hover:text-white transition-all border border-red-600/30"
                                                title="Delete from Queue"
                                            >
                                                <TrashIcon size={20} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                                        <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800">
                                            <span className="text-[8px] font-black text-slate-500 uppercase block mb-1">Total Units</span>
                                            <span className="text-3xl font-mono font-black text-white">{batch.totalQty}</span>
                                        </div>
                                        <div className="col-span-3 bg-slate-900 p-3 rounded-2xl border border-slate-800 flex flex-wrap gap-2">
                                            {Object.entries(batch.colors).map(([color, qty]) => (
                                                <div key={color} className="bg-slate-950 px-3 py-1 rounded-xl border border-slate-800 flex items-center gap-2">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter truncate max-w-[80px]">{color}</span>
                                                    <span className="text-sm font-mono font-black text-blue-500">{qty as number}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-2 mt-2 flex-wrap">
                                        {batch.models.map(m => (
                                            <span key={m} className="text-[9px] bg-slate-800 px-2 py-1 rounded-lg text-slate-300 font-bold border border-slate-700">
                                                {m}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="mt-4 pt-6 border-t border-slate-800 flex justify-end">
                        <button 
                            onClick={() => {
                                setShowQueue(false);
                                setEditingBatchId(null);
                                setBatchForm({ name: '', line: showQueue as any, status: 'UPCOMING', models: [], colors: {} });
                                setIsAddBatchOpen(true);
                            }}
                            className="bg-blue-600 px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center gap-3"
                        >
                            <Plus size={24} /> New Batch Planning
                        </button>
                    </div>
               </div>
           </div>
       )}

       {/* Modals for Add/Edit Batch */}
       {isAddBatchOpen && (
           <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[200] p-6 backdrop-blur-xl">
               <div className="bg-slate-900 border border-slate-700 p-8 rounded-[3rem] w-full max-w-4xl shadow-2xl flex flex-col gap-6 max-h-[90vh] overflow-auto custom-scrollbar">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-6">
                        <div className="flex items-center gap-3">
                            <Layers size={32} className="text-blue-500" />
                            <h3 className="text-3xl font-black text-white uppercase tracking-tighter">{editingBatchId ? 'Edit' : 'Plan'} Production Batch</h3>
                        </div>
                        <button onClick={() => { setIsAddBatchOpen(false); setEditingBatchId(null); }} className="text-slate-500 hover:text-white transition-colors">
                            <XCircle size={32}/>
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        {/* Batch Config */}
                        <div className="space-y-6">
                            <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-inner">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Batch Identification</label>
                                <input 
                                    className="w-full bg-transparent border-b border-slate-700 p-2 text-white font-black text-xl outline-none focus:border-blue-500 transition-all"
                                    placeholder="Enter ID..."
                                    value={batchForm.name}
                                    onChange={e => setBatchForm({...batchForm, name: e.target.value})}
                                />
                            </div>
                            
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Target Destination</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['B-Line', 'P-Line'].map(l => (
                                        <button 
                                            key={l}
                                            disabled={!!editingBatchId}
                                            onClick={() => setBatchForm({...batchForm, line: l as any})}
                                            className={`py-4 rounded-2xl font-black text-xs uppercase tracking-widest border transition-all ${batchForm.line === l ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'} disabled:opacity-50`}
                                        >
                                            {l}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Deployment Priority</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        {id: 'ACTIVE', label: 'Start Now'},
                                        {id: 'UPCOMING', label: 'Add to Queue'}
                                    ].map(s => (
                                        <button 
                                            key={s.id}
                                            onClick={() => setBatchForm({...batchForm, status: s.id as any})}
                                            className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border transition-all ${batchForm.status === s.id ? 'bg-green-600 border-green-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'}`}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Model Selection */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-end mb-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Vehicle Platform Models</label>
                                {canManageMetadata && (
                                    <button onClick={() => addMetadataItem('MODEL')} className="text-blue-500 hover:text-blue-400 p-1 bg-blue-500/10 rounded-lg">
                                        <Plus size={14} />
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-auto pr-2 custom-scrollbar">
                                {availableModels.map(m => {
                                    const isSelected = batchForm.models.includes(m);
                                    return (
                                        <div key={m} className="group relative">
                                            <button 
                                                onClick={() => {
                                                    const updated = isSelected ? batchForm.models.filter(x => x !== m) : [...batchForm.models, m];
                                                    setBatchForm({...batchForm, models: updated});
                                                }}
                                                className={`w-full py-3 px-3 rounded-2xl text-[10px] font-black uppercase tracking-tighter border transition-all flex items-center justify-between ${isSelected ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                                            >
                                                {m}
                                                {isSelected && <Activity size={12} className="animate-pulse" />}
                                            </button>
                                            {canManageMetadata && (
                                                <button onClick={() => removeMetadataItem('MODEL', m)} className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <XCircle size={14}/>
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Color Qty */}
                    <div className="bg-slate-950/50 p-6 rounded-[2rem] border border-slate-800 mt-4">
                        <div className="flex justify-between items-end mb-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Unit Quantities by Color Specification</label>
                            {canManageMetadata && (
                                <button onClick={() => addMetadataItem('COLOR')} className="text-blue-500 hover:text-blue-400 p-1 bg-blue-500/10 rounded-lg">
                                    <Plus size={14} />
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {availableColors.map(c => (
                                <div key={c} className="group bg-slate-950 p-4 rounded-2xl border border-slate-800 flex justify-between items-center hover:border-blue-500/50 transition-all relative">
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-tighter truncate w-32">{c}</span>
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={() => {
                                                const current = batchForm.colors[c] || 0;
                                                setBatchForm({...batchForm, colors: {...batchForm.colors, [c]: Math.max(0, current - 1)}});
                                            }}
                                            className="p-1.5 bg-slate-900 rounded-lg text-slate-500 hover:text-red-500 transition-colors"
                                        ><Minus size={16}/></button>
                                        <input 
                                            type="number"
                                            className="w-16 bg-slate-900 border border-slate-800 rounded-lg text-center font-mono font-black text-white outline-none focus:border-blue-500 p-1"
                                            value={batchForm.colors[c] || 0}
                                            onChange={e => setBatchForm({...batchForm, colors: {...batchForm.colors, [c]: parseInt(e.target.value) || 0}})}
                                        />
                                        <button 
                                            onClick={() => {
                                                const current = batchForm.colors[c] || 0;
                                                setBatchForm({...batchForm, colors: {...batchForm.colors, [c]: current + 1}});
                                            }}
                                            className="p-1.5 bg-slate-900 rounded-lg text-slate-500 hover:text-green-500 transition-colors"
                                        ><Plus size={16}/></button>
                                    </div>
                                    {canManageMetadata && (
                                        <button onClick={() => removeMetadataItem('COLOR', c)} className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <XCircle size={14}/>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-blue-600/10 p-8 rounded-[2.5rem] border border-blue-500/30 flex justify-between items-center mt-6">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Total Payload (Units)</span>
                            <span className="text-5xl font-mono font-black text-white">{(Object.values(batchForm.colors) as number[]).reduce((a: number, b: number) => a + b, 0)}</span>
                        </div>
                        <button 
                            onClick={handleAddBatch}
                            className="bg-blue-600 py-6 px-16 rounded-[1.5rem] font-black uppercase tracking-widest shadow-2xl shadow-blue-500/40 hover:bg-blue-700 transition-all active:scale-95 text-lg"
                        >
                            {editingBatchId ? 'Update Information' : 'Finalize Planning'}
                        </button>
                    </div>
               </div>
           </div>
       )}

       {/* Broadcast Modal */}
       {isBroadcastOpen && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[120] p-6 backdrop-blur-md">
             <div className="bg-slate-900 border border-slate-700 p-10 rounded-[4rem] w-full max-w-md shadow-2xl flex flex-col gap-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-3xl font-black text-red-500 uppercase tracking-tighter">Emergency Alert</h3>
                    <button onClick={() => setIsBroadcastOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                        <XCircle size={32}/>
                    </button>
                </div>
                <div className="space-y-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Target Distribution</label>
                        <div className="flex gap-2">
                            {['B-Line', 'P-Line'].map(l => (
                                <button 
                                    key={l}
                                    onClick={() => setBroadcastLine(l as any)}
                                    className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border transition-all ${broadcastLine === l ? 'bg-red-600 border-red-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'}`}
                                >
                                    {l}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Critical Message</label>
                        <textarea 
                            className="w-full bg-slate-950 border border-slate-800 rounded-3xl p-6 text-white font-black text-xl outline-none focus:border-red-600 transition-all h-40 resize-none shadow-inner"
                            placeholder="INPUT MESSAGE..."
                            value={broadcastMsg}
                            onChange={e => setBroadcastMsg(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Alert Duration (Mins)</label>
                        <input 
                            type="number" 
                            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-mono font-black outline-none focus:border-red-600"
                            value={broadcastDuration}
                            onChange={e => setBroadcastDuration(e.target.value)}
                            min="1"
                        />
                    </div>
                </div>
                <button 
                    onClick={handleBroadcastSubmit}
                    className="w-full bg-red-600 py-6 rounded-[1.5rem] font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl shadow-red-500/40 hover:bg-red-700 transition-all active:scale-95 text-lg"
                >
                    <Send size={24} /> Deploy to Andon
                </button>
             </div>
          </div>
       )}
    </div>
  );
}
