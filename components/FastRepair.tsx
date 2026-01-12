import React, { useState, useEffect, useMemo } from 'react';
import { User, Vehicle, INITIAL_CAR_MODELS, INITIAL_COLORS, RESPONSIBLE_SHOPS } from '../types';
import { db } from '../services/supabaseService';
import { ArrowLeft, Plus, CheckCircle, Edit, Check, Loader2, Minus, X, Save, Download, Zap, AlertCircle, CheckSquare, MapPin, Filter } from 'lucide-react';

interface FastRepairProps {
  user: User;
  onBack: () => void;
}

export default function FastRepair({ user, onBack }: FastRepairProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filterOrigin, setFilterOrigin] = useState('ALL');
  const [filterDestination, setFilterDestination] = useState('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  const [carForm, setCarForm] = useState<Partial<Vehicle> & { targetLane?: string; targetSpot?: string }>({
    vin: '', 
    model: INITIAL_CAR_MODELS[0], 
    color: INITIAL_COLORS[0], 
    origin: 'FINAL LINE', 
    destination: 'FAST REPAIR', 
    missingParts: [], 
    responsible: [],
    targetLane: '',
    targetSpot: ''
  });
  
  const [otherOrigin, setOtherOrigin] = useState('');
  const [newMissingPart, setNewMissingPart] = useState('');

  useEffect(() => { refresh(); }, []);

  const refresh = async () => {
    setLoading(true);
    try { 
      const data = await db.getVehicles(); 
      setVehicles(data); 
    } finally { 
      setLoading(false); 
    }
  };

  const openAdd = () => {
    setEditMode(false);
    setCarForm({ 
      vin: '', 
      model: INITIAL_CAR_MODELS[0], 
      color: INITIAL_COLORS[0], 
      origin: 'FINAL LINE', 
      destination: 'FAST REPAIR', 
      missingParts: [], 
      responsible: [],
      targetLane: '',
      targetSpot: ''
    });
    setShowModal(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditMode(true);
    setCarForm({ ...v, targetLane: '', targetSpot: '' });
    if (!['FINAL LINE', 'PARKING', 'OFFLINE'].includes(v.origin)) {
      setOtherOrigin(v.origin);
    }
    setShowModal(true);
  };

  const moveToAOFF = async (vin: string) => {
    if (!confirm('Mark vehicle as finished (AOFF)?')) return;
    try {
      await db.updateVehicle(vin, { status: 'AOFF', destination: 'AOFF', finishedAt: new Date().toISOString() });
      await db.logHistory(vin, 'MOVE_AOFF', user.fullName, 'Moved to AOFF status', 'FAST_REPAIR');
      refresh();
    } catch (error) {
      console.error("Error moving to AOFF:", error);
      alert('Failed to update vehicle status');
    }
  };

  const handleSave = async () => {
    if (!carForm.vin || carForm.vin.trim().length !== 17) return alert('VIN must be 17 chars.');
    
    const isParkingDest = carForm.destination === 'PARKING' || carForm.destination === 'BOX_REPAIR';
    if (isParkingDest && (!carForm.targetLane || !carForm.targetSpot)) {
      return alert('Lane and Spot (Vaga) are mandatory for this destination.');
    }

    setIsSaving(true);
    const finalOrigin = carForm.origin === 'OTHERS' ? otherOrigin : carForm.origin;
    
    try {
        const payload = {
          ...carForm,
          origin: finalOrigin || 'FINAL LINE',
          vin: carForm.vin.trim().toUpperCase(),
          status: carForm.destination === 'AOFF' ? 'AOFF' : (carForm.destination === 'OFFLINE' ? 'OFFLINE' : 'FAST REPAIR')
        } as Vehicle;

        if (editMode) {
          await db.updateVehicle(payload.vin, payload);
          await db.logHistory(payload.vin, 'UPDATE_VEHICLE', user.fullName, `Updated info in Fast Repair (Target: ${payload.destination})`, 'FAST_REPAIR');
        } else {
          payload.createdAt = new Date().toISOString();
          payload.createdBy = user.fullName;
          await db.addVehicle(payload);
          await db.logHistory(payload.vin, 'ADD_VEHICLE', user.fullName, `Added to ${payload.destination}`, 'FAST_REPAIR');
        }

        if (isParkingDest) {
          const area = carForm.destination as 'PARKING' | 'BOX_REPAIR';
          const spotId = `${area}-${carForm.targetLane!.toUpperCase()}-${carForm.targetSpot}`;
          
          try {
            await db.updateSpot(spotId, {
              vin: payload.vin,
              allocatedBy: user.fullName,
              allocatedAt: new Date().toISOString(),
              shop: payload.responsible[0] || 'Fast Repair',
              observations: payload.observations || 'Allocated via Fast Repair',
              missingParts: payload.missingParts
            });
            await db.logHistory(payload.vin, 'AUTO_ALLOCATION', user.fullName, `Auto-allocated to ${spotId} from Fast Repair`, 'SYSTEM');
          } catch (spotError) {
            console.error("Auto-allocation failed:", spotError);
            alert(`Vehicle saved, but auto-allocation to spot ${spotId} failed. Please check if the spot exists.`);
          }
        }

        setShowModal(false);
        refresh();
    } catch (err) {
      console.error("Save error:", err);
      alert("Error saving vehicle.");
    } finally { setIsSaving(false); }
  };

  const toggleResponsible = (shop: string) => {
    const current = carForm.responsible || [];
    const updated = current.includes(shop) ? current.filter(s => s !== shop) : [...current, shop];
    setCarForm({ ...carForm, responsible: updated });
  };

  const addPart = () => {
    if(!newMissingPart.trim()) return;
    setCarForm({ ...carForm, missingParts: [...(carForm.missingParts || []), newMissingPart.trim().toUpperCase()] });
    setNewMissingPart('');
  };

  const handleExport = () => {
    const activeUnits = vehicles.filter(v => v.status !== 'AOFF');
    if (activeUnits.length === 0) return alert("No active units found to export.");

    const exportData = activeUnits.map(v => ({
      "VIN NUMBER": v.vin,
      "DATA DE INCLUSAO": new Date(v.createdAt).toLocaleString(),
      "MODEL": v.model,
      "COLOR": v.color,
      "ORIGIN": v.origin,
      "DESTINATION": v.destination,
      "RESPONSIBLE SHOPS": v.responsible?.join(', ') || 'N/A',
      "MISSING PARTS": v.missingParts?.join(', ') || 'None',
      "OBSERVATIONS": v.observations || ''
    }));

    db.exportData(exportData, 'Active_FastRepair_Offline_Units');
  };

  const dailyCounts = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayVehicles = vehicles.filter(v => v.createdAt?.startsWith(today));
    
    return {
      fastRepair: todayVehicles.filter(v => v.status === 'FAST REPAIR').length,
      offline: todayVehicles.filter(v => v.status === 'OFFLINE').length,
      aoff: todayVehicles.filter(v => v.status === 'AOFF').length
    };
  }, [vehicles]);

  const uniqueOrigins = useMemo(() => {
    const set = new Set<string>();
    vehicles.forEach(v => set.add(v.origin));
    return Array.from(set).sort();
  }, [vehicles]);

  const uniqueDestinations = useMemo(() => {
    const set = new Set<string>();
    vehicles.forEach(v => set.add(v.destination));
    return Array.from(set).sort();
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const matchVin = v.vin.includes(search.toUpperCase());
      const matchOrigin = filterOrigin === 'ALL' || v.origin === filterOrigin;
      const matchDest = filterDestination === 'ALL' || v.destination === filterDestination;
      return matchVin && matchOrigin && matchDest;
    });
  }, [vehicles, search, filterOrigin, filterDestination]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition"><ArrowLeft /></button>
          <h2 className="text-2xl font-bold uppercase tracking-tight text-white">Fast Repair / Offline / Workshop</h2>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExport} className="bg-green-600/10 text-green-500 border border-green-500/50 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-green-600 hover:text-white transition flex items-center gap-2 shadow-lg">
            <Download size={18} /> Export XLSX
          </button>
          <button onClick={openAdd} className="bg-blue-600 px-6 py-2 rounded-xl flex items-center gap-2 hover:bg-blue-700 shadow-lg transition font-black uppercase text-xs tracking-widest">
            <Plus size={18} /> Add Car
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl flex items-center justify-between hover:border-yellow-500/30 transition-all group">
           <div>
             <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Today's Fast Repair</p>
             <h4 className="text-4xl font-black text-yellow-500">{dailyCounts.fastRepair}</h4>
           </div>
           <Zap className="text-yellow-500/10 group-hover:text-yellow-500/20 transition-all" size={56} />
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl flex items-center justify-between hover:border-red-500/30 transition-all group">
           <div>
             <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Today's Offline</p>
             <h4 className="text-4xl font-black text-red-500">{dailyCounts.offline}</h4>
           </div>
           <AlertCircle className="text-red-500/10 group-hover:text-red-500/20 transition-all" size={56} />
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl flex items-center justify-between hover:border-green-500/30 transition-all group">
           <div>
             <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Today's AOFF (Finished)</p>
             <h4 className="text-4xl font-black text-green-500">{dailyCounts.aoff}</h4>
           </div>
           <CheckSquare className="text-green-500/10 group-hover:text-green-500/20 transition-all" size={56} />
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1.5 block px-1">VIN Search</label>
            <input 
              className="w-full bg-slate-800 p-4 rounded-xl text-white border border-slate-700 outline-none focus:border-blue-500 transition-all font-medium shadow-inner" 
              placeholder="Search VIN..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          
          <div className="w-full md:w-64">
            <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1.5 block px-1 flex items-center gap-1.5">
              <Filter size={10} /> Origin Filter
            </label>
            <select 
              className="w-full bg-slate-800 p-4 rounded-xl text-white border border-slate-700 outline-none focus:border-blue-500 transition-all font-bold appearance-none shadow-inner"
              value={filterOrigin}
              onChange={e => setFilterOrigin(e.target.value)}
            >
              <option value="ALL">ALL ORIGINS</option>
              {uniqueOrigins.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div className="w-full md:w-64">
            <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1.5 block px-1 flex items-center gap-1.5">
              <Filter size={10} /> Target Filter
            </label>
            <select 
              className="w-full bg-slate-800 p-4 rounded-xl text-white border border-slate-700 outline-none focus:border-blue-500 transition-all font-bold appearance-none shadow-inner"
              value={filterDestination}
              onChange={e => setFilterDestination(e.target.value)}
            >
              <option value="ALL">ALL TARGETS</option>
              {uniqueDestinations.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {loading ? <div className="text-center py-20 opacity-20"><Loader2 className="animate-spin mx-auto w-12 h-12" /></div> : (
            <div className="space-y-4 pt-4 border-t border-slate-800/50">
              {filteredVehicles.map((car, idx) => (
                <div key={idx} className={`p-5 rounded-2xl border flex items-center justify-between transition-all ${car.status === 'AOFF' ? 'bg-slate-900/50 border-green-500/20 opacity-60' : 'bg-slate-800 border-slate-700 hover:border-slate-600 shadow-sm'}`}>
                  <div className="flex-1">
                    <div className="font-mono text-lg font-black flex items-center gap-3 tracking-widest text-white">
                       {car.vin}
                       <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-black uppercase tracking-widest ${
                         car.status === 'AOFF' ? 'border-green-500 text-green-500 bg-green-500/10' : 
                         car.status === 'OFFLINE' ? 'border-red-500 text-red-500 bg-red-500/10' :
                         'border-yellow-500 text-yellow-500 bg-yellow-500/10'
                       }`}>{car.status}</span>
                       {car.missingParts?.length > 0 && <span className="bg-orange-600/20 text-orange-500 text-[10px] px-2.5 py-0.5 rounded-full border border-orange-500/50 uppercase font-black tracking-widest">Parts Missing</span>}
                    </div>
                    <div className="text-xs mt-2 flex flex-wrap gap-x-4 gap-y-1 text-slate-400 font-medium">
                       <span><strong className="text-slate-500">MODEL:</strong> {car.model}</span>
                       <span><strong className="text-slate-500">COLOR:</strong> {car.color}</span>
                       <span><strong className="text-slate-500 font-black">FROM:</strong> {car.origin}</span>
                       <span><strong className="text-slate-500 font-black">TARGET:</strong> {car.destination}</span>
                       <span><strong className="text-slate-500">RESP:</strong> {car.responsible?.join(', ') || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => openEdit(car)} className="p-3 bg-slate-700 hover:bg-slate-600 rounded-xl transition shadow-sm" title="Edit Vehicle Info"><Edit size={20}/></button>
                    {car.status !== 'AOFF' && (
                      <button onClick={() => moveToAOFF(car.vin)} className="p-3 bg-green-600 hover:bg-green-700 rounded-xl transition shadow-lg shadow-green-500/20" title="Finalize (AOFF)"><CheckCircle size={20}/></button>
                    )}
                    {car.status === 'AOFF' && <div className="p-3 text-green-500"><Check size={24} strokeWidth={3} /></div>}
                  </div>
                </div>
              ))}
              {filteredVehicles.length === 0 && (
                <div className="text-center py-20 text-slate-600 font-black uppercase tracking-widest italic opacity-20">No vehicles matching filters</div>
              )}
            </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-md p-4">
           <div className="bg-slate-800 p-8 rounded-[2.5rem] w-full max-w-lg border border-slate-700 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-4">
                <h3 className="text-2xl font-black uppercase text-blue-400 tracking-tighter">{editMode ? 'Modify' : 'Register'} Vehicle</h3>
                <button onClick={() => setShowModal(false)} className="p-2 bg-slate-700 rounded-full text-slate-400 hover:text-white transition shadow-lg"><X size={20}/></button>
              </div>
              <div className="space-y-6">
                 <div>
                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2 block">VIN (17 characters)</label>
                    <input disabled={editMode} className="w-full bg-slate-900 border border-slate-700 p-4 rounded-2xl text-white uppercase font-mono tracking-widest outline-none focus:border-blue-500 transition-all shadow-inner" placeholder="ENTER VIN..." maxLength={17} value={carForm.vin} onChange={e => setCarForm({...carForm, vin: e.target.value.toUpperCase()})} />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2 block">Model</label>
                        <select className="w-full bg-slate-900 border border-slate-700 p-4 rounded-2xl text-white outline-none focus:border-blue-500 transition-all font-bold appearance-none shadow-inner" value={carForm.model} onChange={e => setCarForm({...carForm, model: e.target.value})}>
                            {INITIAL_CAR_MODELS.map(m => <option key={m}>{m}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2 block">Color</label>
                        <select className="w-full bg-slate-900 border border-slate-700 p-4 rounded-2xl text-white outline-none focus:border-blue-500 transition-all font-bold appearance-none shadow-inner" value={carForm.color} onChange={e => setCarForm({...carForm, color: e.target.value})}>
                            {INITIAL_COLORS.map(c => <option key={c}>{c}</option>)}
                        </select>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2 block">Source Origin</label>
                        <select className="w-full bg-slate-900 border border-slate-700 p-4 rounded-2xl text-white outline-none focus:border-blue-500 transition-all font-bold appearance-none shadow-inner" value={['FINAL LINE', 'PARKING', 'OFFLINE'].includes(carForm.origin!) ? carForm.origin : 'OTHERS'} onChange={e => setCarForm({...carForm, origin: e.target.value})}>
                            <option value="FINAL LINE">FINAL LINE</option>
                            <option value="PARKING">PARKING</option>
                            <option value="OFFLINE">OFFLINE</option>
                            <option value="OTHERS">OTHERS (Manual)</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2 block">Target Destination</label>
                        <select className="w-full bg-slate-900 border border-slate-700 p-4 rounded-2xl text-white outline-none focus:border-blue-500 transition-all font-bold appearance-none shadow-inner" value={carForm.destination} onChange={e => setCarForm({...carForm, destination: e.target.value})}>
                            <option value="FAST REPAIR">FAST REPAIR</option>
                            <option value="OFFLINE">OFFLINE</option>
                            <option value="PARKING">PARKING</option>
                            <option value="BOX_REPAIR">BOX REPAIR</option>
                            <option value="AOFF">AOFF (Finished)</option>
                        </select>
                    </div>
                 </div>

                 {(carForm.destination === 'PARKING' || carForm.destination === 'BOX_REPAIR') && (
                    <div className="grid grid-cols-2 gap-4 bg-blue-600/5 p-4 rounded-2xl border border-blue-500/20 shadow-inner animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="col-span-2 flex items-center gap-2 mb-1">
                        <MapPin size={14} className="text-blue-400" />
                        <span className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Allocation Details</span>
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 font-black uppercase mb-1 block tracking-wider">Lane</label>
                        <input className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl text-white uppercase font-mono outline-none focus:border-blue-500" placeholder="e.g. A" value={carForm.targetLane} onChange={e => setCarForm({...carForm, targetLane: e.target.value.toUpperCase()})} />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 font-black uppercase mb-1 block tracking-wider">Vaga (Spot #)</label>
                        <input className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl text-white font-mono outline-none focus:border-blue-500" placeholder="e.g. 1" value={carForm.targetSpot} onChange={e => setCarForm({...carForm, targetSpot: e.target.value})} />
                      </div>
                    </div>
                 )}

                 {carForm.origin === 'OTHERS' && (
                    <div>
                        <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2 block">Specify Source</label>
                        <input className="w-full bg-slate-900 border border-slate-700 p-4 rounded-2xl text-white outline-none focus:border-blue-500 shadow-inner" placeholder="Where did it come from?" value={otherOrigin} onChange={e => setOtherOrigin(e.target.value)} />
                    </div>
                 )}

                 <div>
                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2 block">Responsible Shops</label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-900/50 border border-slate-700 p-4 rounded-2xl max-h-48 overflow-auto custom-scrollbar shadow-inner">
                        {RESPONSIBLE_SHOPS.map(s => (
                          <label key={s} className="flex items-center gap-3 cursor-pointer group p-2 hover:bg-slate-800 rounded-xl transition-all">
                             <input type="checkbox" checked={carForm.responsible?.includes(s)} onChange={() => toggleResponsible(s)} className="w-5 h-5 rounded-lg bg-slate-700 border-slate-600 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer" />
                             <span className="text-[11px] text-slate-300 group-hover:text-white transition uppercase font-black tracking-wider">{s}</span>
                          </label>
                        ))}
                    </div>
                 </div>

                 <div>
                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2 block">Missing Parts Constraints</label>
                    <div className="flex gap-2 mb-3">
                        <input className="flex-1 bg-slate-900 border border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 transition-all shadow-inner" value={newMissingPart} onChange={e => setNewMissingPart(e.target.value)} placeholder="Add description..." />
                        <button onClick={addPart} className="bg-blue-600 px-6 rounded-xl hover:bg-blue-700 transition-all shadow-lg active:scale-95"><Plus size={24}/></button>
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-auto custom-scrollbar p-1">
                        {carForm.missingParts?.length === 0 ? (
                           <p className="text-[10px] italic text-slate-600 font-bold uppercase tracking-widest px-1">No missing parts</p>
                        ) : (
                          carForm.missingParts?.map((p, i) => (
                             <span key={i} className="bg-slate-700 border border-slate-600 text-[10px] px-4 py-1.5 rounded-full flex items-center gap-3 font-black text-slate-200 shadow-sm">
                                {p}
                                <button onClick={() => setCarForm({...carForm, missingParts: carForm.missingParts?.filter((_,idx)=>idx!==i)})} className="text-red-400 hover:text-red-300 transition-colors"><Minus size={14} strokeWidth={3}/></button>
                             </span>
                          ))
                        )}
                    </div>
                 </div>

                 <div>
                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2 block">Maintenance Observations</label>
                    <textarea className="w-full bg-slate-900 border border-slate-700 p-4 rounded-2xl text-white h-32 outline-none resize-none focus:border-blue-500 transition-all font-medium shadow-inner" value={carForm.observations} onChange={e => setCarForm({...carForm, observations: e.target.value})} placeholder="Maintenance logs or repair notes..." />
                 </div>
              </div>
              <div className="flex gap-4 pt-4 border-t border-slate-700">
                <button onClick={() => setShowModal(false)} className="flex-1 py-5 bg-slate-700 rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] hover:bg-slate-600 transition shadow-lg">Cancel</button>
                <button onClick={handleSave} disabled={isSaving} className="flex-1 py-5 bg-blue-600 rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-3 hover:bg-blue-700 transition active:scale-95">
                   {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />} {editMode ? 'Update Data' : 'Save Vehicle'}
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
