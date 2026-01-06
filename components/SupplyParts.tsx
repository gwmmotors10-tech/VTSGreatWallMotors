
import React, { useState, useEffect } from 'react';
import { User, RequestPart } from '../types';
import { db } from '../services/supabaseService';
import { ArrowLeft, Plus, Trash, CheckCircle, XCircle, Download, Package, Clock, UserCheck, Inbox } from 'lucide-react';

interface Props {
  user: User;
  onBack: () => void;
}

export default function SupplyParts({ user, onBack }: Props) {
  const [requests, setRequests] = useState<RequestPart[]>([]);
  const [activeTab, setActiveTab] = useState<'LINE' | 'REPAIR'>('LINE');
  const [partsList, setPartsList] = useState<Array<{partNumber: string, partName: string, quantity: number}>>([]);
  const [currentPart, setCurrentPart] = useState({ partNumber: '', partName: '', quantity: 1 });
  const [formContext, setFormContext] = useState({ vin: '', line: 'Trim Line' });
  const [availableLines, setAvailableLines] = useState<string[]>(['Trim Line', 'Chassis Line', 'Final Line', 'Door Line', 'Engine Line']);
  
  const [modalApprove, setModalApprove] = useState<RequestPart | null>(null);
  const [modalReject, setModalReject] = useState<RequestPart | null>(null);
  const [approvalForm, setApprovalForm] = useState({ lot: '', batch: '', case: '' });
  const [rejectionReason, setRejectionReason] = useState('');

  const canRequest = user.role === 'Admin' || user.permissions.includes('LINE REQUEST') || user.permissions.includes('REPAIR REQUEST');
  const canApprove = user.role === 'Admin' || user.permissions.includes('APPROVE REQUESTS');

  useEffect(() => { refresh(); }, []);

  const refresh = async () => { 
    const data = await db.getRequests(); 
    const now = Date.now();
    
    // Filtering logic:
    // 1. PENDING: always show
    // 2. APPROVED: always show until confirmed (COMPLETED)
    // 3. COMPLETED: hide immediately
    // 4. REJECTED/UNAVAILABLE/MISSING: show for 8 hours
    const filtered = data.filter(r => {
      if (r.status === 'PENDING' || r.status === 'APPROVED') return true;
      if (r.status === 'COMPLETED') return false;
      
      const finishedTime = new Date(r.approvedAt || r.requestedAt).getTime();
      const ageHours = (now - finishedTime) / (1000 * 60 * 60);
      return ageHours < 8;
    });
    setRequests(filtered); 
  };

  const handleSubmit = async () => {
    if (!canRequest) return alert("No permission to request.");
    if(partsList.length === 0) return alert("Add a part.");
    for(const p of partsList) {
        await db.addRequest({ 
          id: Math.random().toString(36).substr(2, 9), 
          vin: activeTab === 'REPAIR' ? formContext.vin : null, 
          line: activeTab === 'LINE' ? formContext.line : undefined, 
          partNumber: p.partNumber, partName: p.partName, quantity: p.quantity, 
          reason: 'Manual Request', requester: user.fullName, 
          requestedAt: new Date().toISOString(), status: 'PENDING', 
          type: activeTab, color: 'N/A' 
        });
    }
    await db.logHistory('MULTIPLE', 'PART_REQUEST', user.fullName, `Requested ${partsList.length} parts for ${activeTab}`, 'SUPPLY_PARTS');
    refresh(); setPartsList([]); setFormContext({ vin: '', line: 'Trim Line' });
  };

  const handleApprove = async () => {
    if (!modalApprove) return;
    if (!approvalForm.batch || !approvalForm.case) return alert("Batch and Case are mandatory.");
    await db.updateRequest(modalApprove.id, { 
      status: 'APPROVED', 
      processedBy: user.fullName,
      batchRetirada: approvalForm.batch,
      caseRetirada: approvalForm.case,
      lotNumber: approvalForm.lot
    });
    await db.logHistory(modalApprove.vin || 'LINE', 'PART_APPROVE', user.fullName, `Approved part ${modalApprove.partNumber}`, 'SUPPLY_PARTS');
    setModalApprove(null);
    setApprovalForm({ lot: '', batch: '', case: '' });
    refresh();
  };

  const handleReject = async () => {
    if (!modalReject) return;
    if (!rejectionReason) return alert("Reason is mandatory for rejection.");
    await db.updateRequest(modalReject.id, { status: 'REJECTED', processedBy: user.fullName, rejectionReason });
    await db.logHistory(modalReject.vin || 'LINE', 'PART_REJECT', user.fullName, `Rejected part ${modalReject.partNumber}`, 'SUPPLY_PARTS');
    setModalReject(null);
    setRejectionReason('');
    refresh();
  };

  const handleConfirmReceipt = async (req: RequestPart) => {
    await db.updateRequest(req.id, { status: 'COMPLETED', receiverName: user.fullName, receivedAt: new Date().toISOString() });
    await db.logHistory(req.vin || 'LINE', 'PART_RECEIVE', user.fullName, `Confirmed receipt of ${req.partNumber}`, 'SUPPLY_PARTS');
    refresh();
  };

  const exportApproved = (type: 'LINE' | 'REPAIR') => {
    const data = requests
      .filter(r => r.type === type && r.status === 'APPROVED')
      .map(r => ({
        "Data Requisição": new Date(r.requestedAt).toLocaleString(),
        "Part Number": r.partNumber,
        "Part Name": r.partName,
        "Quantidade": r.quantity,
        "Batch Retirada": r.batchRetirada,
        "Case Retirada": r.caseRetirada,
        "Aprovador": r.processedBy,
        "Data Aprovação": new Date(r.approvedAt!).toLocaleString()
      }));
    if (data.length === 0) return alert("No approved requests found for export.");
    db.exportData(data, `Approved_${type}_Parts`);
  };

  const addLineName = () => {
    const name = prompt("Enter new production line name:");
    if (name) setAvailableLines([...availableLines, name]);
  };

  const removeLineName = (name: string) => {
    if (confirm(`Remove ${name}?`)) setAvailableLines(availableLines.filter(l => l !== name));
  };

  return (
    <div className="flex flex-col min-h-screen pb-10">
       <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
             <button onClick={onBack} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition"><ArrowLeft /></button>
             <h2 className="text-2xl font-bold uppercase">Supply Parts</h2>
          </div>
          <div className="flex gap-2">
             <button onClick={() => exportApproved('LINE')} className="bg-green-600/10 text-green-500 border border-green-500/50 px-4 py-2 rounded-xl text-xs font-bold hover:bg-green-600 hover:text-white transition flex items-center gap-2">
                <Download size={16} /> Export Approved Line
             </button>
             <button onClick={() => exportApproved('REPAIR')} className="bg-green-600/10 text-green-500 border border-green-500/50 px-4 py-2 rounded-xl text-xs font-bold hover:bg-green-600 hover:text-white transition flex items-center gap-2">
                <Download size={16} /> Export Approved Repair
             </button>
          </div>
      </div>

      <div className="flex gap-4 mb-6 border-b border-slate-800 pb-1">
        {['LINE', 'REPAIR'].map(t => (
          <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-2 border-b-2 font-bold transition uppercase text-xs ${activeTab === t ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500'}`}>{t} Requests</button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4 shadow-xl h-fit sticky top-6">
           <h3 className="font-black text-lg uppercase flex items-center gap-2"><Plus size={20} className="text-blue-500" /> New Request</h3>
           {activeTab === 'REPAIR' ? (
              <input className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 text-white font-mono" placeholder="VIN..." value={formContext.vin} onChange={e => setFormContext({...formContext, vin: e.target.value.toUpperCase()})} maxLength={17} />
           ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <select className="flex-1 bg-slate-950 p-3 rounded-xl border border-slate-800 text-white outline-none" value={formContext.line} onChange={e => setFormContext({...formContext, line: e.target.value})}>
                      {availableLines.map(l => <option key={l}>{l}</option>)}
                  </select>
                  {user.role === 'Admin' && <button onClick={addLineName} className="bg-blue-600 px-3 rounded-xl"><Plus size={18}/></button>}
                </div>
                {user.role === 'Admin' && (
                  <div className="flex flex-wrap gap-1">
                    {availableLines.map(l => (
                      <span key={l} className="text-[10px] bg-slate-800 px-2 py-0.5 rounded flex items-center gap-1">
                        {l} <button onClick={() => removeLineName(l)} className="text-red-500"><Trash size={10}/></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
           )}
           <div className="bg-slate-800/50 p-4 rounded-xl space-y-4 border border-slate-700/50">
              <input className="w-full bg-slate-950 p-3 rounded-xl border border-slate-700 outline-none" placeholder="Part Number..." value={currentPart.partNumber} onChange={e => setCurrentPart({...currentPart, partNumber: e.target.value.toUpperCase()})} />
              <input className="w-full bg-slate-950 p-3 rounded-xl border border-slate-700 outline-none" placeholder="Part Name..." value={currentPart.partName} onChange={e => setCurrentPart({...currentPart, partName: e.target.value})} />
              <div className="flex gap-2">
                <input type="number" className="w-20 bg-slate-950 p-3 rounded-xl border border-slate-700 text-center outline-none" value={currentPart.quantity} onChange={e => setCurrentPart({...currentPart, quantity: parseInt(e.target.value) || 1})} min={1} />
                <button onClick={() => { if(currentPart.partNumber) setPartsList([...partsList, currentPart]); setCurrentPart({partNumber:'', partName:'', quantity:1}); }} className="flex-1 bg-blue-600 py-2 rounded-xl font-bold hover:bg-blue-700 transition">Add to Request</button>
              </div>
           </div>
           {partsList.map((p,i) => (
               <div key={i} className="flex justify-between items-center text-xs bg-slate-800 p-3 rounded-xl border border-slate-700">
                  <span className="font-bold">{p.partNumber} <span className="text-blue-500">x{p.quantity}</span></span>
                  <button onClick={() => setPartsList(partsList.filter((_,idx)=>idx!==i))} className="text-red-500"><Trash size={14}/></button>
               </div>
           ))}
           <button onClick={handleSubmit} className="w-full bg-green-600 py-4 rounded-2xl font-black shadow-lg hover:bg-green-700 transition uppercase tracking-widest">Submit Request</button>
        </div>

        <div className="col-span-2 bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden flex flex-col shadow-2xl">
           <div className="p-4 bg-slate-800 border-b border-slate-700 font-bold uppercase tracking-widest text-sm flex justify-between items-center">
              <span>Request Timeline</span>
              <span className="text-xs text-slate-500 font-normal">History stored according to status</span>
           </div>
           <div className="flex-1 overflow-auto p-5 space-y-4 max-h-[700px] custom-scrollbar">
             {requests.filter(r => r.type === activeTab).length === 0 && (
                <div className="text-center py-20 opacity-20"><Inbox size={48} className="mx-auto mb-4" /><p className="font-black uppercase">No active requests</p></div>
             )}
             {requests.filter(r => r.type === activeTab).map(req => (
               <div key={req.id} className={`p-5 rounded-2xl border transition-all ${
                  req.status === 'PENDING' ? 'bg-slate-800 border-slate-700' : 
                  req.status === 'APPROVED' ? 'bg-green-600/5 border-green-500/30' : 
                  req.status === 'COMPLETED' ? 'bg-blue-600/5 border-blue-500/30' : 'bg-red-600/5 border-red-500/30'
               }`}>
                 <div className="flex justify-between items-start mb-4">
                    <div>
                       <div className="font-black text-lg text-white mb-1">{req.partNumber} <span className="text-blue-500 font-mono text-sm ml-2">x{req.quantity}</span></div>
                       <div className="text-sm text-slate-400">{req.partName}</div>
                       <div className="text-[10px] text-slate-500 mt-2 flex items-center gap-4 uppercase font-bold tracking-widest">
                          <span className="flex items-center gap-1"><Clock size={10}/> {new Date(req.requestedAt).toLocaleString()}</span>
                          <span className="flex items-center gap-1"><Package size={10}/> {req.vin || req.line}</span>
                          <span className="flex items-center gap-1"><UserCheck size={10}/> {req.requester}</span>
                       </div>
                    </div>
                    <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border tracking-widest ${
                       req.status === 'PENDING' ? 'border-yellow-500 text-yellow-500' : 
                       req.status === 'APPROVED' ? 'border-green-500 text-green-500' :
                       req.status === 'COMPLETED' ? 'border-blue-500 text-blue-500' : 'border-red-500 text-red-500'
                    }`}>{req.status}</span>
                 </div>
                 
                 {(req.status === 'APPROVED' || req.status === 'COMPLETED') && (
                    <div className="bg-slate-950/50 p-3 rounded-xl mb-4 text-xs grid grid-cols-2 gap-4 border border-slate-800/50">
                       <div><span className="text-slate-500 uppercase font-bold block mb-1">Batch Retirada</span><span className="text-white">{req.batchRetirada}</span></div>
                       <div><span className="text-slate-500 uppercase font-bold block mb-1">Case Retirada</span><span className="text-white">{req.caseRetirada}</span></div>
                       <div><span className="text-slate-500 uppercase font-bold block mb-1">Approver</span><span className="text-green-500 font-bold">{req.processedBy}</span></div>
                       <div><span className="text-slate-500 uppercase font-bold block mb-1">Approval Time</span><span className="text-white">{new Date(req.approvedAt!).toLocaleString()}</span></div>
                    </div>
                 )}

                 {req.status === 'REJECTED' && (
                    <div className="bg-red-950/20 p-3 rounded-xl mb-4 text-xs border border-red-500/30">
                       <span className="text-red-500 uppercase font-bold block mb-1">Rejection Reason</span>
                       <span className="text-white">{req.rejectionReason}</span>
                    </div>
                 )}

                 <div className="flex gap-2">
                    {req.status === 'PENDING' && canApprove && (
                       <>
                          <button onClick={() => setModalApprove(req)} className="bg-green-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-green-700 transition">Approve</button>
                          <button onClick={() => setModalReject(req)} className="bg-red-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-700 transition">Reject</button>
                       </>
                    )}
                    {req.status === 'APPROVED' && (
                       <button onClick={() => handleConfirmReceipt(req)} className="w-full bg-blue-600 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20">Confirm Receipt</button>
                    )}
                 </div>
               </div>
             ))}
           </div>
        </div>
      </div>

      {modalApprove && (
         <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-md p-4">
            <div className="bg-slate-900 p-8 rounded-[2rem] border border-slate-700 w-full max-w-sm space-y-6">
               <h3 className="text-xl font-black uppercase text-green-500">Approve Request</h3>
               <div className="space-y-4">
                  <input className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl outline-none" placeholder="Lot (Optional)..." value={approvalForm.lot} onChange={e => setApprovalForm({...approvalForm, lot: e.target.value})} />
                  <input className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl outline-none" placeholder="Batch Retirada..." value={approvalForm.batch} onChange={e => setApprovalForm({...approvalForm, batch: e.target.value})} />
                  <input className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl outline-none" placeholder="Case Retirada..." value={approvalForm.case} onChange={e => setApprovalForm({...approvalForm, case: e.target.value})} />
               </div>
               <div className="flex gap-2">
                  <button onClick={() => setModalApprove(null)} className="flex-1 py-3 bg-slate-800 rounded-xl">Cancel</button>
                  <button onClick={handleApprove} className="flex-1 py-3 bg-green-600 rounded-xl font-bold">Approve</button>
               </div>
            </div>
         </div>
      )}

      {modalReject && (
         <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-md p-4">
            <div className="bg-slate-900 p-8 rounded-[2rem] border border-slate-700 w-full max-w-sm space-y-6">
               <h3 className="text-xl font-black uppercase text-red-500">Reject Request</h3>
               <textarea className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl outline-none h-32" placeholder="Rejection reason..." value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} />
               <div className="flex gap-2">
                  <button onClick={() => setModalReject(null)} className="flex-1 py-3 bg-slate-800 rounded-xl">Cancel</button>
                  <button onClick={handleReject} className="flex-1 py-3 bg-red-600 rounded-xl font-bold">Reject</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
