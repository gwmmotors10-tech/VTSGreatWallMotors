
import React, { useState, useEffect } from 'react';
import { User, Vehicle, INITIAL_CAR_MODELS, INITIAL_COLORS } from '../types';
import { db } from '../services/mockSupabase';
import { ArrowLeft, Plus, Download, CheckCircle, Edit, Check, Loader2 } from 'lucide-react';

interface FastRepairProps {
  user: User;
  onBack: () => void;
}

export default function FastRepair({ user, onBack }: FastRepairProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');
  const [exportDate, setExportDate] = useState('');
  const [processingVin, setProcessingVin] = useState<string | null>(null);
  
  const [formMode, setFormMode] = useState<'ADD' | 'EDIT'>('ADD');
  const [newCar, setNewCar] = useState<Partial<Vehicle>>({
    vin: '',
    model: INITIAL_CAR_MODELS[0],
    color: INITIAL_COLORS[0],
    origin: 'FINAL LINE',
    destination: 'FAST REPAIR',
    observations: ''
  });
  const [customOrigin, setCustomOrigin] = useState('');
  const [originSelect, setOriginSelect] = useState('FINAL LINE');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await db.getVehicles();
      setVehicles(data);
    } catch (err) {
      console.error("Failed to load vehicles:", err);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
     setFormMode('ADD');
     setNewCar({
        vin: '', 
        model: INITIAL_CAR_MODELS[0], 
        color: INITIAL_COLORS[0], 
        origin: 'FINAL LINE', 
        destination: 'FAST REPAIR', 
        observations: ''
     });
     setOriginSelect('FINAL LINE');
     setCustomOrigin('');
     setShowAddModal(true);
  };

  const openEditModal = (v: Vehicle) => {
      setFormMode('EDIT');
      setNewCar({...v});
      const originParts = v.origin.split(' - ');
      if(['FINAL LINE', 'PARKING', 'OFFLINE'].includes(originParts[0])) {
          setOriginSelect(originParts[0]);
          setCustomOrigin('');
      } else {
          setOriginSelect('OTHERS');
          setCustomOrigin(originParts[1] || v.origin);
      }
      setShowAddModal(true);
  };

  const handleSave = async () => {
    if (!newCar.vin || newCar.vin.trim().length !== 17) {
      alert('VIN must be 17 characters.');
      return;
    }

    setIsSaving(true);
    try {
        const finalOrigin = originSelect === 'OTHERS' ? `OTHERS - ${customOrigin}` : originSelect;
        const finalDest = newCar.destination || 'FAST REPAIR';
        
        // Sincroniza status com o destino selecionado
        const finalStatus = finalDest === 'OFFLINE' ? 'OFFLINE' : (finalDest === 'AOFF' ? 'AOFF' : 'FAST REPAIR');

        const payload: Partial<Vehicle> = {
          model: newCar.model,
          color: newCar.color,
          origin: finalOrigin,
          destination: finalDest,
          status: finalStatus as any,
          observations: newCar.observations,
          missingParts: newCar.missingParts
        };

        if (finalStatus === 'AOFF' && !newCar.finishedAt) {
          payload.finishedAt = new Date().toISOString();
        }

        if(formMode === 'ADD') {
            await db.addVehicle({
              ...payload as Vehicle,
              vin: newCar.vin.trim().toUpperCase(),
              history: [],
              createdAt: new Date().toISOString(),
              createdBy: user.fullName
            });
            await db.logHistory(newCar.vin, 'ADD_VEHICLE', user.fullName, `Added to ${finalStatus}`, 'FAST_REPAIR');
        } else {
            await db.updateVehicle(newCar.vin!, payload);
            await db.logHistory(newCar.vin!, 'UPDATE_VEHICLE', user.fullName, `Updated (Origin: ${finalOrigin}, Dest: ${finalDest})`, 'FAST_REPAIR');
        }

        setShowAddModal(false);
        await refresh();
    } catch (err: any) {
        alert(`Operation failed: ${err.message || 'Check database connection and RLS policies.'}`);
    } finally {
        setIsSaving(false);
    }
  };

  const moveToAOFF = async (vin: string) => {
    if (processingVin) return;
    setProcessingVin(vin);
    try {
        const now = new Date().toISOString();
        await db.updateVehicle(vin, { 
          status: 'AOFF', 
          destination: 'AOFF', 
          finishedAt: now
        });
        await db.logHistory(vin, 'MOVE_AOFF', user.fullName, 'Manually moved to AOFF', 'FAST_REPAIR');
        await refresh();
    } catch (err: any) {
        alert(`Failed to finalize vehicle: ${err.message || 'Possible database or permission error.'}`);
    } finally {
        setProcessingVin(null);
    }
  };

  const handleExport = () => {
    let data = vehicles;
    if(exportDate) {
        data = data.filter(v => v.createdAt && v.createdAt.startsWith(exportDate));
    }
    db.exportData(data, 'FastRepair_Vehicles');
  };

  const canEdit = (v: Vehicle) => {
      if(!v.createdAt) return true;
      const diff = new Date().getTime() - new Date(v.createdAt).getTime();
      return diff < 30 * 60 * 1000; // 30 mins limit
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AOFF': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'OFFLINE': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'FAST REPAIR': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      default: return 'bg-slate-700';
    }
  };

  const filtered = vehicles.filter(v => v.vin.toUpperCase().includes(search.toUpperCase()));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition">
            <ArrowLeft />
          </button>
          <h2 className="text-2xl font-bold uppercase tracking-tight">Fast Repair (快速维修)</h2>
        </div>
        <div className="flex gap-4">
            <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
             <input 
                type="date" 
                className="bg-transparent text-sm text-slate-300 outline-none px-2"
                value={exportDate}
                onChange={e => setExportDate(e.target.value)}
             />
             <button onClick={handleExport} className="bg-green-600 px-3 py-1.5 rounded hover:bg-green-700 text-sm font-bold flex gap-1 transition">
               <Download size={16} /> XLSX
             </button>
           </div>
           <button onClick={openAddModal} className="bg-blue-600 px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition">
             <Plus size={18} /> Add Car (添加车辆)
           </button>
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-2xl min-h-[400px]">
        <input 
          className="w-full bg-slate-800 p-3 rounded-lg mb-4 text-white border border-slate-700 outline-none focus:border-blue-500 transition" 
          placeholder="Search VIN..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {loading && vehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-20">
                <Loader2 className="animate-spin mb-4" size={48} />
                <span className="font-bold uppercase tracking-widest">Loading Vehicles...</span>
            </div>
        ) : (
            <div className="space-y-3">
              {filtered.map((car, idx) => {
                const isAOFF = car.status === 'AOFF';
                const isProcessing = processingVin === car.vin;

                return (
                  <div key={idx} className={`p-4 rounded-xl border flex items-center justify-between transition-all hover:scale-[1.01] ${getStatusColor(car.status)}`}>
                    <div>
                       <div className="font-mono text-lg font-bold tracking-widest">{car.vin}</div>
                       <div className="text-sm opacity-80 font-medium">
                         {car.model} | {car.color} | <span className="text-blue-400">From: {car.origin}</span>
                       </div>
                       <div className="text-xs opacity-60 mt-1 italic">{car.observations || 'No observations'}</div>
                       <div className="text-[10px] text-white/50 mt-2 flex gap-4 uppercase font-bold tracking-widest">
                           {car.createdBy && <span>Resp: {car.createdBy}</span>}
                           {car.createdAt && <span>Added: {new Date(car.createdAt).toLocaleString()}</span>}
                       </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-black text-xs uppercase tracking-widest bg-black/20 px-3 py-1 rounded-full">{car.status}</span>
                      
                      {canEdit(car) && !isAOFF && (
                          <button onClick={() => openEditModal(car)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-xl transition" title="Edit">
                              <Edit size={16} />
                          </button>
                      )}

                      <button 
                        onClick={() => !isAOFF && !isProcessing && moveToAOFF(car.vin)}
                        disabled={isAOFF || isProcessing}
                        className={`p-2 rounded-xl transition-all shadow-lg min-w-[40px] flex items-center justify-center ${
                          isAOFF 
                            ? 'bg-green-600 text-white cursor-default scale-110 shadow-green-500/40' 
                            : isProcessing 
                              ? 'bg-slate-700 text-slate-500' 
                              : 'bg-slate-800 text-slate-400 hover:bg-green-600 hover:text-white'
                        }`}
                        title={isAOFF ? 'Car Finalized' : 'Move to AOFF'}
                      >
                        {isProcessing ? <Loader2 size={18} className="animate-spin" /> : (isAOFF ? <Check size={18} strokeWidth={3} /> : <CheckCircle size={18} />)}
                      </button>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && !loading && <div className="text-center py-10 opacity-30 font-bold uppercase">No vehicles found.</div>}
            </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-md">
           <div className="bg-slate-800 p-8 rounded-[2rem] w-full max-w-lg border border-slate-700 shadow-2xl space-y-6">
              <h3 className="text-2xl font-black mb-4 uppercase tracking-tighter text-blue-400">
                {formMode === 'ADD' ? 'Register Vehicle' : 'Modify Vehicle'}
              </h3>
              <div className="grid grid-cols-2 gap-6">
                 <div className="col-span-2">
                    <label className="text-[10px] text-slate-500 font-bold mb-1 block uppercase tracking-widest">VIN Number</label>
                    <input className="w-full bg-slate-900 p-3 rounded-xl border border-slate-600 text-white uppercase font-mono tracking-widest outline-none focus:border-blue-500" placeholder="VIN (17 chars)" maxLength={17} value={newCar.vin} onChange={e => setNewCar({...newCar, vin: e.target.value.toUpperCase()})} disabled={formMode === 'EDIT' || isSaving} />
                 </div>
                 <div>
                    <label className="text-[10px] text-slate-500 font-bold mb-1 block uppercase tracking-widest">Car Model</label>
                    <select className="w-full bg-slate-900 p-3 rounded-xl border border-slate-600 text-white outline-none focus:border-blue-500" value={newCar.model} onChange={e => setNewCar({...newCar, model: e.target.value})} disabled={isSaving}>
                      {INITIAL_CAR_MODELS.map(m => <option key={m}>{m}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="text-[10px] text-slate-500 font-bold mb-1 block uppercase tracking-widest">Color</label>
                    <select className="w-full bg-slate-900 p-3 rounded-xl border border-slate-600 text-white outline-none focus:border-blue-500" value={newCar.color} onChange={e => setNewCar({...newCar, color: e.target.value})} disabled={isSaving}>
                      {INITIAL_COLORS.map(c => <option key={c}>{c}</option>)}
                    </select>
                 </div>
                 
                 <div className="col-span-1">
                    <label className="text-[10px] text-slate-500 font-bold mb-1 block uppercase tracking-widest">Origin</label>
                    <select className="w-full bg-slate-900 p-3 rounded-xl border border-slate-600 text-white outline-none focus:border-blue-500" value={originSelect} onChange={e => setOriginSelect(e.target.value)} disabled={isSaving}>
                        <option>FINAL LINE</option>
                        <option>PARKING</option>
                        <option>OFFLINE</option>
                        <option>OTHERS</option>
                    </select>
                 </div>
                 {originSelect === 'OTHERS' ? (
                    <div>
                        <label className="text-[10px] text-slate-500 font-bold mb-1 block uppercase tracking-widest">Specify Origin</label>
                        <input className="w-full bg-slate-900 p-3 rounded-xl border border-slate-600 text-white outline-none focus:border-blue-500" placeholder="..." value={customOrigin} onChange={e => setCustomOrigin(e.target.value)} disabled={isSaving} />
                    </div>
                 ) : (
                    <div>
                        <label className="text-[10px] text-slate-500 font-bold mb-1 block uppercase tracking-widest">Target Destination</label>
                        <select className="w-full bg-slate-900 p-3 rounded-xl border border-slate-600 text-white outline-none focus:border-blue-500" value={newCar.destination} onChange={e => setNewCar({...newCar, destination: e.target.value})} disabled={isSaving}>
                            <option>FAST REPAIR</option>
                            <option>OFFLINE</option>
                            <option>AOFF</option>
                        </select>
                    </div>
                 )}

                 {originSelect === 'OTHERS' && (
                    <div className="col-span-2">
                        <label className="text-[10px] text-slate-500 font-bold mb-1 block uppercase tracking-widest">Target Destination</label>
                        <select className="w-full bg-slate-900 p-3 rounded-xl border border-slate-600 text-white outline-none focus:border-blue-500" value={newCar.destination} onChange={e => setNewCar({...newCar, destination: e.target.value})} disabled={isSaving}>
                            <option>FAST REPAIR</option>
                            <option>OFFLINE</option>
                            <option>AOFF</option>
                        </select>
                    </div>
                 )}
                 
                 <div className="col-span-2">
                    <label className="text-[10px] text-slate-500 font-bold mb-1 block uppercase tracking-widest">Observations</label>
                    <textarea className="w-full bg-slate-900 p-3 rounded-xl border border-slate-600 h-24 text-white outline-none focus:border-blue-500" placeholder="Enter notes..." value={newCar.observations} onChange={e => setNewCar({...newCar, observations: e.target.value})} disabled={isSaving}></textarea>
                 </div>
              </div>
              <div className="flex gap-4 mt-6">
                <button onClick={() => !isSaving && setShowAddModal(false)} className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 rounded-2xl font-bold transition disabled:opacity-50" disabled={isSaving}>Cancel</button>
                <button onClick={handleSave} className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50" disabled={isSaving}>
                  {isSaving && <Loader2 className="animate-spin" size={20} />}
                  {formMode === 'ADD' ? 'Save Vehicle' : 'Update Vehicle'}
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
