
import React, { useState, useEffect } from 'react';
import { User, RequestPart, ALL_PERMISSIONS } from '../types';
import { db } from '../services/mockSupabase';
import { ArrowLeft, Plus, Download, Trash, CheckCircle, XCircle, Edit, Save, AlertCircle, Minus, Settings, Edit3 } from 'lucide-react';

interface Props {
  user: User;
  onBack: () => void;
}

export default function SupplyParts({ user, onBack }: Props) {
  const [requests, setRequests] = useState<RequestPart[]>([]);
  const [activeTab, setActiveTab] = useState<'LINE' | 'REPAIR'>('LINE');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<RequestPart>>({});
  
  const [partsList, setPartsList] = useState<Array<{partNumber: string, partName: string, quantity: number}>>([]);
  const [currentPart, setCurrentPart] = useState({ partNumber: '', partName: '', quantity: 1 });
  const [formContext, setFormContext] = useState({ vin: '', reason: '', line: 'Trim Line' });

  const [availableLines, setAvailableLines] = useState<string[]>(['Trim Line', 'Chassis Line', 'Final Line', 'Door Line', 'Engine Line']);
  const canManageLines = user.role === 'Admin' || user.permissions.includes('MANAGE_PRODUCTION_LINES');

  useEffect(() => { refresh(); }, []);

  const refresh = async () => {
    const data = await db.getRequests();
    setRequests(data);
  };

  const getPartColor = (pn: string) => {
    const mapping: Record<string, string> = { '8T': 'SUN GOLD BLACK', '9C': 'HAMILTON WHITE', 'DX': 'NEBULA GREY', 'F3': 'AYERS GREY', 'H4': 'ATLANTIS BLUE', 'KU': 'KU GREY' };
    return mapping[pn.slice(-2)] || 'INCOLOR';
  };

  const handleAddLine = () => {
      const name = prompt("Enter new production line name:");
      if(name && !availableLines.includes(name)) {
          setAvailableLines([...availableLines, name.toUpperCase()]);
      }
  };

  const handleRemoveLine = (line: string) => {
      if(confirm(`Remove ${line}?`)) {
          setAvailableLines(availableLines.filter(l => l !== line));
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(partsList.length === 0) return alert("Add at least one part.");
    if(activeTab === 'REPAIR' && (!formContext.vin || formContext.vin.length !== 17)) return alert("Invalid VIN for Repair Request.");

    for(const p of partsList) {
        await db.addRequest({ 
          id: Math.random().toString(36).substr(2, 9), 
          vin: activeTab === 'REPAIR' ? formContext.vin : null, 
          line: activeTab === 'LINE' ? formContext.line : undefined, 
          partNumber: p.partNumber, 
          partName: p.partName, 
          quantity: p.quantity, 
          reason: formContext.reason, 
          requester: user.fullName, 
          requestedAt: new Date().toISOString(), 
          status: 'PENDING', 
          type: activeTab, 
          color: getPartColor(p.partNumber) 
        });
    }
    refresh(); setPartsList([]); setFormContext({ ...formContext, reason: '', vin: '' });
  };

  const handleStatusUpdate = async (id: string, status: RequestPart['status']) => {
    let lot: string | null = null;
    if(status === 'APPROVED') {
        lot = prompt("Enter Lot Number (Lote):");
        if(!lot) return alert("Lot number is mandatory for approval.");
    }
    await db.updateRequest(id, { 
        status, 
        lotNumber: lot || undefined, 
        processedBy: user.fullName
    });
    refresh();
  };

  const handleEdit = (req: RequestPart) => {
    setEditingId(req.id);
    setEditForm({ ...req });
  };

  const handleSaveEdit = async () => {
    if(editingId && editForm) {
        await db.updateRequest(editingId, editForm);
        setEditingId(null);
        refresh();
    }
  };

  const filteredQueue = requests.filter(r => r.type === activeTab);

  return (
    <div className="flex flex-col min-h-screen pb-10">
       <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
             <button onClick={onBack} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700"><ArrowLeft /></button>
             <h2 className="text-2xl font-bold">Supply Parts (零件供应)</h2>
          </div>
      </div>

      <div className="flex gap-4 mb-6 border-b border-slate-800 pb-1">
        {['LINE', 'REPAIR'].map(t => (
          <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-2 border-b-2 font-bold transition-all uppercase text-xs tracking-widest ${activeTab === t ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500'}`}>{t} Requests</button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
           <div className="flex items-center justify-between mb-2">
              <h3 className="font-black text-lg uppercase tracking-tight">New {activeTab} Request</h3>
              {activeTab === 'LINE' && canManageLines && (
                  <button onClick={handleAddLine} className="p-2 bg-blue-600/10 text-blue-500 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-lg shadow-blue-500/5">
                      <Plus size={16}/>
                  </button>
              )}
           </div>
           
           <div className="space-y-4">
                {activeTab === 'REPAIR' ? (
                   <div>
                      <label className="text-[10px] text-slate-500 font-bold mb-1 block uppercase tracking-widest">VIN Number</label>
                      <input className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 text-white uppercase font-mono tracking-widest outline-none focus:border-blue-500 transition-all" placeholder="ENTER VIN..." value={formContext.vin} onChange={e => setFormContext({...formContext, vin: e.target.value.toUpperCase()})} maxLength={17} />
                   </div>
                ) : (
                   <div>
                      <label className="text-[10px] text-slate-500 font-bold mb-1 block uppercase tracking-widest">Production Line</label>
                      <div className="flex gap-2">
                        <select className="flex-1 bg-slate-950 p-3 rounded-xl border border-slate-800 text-white font-bold tracking-tight outline-none focus:border-blue-500" value={formContext.line} onChange={e => setFormContext({...formContext, line: e.target.value})}>
                            {availableLines.map(l => <option key={l}>{l}</option>)}
                        </select>
                        {canManageLines && (
                             <button onClick={() => handleRemoveLine(formContext.line)} className="p-3 bg-red-600/20 text-red-500 rounded-xl border border-red-600/50 hover:bg-red-600 hover:text-white transition-all" title="Remove Line">
                                 <Minus size={20}/>
                             </button>
                        )}
                      </div>
                   </div>
                )}
                
                <div className="bg-slate-800 p-5 rounded-2xl space-y-4 shadow-inner border border-slate-700/50">
                    <div>
                        <label className="text-[10px] text-slate-400 font-bold mb-1 block uppercase tracking-widest">Part Number</label>
                        <input className="w-full bg-slate-950 p-2 rounded-lg border border-slate-700 text-white uppercase font-mono" placeholder="PN..." value={currentPart.partNumber} onChange={e => setCurrentPart({...currentPart, partNumber: e.target.value.toUpperCase()})} />
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-400 font-bold mb-1 block uppercase tracking-widest">Part Name</label>
                        <input className="w-full bg-slate-950 p-2 rounded-lg border border-slate-700 text-white" placeholder="NAME..." value={currentPart.partName} onChange={e => setCurrentPart({...currentPart, partName: e.target.value})} />
                    </div>
                    <div className="flex gap-2">
                        <div className="w-24">
                           <label className="text-[10px] text-slate-400 font-bold mb-1 block uppercase tracking-widest text-center">Qty</label>
                           <input type="number" className="w-full bg-slate-950 p-2 rounded-lg border border-slate-700 text-white text-center font-bold" value={currentPart.quantity} onChange={e => setCurrentPart({...currentPart, quantity: parseInt(e.target.value)})} min={1} />
                        </div>
                        <button onClick={() => { if(!currentPart.partNumber || !currentPart.partName) return; setPartsList([...partsList, currentPart]); setCurrentPart({partNumber:'', partName:'', quantity: 1}); }} className="flex-1 bg-blue-600 py-2 rounded-xl font-black text-xs hover:bg-blue-700 transition-all mt-5 uppercase tracking-widest">Add Part</button>
                    </div>
                </div>

                {partsList.length > 0 && (
                   <div className="space-y-2 max-h-48 overflow-auto pr-2 custom-scrollbar">
                      {partsList.map((p,i) => (
                         <div key={i} className="flex justify-between items-center text-xs bg-slate-800 p-3 rounded-xl border border-slate-700 hover:bg-slate-700 transition-all group">
                            <div className="font-bold flex flex-col">
                               <span className="text-blue-400 font-mono tracking-tight">{p.partNumber}</span>
                               <span className="text-slate-200">{p.partName} <span className="text-slate-500 font-mono">(x{p.quantity})</span></span>
                            </div>
                            <button onClick={() => setPartsList(partsList.filter((_,idx)=>idx!==i))} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/20 rounded-lg">
                                <Trash size={16}/>
                            </button>
                         </div>
                      ))}
                   </div>
                )}
           </div>
           <button onClick={handleSubmit} className="w-full bg-green-600 py-4 rounded-2xl font-black text-lg shadow-lg shadow-green-500/20 hover:bg-green-700 transition-all uppercase tracking-widest">SUBMIT REQUEST</button>
        </div>

        <div className="col-span-2 bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden flex flex-col shadow-2xl">
           <div className="p-5 bg-slate-800 border-b border-slate-700 font-bold flex items-center justify-between shadow-lg">
              <span className="uppercase tracking-widest text-sm">Request Queue</span>
              <span className="text-[10px] bg-blue-600 px-3 py-1 rounded-full font-black uppercase">{filteredQueue.length} PENDING</span>
           </div>
           <div className="flex-1 overflow-auto p-5 space-y-4 custom-scrollbar">
             {filteredQueue.length === 0 && (
                <div className="text-center text-slate-700 py-32 flex flex-col items-center gap-4">
                    <AlertCircle size={48} className="opacity-20"/>
                    <span className="italic font-bold text-xl uppercase tracking-tighter">Queue Empty</span>
                </div>
             )}
             {filteredQueue.map(req => (
               <div key={req.id} className="bg-slate-800/40 p-5 rounded-[1.5rem] border border-slate-700 flex justify-between items-center hover:bg-slate-800 transition shadow-sm group">
                 <div className="flex-1">
                    <div className="font-black text-xl flex items-center gap-3 text-white tracking-tight">
                        {req.partNumber}
                        <span className="text-sm bg-slate-950 px-3 py-1 rounded-full text-slate-500 font-mono border border-slate-800">x{req.quantity}</span>
                    </div>
                    <div className="text-slate-200 mt-1 font-medium">{req.partName}</div>
                    <div className="text-[10px] text-slate-500 mt-3 flex items-center gap-6 uppercase font-bold tracking-widest">
                        {req.vin ? <span>VIN: <span className="text-blue-400 font-mono">{req.vin}</span></span> : <span>Line: <span className="text-yellow-500">{req.line}</span></span>}
                        <span>Requester: {req.requester}</span>
                        <span>{new Date(req.requestedAt).toLocaleTimeString()}</span>
                    </div>
                    {req.lotNumber && <div className="text-[9px] text-green-400 font-black mt-3 bg-green-950/40 w-fit px-3 py-1 rounded-full border border-green-500/20 tracking-[0.2em] uppercase">LOT: {req.lotNumber}</div>}
                 </div>
                 
                 <div className="flex flex-col items-end gap-3 ml-6">
                   <div className="flex items-center gap-2">
                       <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full border tracking-widest ${
                           req.status === 'PENDING' ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10 shadow-[0_0_10px_rgba(234,179,8,0.1)]' : 
                           req.status === 'APPROVED' ? 'border-green-500 text-green-500 bg-green-500/10' :
                           req.status === 'UNAVAILABLE' ? 'border-amber-500 text-amber-500 bg-amber-500/10 shadow-[0_0_10px_rgba(245,158,11,0.1)]' :
                           req.status === 'MISSING_PART' ? 'border-red-500 text-red-500 bg-red-500/10 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'border-slate-500 text-slate-500 bg-slate-500/10'
                       }`}>
                           {req.status.replace('_', ' ')}
                       </span>
                   </div>
                   
                   {req.status === 'PENDING' && (
                     <div className="flex gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-700/50 shadow-inner">
                        <button onClick={() => handleStatusUpdate(req.id, 'APPROVED')} className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg shadow-green-500/10 transition-all">Approved</button>
                        <button onClick={() => handleStatusUpdate(req.id, 'UNAVAILABLE')} className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg shadow-amber-500/10 transition-all">Unavailable</button>
                        <button onClick={() => handleStatusUpdate(req.id, 'MISSING_PART')} className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg shadow-red-500/10 transition-all">Missing</button>
                        <button onClick={() => handleEdit(req)} className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-xl transition-all" title="Edit Request">
                            <Edit3 size={14}/>
                        </button>
                     </div>
                   )}
                 </div>
               </div>
             ))}
           </div>
        </div>
      </div>

      {editingId && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-6 backdrop-blur-md">
             <div className="bg-slate-900 border border-slate-700 p-8 rounded-[2rem] w-full max-w-md shadow-2xl space-y-6">
                <h3 className="text-2xl font-black text-blue-500 uppercase tracking-tighter">Edit Request</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] text-slate-500 font-bold mb-1 block uppercase tracking-widest">Part Number</label>
                        <input className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white font-mono uppercase" value={editForm.partNumber} onChange={e => setEditForm({...editForm, partNumber: e.target.value.toUpperCase()})} />
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-500 font-bold mb-1 block uppercase tracking-widest">Part Name</label>
                        <input className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white font-bold" value={editForm.partName} onChange={e => setEditForm({...editForm, partName: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-500 font-bold mb-1 block uppercase tracking-widest">Quantity</label>
                        <input type="number" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white font-black" value={editForm.quantity} onChange={e => setEditForm({...editForm, quantity: parseInt(e.target.value)})} min={1} />
                    </div>
                </div>
                <div className="flex gap-4 pt-4">
                    <button onClick={() => setEditingId(null)} className="flex-1 py-3 bg-slate-800 rounded-xl font-bold uppercase text-xs">Cancel</button>
                    <button onClick={handleSaveEdit} className="flex-1 py-3 bg-blue-600 rounded-xl font-black uppercase text-xs shadow-lg shadow-blue-500/20">Save Changes</button>
                </div>
             </div>
          </div>
      )}
    </div>
  );
}
