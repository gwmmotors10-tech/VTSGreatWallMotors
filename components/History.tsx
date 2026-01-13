
import React, { useState, useEffect } from 'react';
import { User, HistoryCategory, ReworkSession, RequestPart, HistoryLog, Vehicle } from '../types';
import { db } from '../services/supabaseService';
import { ArrowLeft, Download, Clock, Package, UserCheck, Calendar } from 'lucide-react';

interface Props {
  user: User;
  onBack: () => void;
}

export default function History({ user, onBack }: Props) {
  const [history, setHistory] = useState<HistoryLog[]>([]);
  const [reworks, setReworks] = useState<ReworkSession[]>([]);
  const [requests, setRequests] = useState<RequestPart[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const canAccessHistory = user.role === 'Admin' || user.permissions.includes('HISTORY') || user.permissions.includes('VIEW_ALL_LOGS');

  useEffect(() => {
    if (canAccessHistory) {
      db.getHistory().then(setHistory);
      db.getReworks().then(setReworks);
      db.getRequests().then(setRequests);
      db.getVehicles().then(setVehicles);
    }
  }, [canAccessHistory]);

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const calculateLeadTime = (start: string, end?: string) => {
    if (!start || !end) return '-';
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return diffMins >= 0 ? `${diffMins} min` : '-';
  };

  const handleExport = () => {
    let dataToExport = [];
    let fileName = "VTS_History";

    const filterByDate = (items: any[], dateField: string) => {
      if (!startDate && !endDate) return items;
      return items.filter(item => {
        const dateVal = item[dateField];
        if (!dateVal) return false;
        const itemDate = new Date(dateVal).toISOString().split('T')[0];
        const start = startDate || '1970-01-01';
        const end = endDate || '9999-12-31';
        return itemDate >= start && itemDate <= end;
      });
    };

    if (activeTab === 'FAST_REPAIR_HISTORY') {
      fileName = "FastRepair_Detailed_History";
      dataToExport = filterByDate(vehicles, 'createdAt').map(v => ({
        "VIN NUMBER": v.vin,
        "DATA DE INCLUSAO": formatDateTime(v.createdAt),
        "CONCLUSAO (AOFF)": v.finishedAt ? formatDateTime(v.finishedAt) : 'Pending',
        "LEAD TIME (MIN)": calculateLeadTime(v.createdAt, v.finishedAt).replace(' min', ''),
        "MODEL": v.model,
        "COLOR": v.color,
        "ORIGIN": v.origin,
        "DESTINATION": v.destination,
        "RESPONSIBLE SHOPS": v.responsible?.join(', ') || 'N/A',
        "MISSING PARTS": v.missingParts?.join(', ') || 'None',
        "OBSERVATIONS": v.observations || ''
      }));
    } else if (activeTab === 'REWORKERS') {
      fileName = "Rework_History";
      dataToExport = filterByDate(reworks, 'startTime').map(r => ({
        "Start Time": formatDateTime(r.startTime),
        "End Time": r.endTime ? formatDateTime(r.endTime) : '-',
        "VIN": r.vin,
        "Responsible": r.user,
        "Defects Count": r.defectsCount,
        "Shop": r.shop,
        "Status": r.status,
        "Materials Used": r.materials.map(m => `${m.name} (x${m.qty})`).join(', '),
        "Observations": r.observations
      }));
    } else if (activeTab === 'SUPPLY_LINE' || activeTab === 'SUPPLY_REPAIR') {
      const type = activeTab === 'SUPPLY_LINE' ? 'LINE' : 'REPAIR';
      fileName = `Supply_${type}_History`;
      dataToExport = filterByDate(requests.filter(r => r.type === type), 'requestedAt').map(r => ({
        "Data Requisição": formatDateTime(r.requestedAt),
        "Requisitante": r.requester,
        "Part Number": r.partNumber,
        "Part Name": r.partName,
        "Quantidade": r.quantity,
        "Status": r.status,
        "Aprovador": r.processedBy || '-',
        "Data Aprovação": r.approvedAt ? formatDateTime(r.approvedAt) : '-',
        "Batch Retirada": r.batchRetirada || '-',
        "Case Retirada": r.caseRetirada || '-'
      }));
    } else {
      dataToExport = filterByDate(history.filter(h => activeTab === 'ALL' || h.category === activeTab), 'date').map(h => ({
        "Date": formatDateTime(h.date),
        "User": h.user,
        "Action": h.action,
        "Category": h.category,
        "Details": h.details
      }));
    }

    if (dataToExport.length === 0) return alert("No data found for selected range/tab.");
    db.exportData(dataToExport, fileName);
  };

  if (!canAccessHistory) {
    return <div className="text-center py-20 text-red-500 font-bold">Access Denied</div>;
  }

  const renderContent = () => {
    if (activeTab === 'REWORKERS') {
      return (
        <table className="w-full text-left">
           <thead className="bg-slate-800 sticky top-0 shadow-lg z-10">
              <tr className="text-[10px] uppercase text-slate-400 tracking-widest">
                 <th className="p-4">Start</th>
                 <th className="p-4">VIN</th>
                 <th className="p-4">Responsible</th>
                 <th className="p-4">Defects</th>
                 <th className="p-4">Materials Used</th>
              </tr>
           </thead>
           <tbody className="divide-y divide-slate-800 text-sm">
              {reworks.map(r => (
                <tr key={r.id} className="hover:bg-slate-800/50 transition-colors">
                   <td className="p-4">{formatDateTime(r.startTime)}</td>
                   <td className="p-4 font-mono text-blue-400">{r.vin}</td>
                   <td className="p-4 font-bold">{r.user}</td>
                   <td className="p-4">{r.defectsCount}</td>
                   <td className="p-4 text-xs italic text-slate-400">
                     {r.materials.map(m => `${m.name} (x${m.qty})`).join(', ') || 'None'}
                   </td>
                </tr>
              ))}
           </tbody>
        </table>
      );
    }

    if (activeTab === 'FAST_REPAIR_HISTORY') {
      return (
        <table className="w-full text-left">
           <thead className="bg-slate-800 sticky top-0 shadow-lg z-10">
              <tr className="text-[10px] uppercase text-slate-400 tracking-widest">
                 <th className="p-4">VIN Number</th>
                 <th className="p-4">Inclusão</th>
                 <th className="p-4">Conclusão (AOFF)</th>
                 <th className="p-4 text-center">Lead Time</th>
                 <th className="p-4">Model/Color</th>
                 <th className="p-4">Route (Origin/Dest)</th>
                 <th className="p-4">Responsible</th>
                 <th className="p-4">Constraints</th>
              </tr>
           </thead>
           <tbody className="divide-y divide-slate-800 text-[11px]">
              {vehicles.map(v => (
                <tr key={v.vin} className="hover:bg-slate-800/50 transition-colors">
                   <td className="p-4 font-mono font-black text-white tracking-widest">{v.vin}</td>
                   <td className="p-4 text-slate-500 font-medium">{formatDateTime(v.createdAt)}</td>
                   <td className="p-4 text-green-500 font-medium">{v.finishedAt ? formatDateTime(v.finishedAt) : '-'}</td>
                   <td className="p-4 text-center">
                     <span className="bg-blue-600/20 text-blue-400 px-2 py-1 rounded font-bold">
                       {calculateLeadTime(v.createdAt, v.finishedAt)}
                     </span>
                   </td>
                   <td className="p-4 font-bold">
                      <div className="text-white">{v.model}</div>
                      <div className="text-slate-500 font-black">{v.color}</div>
                   </td>
                   <td className="p-4">
                      <div className="text-blue-400 font-bold">{v.origin}</div>
                      <div className="text-slate-500 font-black">{"->"} {v.destination}</div>
                   </td>
                   <td className="p-4 text-slate-300 font-bold">{v.responsible?.join(', ') || '-'}</td>
                   <td className="p-4 text-slate-400 italic max-w-xs truncate">{v.missingParts?.join(', ') || 'None'}</td>
                </tr>
              ))}
           </tbody>
        </table>
      );
    }

    if (activeTab === 'SUPPLY_LINE' || activeTab === 'SUPPLY_REPAIR') {
      const type = activeTab === 'SUPPLY_LINE' ? 'LINE' : 'REPAIR';
      return (
        <table className="w-full text-left">
           <thead className="bg-slate-800 sticky top-0 shadow-lg z-10">
              <tr className="text-[10px] uppercase text-slate-400 tracking-widest">
                 <th className="p-4">Requisição (User/Time)</th>
                 <th className="p-4">Part Details</th>
                 <th className="p-4">Aprovação (Approver/Time)</th>
                 <th className="p-4">Retirada (Batch/Case)</th>
                 <th className="p-4">Recebimento (User/Time)</th>
              </tr>
           </thead>
           <tbody className="divide-y divide-slate-800 text-xs">
              {requests.filter(r => r.type === type).map(r => (
                <tr key={r.id} className="hover:bg-slate-800/50 transition-colors">
                   <td className="p-4">
                      <div className="font-bold">{r.requester}</div>
                      <div className="text-slate-500">{formatDateTime(r.requestedAt)}</div>
                   </td>
                   <td className="p-4">
                      <div className="font-mono font-bold text-blue-400">{r.partNumber}</div>
                      <div>{r.partName} (x{r.quantity})</div>
                   </td>
                   <td className="p-4">
                      {r.approvedAt ? (
                        <>
                          <div className="font-bold text-green-500">{r.processedBy}</div>
                          <div className="text-slate-500">{formatDateTime(r.approvedAt)}</div>
                        </>
                      ) : '-'}
                   </td>
                   <td className="p-4">
                      {r.batchRetirada ? (
                        <div>B:{r.batchRetirada} / C:{r.caseRetirada}</div>
                      ) : '-'}
                   </td>
                   <td className="p-4">
                      {r.receivedAt ? (
                        <>
                          <div className="font-bold text-blue-500">{r.receiverName}</div>
                          <div className="text-slate-500">{formatDateTime(r.receivedAt)}</div>
                        </>
                      ) : '-'}
                   </td>
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
                <td className="p-4 text-slate-500 text-xs">{formatDateTime(log.date)}</td>
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
                <button onClick={onBack} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition shadow-lg"><ArrowLeft /></button>
                <h2 className="text-2xl font-black uppercase tracking-tighter">System Intelligence Logs</h2>
            </div>
            <div className="flex items-center gap-4 bg-slate-900 p-2 rounded-2xl border border-slate-800 shadow-xl">
               <div className="flex items-center gap-2 px-3 border-r border-slate-700">
                  <Calendar size={14} className="text-slate-500" />
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-xs font-bold outline-none cursor-pointer text-white" title="Data Início" />
                  <span className="text-slate-600 px-1">to</span>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-xs font-bold outline-none cursor-pointer text-white" title="Data Fim" />
               </div>
               <button onClick={handleExport} className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg active:scale-95">
                   <Download size={14} /> Export Range XLSX
               </button>
            </div>
       </div>

       <div className="flex gap-4 border-b border-slate-800 mb-6 overflow-x-auto no-scrollbar">
          {['ALL', 'BOX_REPAIR', 'PARKING', 'REWORKERS', 'SUPPLY_LINE', 'SUPPLY_REPAIR', 'KPI', 'FAST_REPAIR_HISTORY'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === t ? 'border-b-4 border-blue-500 text-blue-400 bg-blue-500/5' : 'text-slate-500 hover:text-slate-300'}`}>{t.replace('_HISTORY', '').replace('_', ' ')}</button>
          ))}
       </div>

       <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden flex-1 shadow-2xl overflow-auto custom-scrollbar">
          {renderContent()}
       </div>
    </div>
  );
}
