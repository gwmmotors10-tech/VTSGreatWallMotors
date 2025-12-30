
import React, { useState, useEffect } from 'react';
import { User, HistoryCategory, ReworkSession, RequestPart, ProductionBatch, HistoryLog } from '../types';
import { db } from '../services/mockSupabase';
import { ArrowLeft, Download, ShieldAlert, Calendar } from 'lucide-react';

interface Props {
  user: User;
  onBack: () => void;
}

export default function History({ user, onBack }: Props) {
  const [history, setHistory] = useState<HistoryLog[]>([]);
  const [reworks, setReworks] = useState<ReworkSession[]>([]);
  const [requests, setRequests] = useState<RequestPart[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [activeTab, setActiveTab] = useState<HistoryCategory | 'ALL' | 'KPI_PRODUCTION'>('ALL');
  
  // Export Date Filters
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

  const canAccessHistory = user.role === 'Admin' || user.permissions.includes('HISTORY') || user.permissions.includes('VIEW_ALL_LOGS');

  useEffect(() => {
    if (canAccessHistory) {
      db.getHistory().then(setHistory);
      db.getReworks().then(setReworks);
      db.getRequests().then(setRequests);
      db.getBatches().then(setBatches);
    }
  }, [canAccessHistory]);

  const handleExportAll = () => {
    let exportData: any[] = [];
    let filename = "History";
    let dateField = 'date'; // Default for history logs

    if (activeTab === 'ALL') {
      exportData = history;
    } else if (activeTab === 'REWORKERS') {
      exportData = reworks.map(r => ({ ...r, materials: r.materials.map(m => `${m.name}(x${m.qty})`).join(', ') }));
      filename = "Rework_History";
      dateField = 'startTime';
    } else if (activeTab === 'SUPPLY_PARTS') {
      exportData = requests;
      filename = "Supply_Parts_History";
      dateField = 'requestedAt';
    } else {
      exportData = history.filter(h => h.category === activeTab);
      filename = `${activeTab}_History`;
    }

    // Apply Date Filtering to Export
    if (exportStartDate || exportEndDate) {
        exportData = exportData.filter(item => {
            const itemDate = item[dateField] ? item[dateField].split('T')[0] : '';
            if (exportStartDate && itemDate < exportStartDate) return false;
            if (exportEndDate && itemDate > exportEndDate) return false;
            return true;
        });
    }

    if (exportData.length === 0) {
        alert("No data found for the selected range/category.");
        return;
    }

    db.exportData(exportData, filename);
  };

  if (!canAccessHistory) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShieldAlert size={64} className="text-red-500 opacity-50" />
        <h2 className="text-2xl font-black text-slate-500 uppercase tracking-widest text-center">Acesso Negado<br/><span className="text-sm font-normal">(No Permission)</span></h2>
        <button onClick={onBack} className="bg-slate-800 px-6 py-2 rounded-xl font-bold hover:bg-slate-700 transition">Go Back</button>
      </div>
    );
  }

  const renderContent = () => {
      if (activeTab === 'REWORKERS') {
          return (
            <table className="w-full text-left">
               <thead className="bg-slate-800 sticky top-0 shadow-lg z-10">
                  <tr className="text-[10px] uppercase text-slate-400 tracking-widest">
                     <th className="p-4">Start Time</th>
                     <th className="p-4">Finish Time</th>
                     <th className="p-4">VIN</th>
                     <th className="p-4">Responsible</th>
                     <th className="p-4">Defects</th>
                     <th className="p-4">Status</th>
                     <th className="p-4">Materials Used</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-800 text-sm">
                  {reworks.map(r => (
                    <tr key={r.id} className="hover:bg-slate-800/50 transition-colors">
                       <td className="p-4">{new Date(r.startTime).toLocaleString()}</td>
                       <td className="p-4">{r.endTime ? new Date(r.endTime).toLocaleString() : '-'}</td>
                       <td className="p-4 font-mono text-blue-400">{r.vin}</td>
                       <td className="p-4 font-bold">{r.user}</td>
                       <td className="p-4">{r.defectsCount}</td>
                       <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${r.status === 'COMPLETED' ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'}`}>{r.status}</span>
                       </td>
                       <td className="p-4 text-xs italic text-slate-400">{r.materials.map(m => `${m.name}(x${m.qty})`).join(', ')}</td>
                    </tr>
                  ))}
               </tbody>
            </table>
          );
      }

      if (activeTab === 'SUPPLY_PARTS') {
          return (
            <table className="w-full text-left">
               <thead className="bg-slate-800 sticky top-0 shadow-lg z-10">
                  <tr className="text-[10px] uppercase text-slate-400 tracking-widest">
                     <th className="p-4">Requested At</th>
                     <th className="p-4">Requester</th>
                     <th className="p-4">Type</th>
                     <th className="p-4">Identifier</th>
                     <th className="p-4">PN / Part Name</th>
                     <th className="p-4">Qty</th>
                     <th className="p-4">Status</th>
                     <th className="p-4">Processed By</th>
                     <th className="p-4">Processed At</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-800 text-sm">
                  {requests.map(r => (
                    <tr key={r.id} className="hover:bg-slate-800/50 transition-colors group">
                       <td className="p-4 text-xs text-slate-500">{new Date(r.requestedAt).toLocaleString()}</td>
                       <td className="p-4 font-bold">{r.requester}</td>
                       <td className="p-4"><span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded font-black">{r.type}</span></td>
                       <td className="p-4 font-mono text-xs">{r.vin || r.line || '-'}</td>
                       <td className="p-4">
                          <div className="flex flex-col">
                             <span className="font-mono text-blue-400 text-xs">{r.partNumber}</span>
                             <span className="text-xs text-slate-300">{r.partName}</span>
                          </div>
                       </td>
                       <td className="p-4 font-mono">{r.quantity}</td>
                       <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              r.status === 'APPROVED' ? 'bg-green-500/20 text-green-500' : 
                              r.status === 'UNAVAILABLE' ? 'bg-amber-500/20 text-amber-500' : 
                              r.status === 'MISSING_PART' ? 'bg-red-500/20 text-red-500' : 'bg-slate-700 text-slate-300'
                          }`}>{r.status}</span>
                       </td>
                       <td className="p-4 text-xs font-bold group-hover:text-blue-400 transition-colors">{r.processedBy || '-'}</td>
                       <td className="p-4 text-[10px] text-slate-500">{r.approvedAt ? new Date(r.approvedAt).toLocaleString() : '-'}</td>
                    </tr>
                  ))}
               </tbody>
            </table>
          );
      }

      return (
        <table className="w-full text-left">
            <thead className="bg-slate-800 sticky top-0 shadow-lg z-10">
                <tr className="text-[10px] uppercase text-slate-400 tracking-widest">
                    <th className="p-4">Date</th>
                    <th className="p-4">User</th>
                    <th className="p-4">Action</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Details</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm">
                {history.filter(h => activeTab === 'ALL' || h.category === activeTab).map(log => (
                <tr key={log.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-4 text-slate-500 text-xs">{new Date(log.date).toLocaleString()}</td>
                    <td className="p-4 font-bold">{log.user}</td>
                    <td className="p-4 uppercase font-black text-xs tracking-tighter">{log.action}</td>
                    <td className="p-4 text-[10px] font-black uppercase text-slate-500">{log.category}</td>
                    <td className="p-4 text-slate-400 text-xs italic">{log.details}</td>
                </tr>
                ))}
            </tbody>
        </table>
      );
  };

  return (
    <div className="flex flex-col min-h-screen pb-10">
       <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors shadow-lg"><ArrowLeft /></button>
                <h2 className="text-2xl font-black uppercase tracking-tighter">History</h2>
            </div>
            
            <div className="flex items-center gap-4 bg-slate-900 p-2 rounded-2xl border border-slate-800 shadow-xl">
                <div className="flex items-center gap-2 px-2 border-r border-slate-700">
                    <Calendar size={14} className="text-slate-500" />
                    <input 
                        type="date" 
                        value={exportStartDate} 
                        onChange={e => setExportStartDate(e.target.value)}
                        className="bg-transparent text-xs font-bold text-slate-300 outline-none w-28 cursor-pointer"
                        title="Data Início"
                    />
                    <span className="text-slate-600">to</span>
                    <input 
                        type="date" 
                        value={exportEndDate} 
                        onChange={e => setExportEndDate(e.target.value)}
                        className="bg-transparent text-xs font-bold text-slate-300 outline-none w-28 cursor-pointer"
                        title="Data Fim"
                    />
                </div>
                <button 
                  onClick={handleExportAll}
                  className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-green-500/10 active:scale-95"
                >
                  <Download size={14} /> Export XLSX
                </button>
            </div>
       </div>

       <div className="flex gap-4 border-b border-slate-800 mb-6 overflow-x-auto custom-scrollbar no-scrollbar">
          {['ALL', 'BOX_REPAIR', 'PARKING', 'REWORKERS', 'SUPPLY_PARTS', 'KPI_PRODUCTION'].map(t => (
            <button key={t} onClick={() => setActiveTab(t as any)} className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === t ? 'border-b-4 border-blue-500 text-blue-400 bg-blue-500/5' : 'text-slate-500 hover:text-slate-300'}`}>{t}</button>
          ))}
       </div>

       <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden flex-1 shadow-2xl flex flex-col">
          <div className="overflow-auto flex-1 custom-scrollbar">{renderContent()}</div>
       </div>
    </div>
  );
}
