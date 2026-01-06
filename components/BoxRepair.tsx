
import React, { useState, useEffect, useMemo } from 'react';
import { User, ParkingSpot, SHOPS, Vehicle } from '../types';
import { db } from '../services/supabaseService';
import { Search, ArrowLeft, Plus, Minus, MapPin, Megaphone, Settings, Save, X, Move, Trash2, Edit3, Loader2, PlusCircle, MinusCircle, LayoutGrid } from 'lucide-react';

interface BoxRepairProps {
  user: User;
  onBack: () => void;
  mode?: 'BOX_REPAIR' | 'PARKING';
}

export default function BoxRepair({ user, onBack, mode = 'BOX_REPAIR' }: BoxRepairProps) {
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchVin, setSearchVin] = useState('');
  const [highlightedSpotId, setHighlightedSpotId] = useState<string | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [allocationForm, setAllocationForm] = useState({ vin: '', shop: SHOPS[0], obs: '', missingParts: [] as string[] });
  const [newMissingPart, setNewMissingPart] = useState('');
  const [isManageMode, setIsManageMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMoveMode, setIsMoveMode] = useState(false);

  const canManageLayout = user.role === 'Admin' || user.permissions.includes('MANAGE_LAYOUT');
  const canSetPriority = user.role === 'Admin' || user.permissions.includes('SET_PRIORITY');
  const canCallQuality = user.role === 'Admin' || user.permissions.includes('CALL_QUALITY');

  useEffect(() => {
    loadSpots();
    const interval = setInterval(loadSpots, 5000);
    return () => clearInterval(interval);
  }, [mode]);

  const loadSpots = async () => {
    try {
      const data = await db.getSpots(mode);
      setSpots(data);
      setLoading(false);
    } catch (error) {
      console.error("Error loading spots:", error);
    }
  };

  const handleSearch = () => {
    if (!searchVin) return;
    const found = spots.find(s => s.vin && (s.vin === searchVin || s.vin.endsWith(searchVin)));
    if (found) {
      setHighlightedSpotId(found.id);
      setTimeout(() => setHighlightedSpotId(null), 5000);
      const el = document.getElementById(`spot-${found.id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleSpotClick = async (spot: ParkingSpot) => {
    if (user.role === 'Visitor' || isSubmitting) return;

    if (isMoveMode && selectedSpot) {
      if (spot.vin) {
        alert("Destination spot must be empty to move vehicle.");
        return;
      }
      setIsSubmitting(true);
      try {
        await db.swapSpots(selectedSpot.id, spot.id, user.fullName);
        setIsMoveMode(false);
        setSelectedSpot(null);
        await loadSpots();
      } catch (err) {
        alert("Move failed.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setAllocationForm({ 
      vin: spot.vin || '', 
      shop: spot.shop || SHOPS[0], 
      obs: spot.observations || '', 
      missingParts: spot.missingParts || [] 
    });
    setSelectedSpot(spot);
  };

  const handleCallQuality = async () => {
    if(!selectedSpot || !canCallQuality || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const newState = !selectedSpot.callQuality;
      await db.updateSpot(selectedSpot.id, { callQuality: newState });
      if(newState) await db.logHistory(selectedSpot.vin || 'N/A', 'QUALITY_CALL', user.fullName, `Quality call at spot ${selectedSpot.id}`, mode === 'BOX_REPAIR' ? 'BOX_REPAIR' : 'PARKING');
      setSelectedSpot(null);
      await loadSpots();
    } catch (err) {
      alert("Failed to update quality call status.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAllocate = async () => {
    if (!selectedSpot || isSubmitting) return;
    const cleanVin = allocationForm.vin.trim().toUpperCase();
    
    if (cleanVin.length !== 17) {
      alert("VIN must be exactly 17 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: existingVehicles } = await db.supabase
        .from('vehicles')
        .select('vin')
        .eq('vin', cleanVin);

      if (!existingVehicles || existingVehicles.length === 0) {
        const newVehicle: Vehicle = {
          vin: cleanVin,
          model: 'GENERIC',
          color: 'UNKNOWN',
          origin: mode === 'BOX_REPAIR' ? 'BOX REPAIR' : 'PARKING',
          destination: mode === 'BOX_REPAIR' ? 'BOX REPAIR' : 'PARKING',
          status: 'OFFLINE',
          missingParts: allocationForm.missingParts,
          observations: allocationForm.obs,
          responsible: [allocationForm.shop],
          createdAt: new Date().toISOString(),
          createdBy: user.fullName
        };
        
        const { error: vError } = await db.supabase.from('vehicles').insert({
          vin: newVehicle.vin,
          model: newVehicle.model,
          color: newVehicle.color,
          origin: newVehicle.origin,
          destination: newVehicle.destination,
          status: newVehicle.status,
          missing_parts: newVehicle.missingParts,
          observations: newVehicle.observations,
          responsible: newVehicle.responsible,
          created_at: newVehicle.createdAt,
          created_by: newVehicle.createdBy
        });
        if (vError) throw new Error("Failed to register vehicle: " + vError.message);
      }

      await db.updateSpot(selectedSpot.id, { 
        vin: cleanVin, 
        allocatedBy: user.fullName, 
        allocatedAt: selectedSpot.allocatedAt || new Date().toISOString(), 
        shop: allocationForm.shop, 
        observations: allocationForm.obs,
        missingParts: allocationForm.missingParts,
        callQuality: false 
      });

      await db.logHistory(cleanVin, 'ALLOCATION_UPDATE', user.fullName, `Allocated/Updated spot ${selectedSpot.id}`, mode === 'BOX_REPAIR' ? 'BOX_REPAIR' : 'PARKING');
      setSelectedSpot(null);
      await loadSpots();
    } catch (err: any) {
      console.error("Allocation Error:", err);
      alert("Action failed: " + (err.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeallocate = async () => {
    if (!selectedSpot || !selectedSpot.vin || isSubmitting) return;
    if (!confirm("Are you sure you want to deallocate this vehicle? Data for this spot will be cleared.")) return;
    setIsSubmitting(true);
    try {
      await db.updateSpot(selectedSpot.id, { 
        vin: null, 
        allocatedBy: null, 
        allocatedAt: null, 
        shop: null, 
        waitingParts: false, 
        priority: false, 
        callQuality: false, 
        missingParts: [], 
        observations: null 
      });
      await db.logHistory(selectedSpot.vin, 'DEALLOCATION', user.fullName, `Removed from ${selectedSpot.id}`, mode === 'BOX_REPAIR' ? 'BOX_REPAIR' : 'PARKING');
      setSelectedSpot(null);
      await loadSpots();
    } catch (err) {
      alert("Deallocation failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Layout Management Functions
  const handleAddNewLane = async () => {
    const laneName = prompt("Enter new Lane Name (e.g. 'A', 'B', '10'):");
    if (!laneName) return;
    const spotCount = parseInt(prompt("Initial number of spots in this lane:", "10") || "0");
    if (isNaN(spotCount) || spotCount <= 0) return alert("Invalid count.");
    
    setIsSubmitting(true);
    try {
      await db.addNewLane(mode, laneName.toUpperCase(), spotCount);
      await loadSpots();
    } catch (e) {
      alert("Failed to add lane.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRenameLane = async (oldLane: string) => {
    const newLane = prompt("Rename Lane " + oldLane + " to:", oldLane);
    if (!newLane || newLane === oldLane) return;
    
    setIsSubmitting(true);
    try {
      await db.renameLane(mode, oldLane, newLane.toUpperCase());
      await loadSpots();
    } catch (e) {
      alert("Failed to rename lane.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLane = async (lane: string) => {
    if (!confirm(`Delete Lane ${lane} and all its spots? This cannot be undone.`)) return;
    
    setIsSubmitting(true);
    try {
      await db.deleteLane(mode, lane);
      await loadSpots();
    } catch (e) {
      alert("Failed to delete lane. Make sure it's empty.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSpot = async (lane: string) => {
    setIsSubmitting(true);
    try {
      await db.addSpotToLane(mode, lane);
      await loadSpots();
    } catch (e) {
      alert("Failed to add spot.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveSpot = async (lane: string) => {
    setIsSubmitting(true);
    try {
      await db.removeSpotFromLane(mode, lane);
      await loadSpots();
    } catch (e: any) {
      alert(e.message || "Failed to remove spot.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const addMissingPart = () => {
    if (!newMissingPart.trim()) return;
    setAllocationForm({ ...allocationForm, missingParts: [...allocationForm.missingParts, newMissingPart.trim().toUpperCase()] });
    setNewMissingPart('');
  };

  const removeMissingPart = (index: number) => {
    const updated = [...allocationForm.missingParts];
    updated.splice(index, 1);
    setAllocationForm({ ...allocationForm, missingParts: updated });
  };

  const lanes = useMemo(() => {
    const grouped: Record<string, ParkingSpot[]> = {};
    spots.forEach(spot => {
      if (!grouped[spot.lane]) grouped[spot.lane] = [];
      grouped[spot.lane].push(spot);
    });
    return grouped;
  }, [spots]);

  const sortedLaneKeys = Object.keys(lanes).sort((a,b) => a.localeCompare(b));

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col p-6 overflow-hidden pt-24">
      <div className="flex justify-between items-center mb-10 shrink-0 px-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition shadow-lg"><ArrowLeft /></button>
          <h2 className="text-4xl font-black tracking-tighter uppercase text-white drop-shadow-2xl">
            {mode === 'BOX_REPAIR' ? 'Box Repair' : 'Parking'}
          </h2>
        </div>
        <div className="flex gap-4 items-center">
           {isMoveMode && (
             <div className="bg-blue-600 text-white px-6 py-2.5 rounded-2xl text-sm font-black animate-pulse shadow-xl flex items-center gap-3">
               <Move size={18} /> MOVE MODE ACTIVE: Click any empty spot
               <button onClick={() => setIsMoveMode(false)} className="bg-white/20 hover:bg-white/30 p-1 rounded-lg transition"><X size={16}/></button>
             </div>
           )}
           
           {canManageLayout && (
             <div className="flex gap-2">
               {isManageMode && (
                 <button onClick={handleAddNewLane} className="bg-green-600 hover:bg-green-700 text-white p-2.5 rounded-xl flex items-center gap-2 transition shadow-lg font-bold">
                    <PlusCircle size={20} /> Add New Lane
                 </button>
               )}
               <button onClick={() => setIsManageMode(!isManageMode)} className={`p-2.5 rounded-xl flex items-center gap-2 transition shadow-lg ${isManageMode ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                 <Settings size={20} /> {isManageMode ? 'Exit Layout' : 'Manage Layout'}
               </button>
             </div>
           )}

           <div className="flex bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
             <input type="text" placeholder="Search VIN..." className="bg-transparent px-5 py-2.5 outline-none w-64 text-sm font-medium" value={searchVin} onChange={e => setSearchVin(e.target.value)} />
             <button onClick={handleSearch} className="px-5 bg-blue-600 hover:bg-blue-700 transition"><Search size={20} /></button>
           </div>
        </div>
      </div>

      <div className="flex-1 rounded-[2.5rem] border border-slate-800 p-8 shadow-inner overflow-auto bg-slate-900/50 backdrop-blur-sm">
          <div className="flex flex-col gap-14 min-w-[1400px]">
            {loading ? <div className="text-center py-20 opacity-20 text-3xl font-black uppercase italic">Loading Layout...</div> : (
              sortedLaneKeys.map(lane => (
                <div key={lane} className="flex flex-col gap-5">
                   <div className="flex items-center gap-4">
                      <div className="bg-yellow-500 text-black font-black px-8 py-2 rounded-r-2xl shadow-xl text-lg tracking-widest w-fit flex items-center gap-4">
                        LANE {lane}
                      </div>
                      {isManageMode && (
                        <div className="flex gap-2 items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700">
                           <button onClick={() => handleRenameLane(lane)} className="p-1.5 hover:bg-blue-600 rounded-lg text-slate-300 hover:text-white transition" title="Rename Lane">
                              <Edit3 size={16} />
                           </button>
                           <div className="w-px h-6 bg-slate-700 mx-1" />
                           <button onClick={() => handleAddSpot(lane)} className="p-1.5 hover:bg-green-600 rounded-lg text-slate-300 hover:text-white transition" title="Add Spot to this Lane">
                              <PlusCircle size={16} />
                           </button>
                           <button onClick={() => handleRemoveSpot(lane)} className="p-1.5 hover:bg-orange-600 rounded-lg text-slate-300 hover:text-white transition" title="Remove Last Spot from this Lane">
                              <MinusCircle size={16} />
                           </button>
                           <div className="w-px h-6 bg-slate-700 mx-1" />
                           <button onClick={() => handleDeleteLane(lane)} className="p-1.5 hover:bg-red-600 rounded-lg text-slate-300 hover:text-white transition" title="Delete Entire Lane">
                              <Trash2 size={16} />
                           </button>
                        </div>
                      )}
                   </div>
                   <div className="grid grid-cols-10 gap-4">
                      {lanes[lane].map(spot => {
                        let visualClasses = "bg-slate-900 border-slate-700 hover:border-slate-500 shadow-md";
                        if (spot.callQuality) visualClasses = "animate-blink-green-neon border-green-400 bg-green-900/20";
                        else if (spot.priority) visualClasses = "animate-blink-red-neon shadow-red-500/20";
                        else if (spot.vin) visualClasses = "bg-slate-900 border-red-600 shadow-lg";

                        return (
                          <div key={spot.id} id={`spot-${spot.id}`} onClick={() => handleSpotClick(spot)}
                            className={`relative aspect-[3/4] border-2 flex flex-col p-3 cursor-pointer transition-all duration-300 rounded-2xl ${visualClasses} ${highlightedSpotId === spot.id ? 'ring-4 ring-white shadow-2xl scale-105 z-10' : ''}`}>
                             <div className="text-[10px] font-black text-white/40 mb-1 flex justify-between uppercase tracking-tighter">
                               <span>{spot.number}</span>
                               {spot.missingParts?.length > 0 && <span className="bg-orange-600 text-[8px] px-1.5 py-0.5 rounded-full text-white font-black">MISSING</span>}
                             </div>
                             {spot.vin ? (
                               <div className="flex-1 flex flex-col justify-center items-center gap-1.5">
                                  <div className="text-[12px] font-black bg-black/50 px-2 py-0.5 rounded text-white shadow-sm font-mono tracking-tighter border border-white/5">{spot.vin.slice(-6)}</div>
                                  <div className="text-[8px] font-black text-blue-300 uppercase leading-none text-center bg-blue-900/40 px-2 py-1 rounded-full border border-blue-500/20">{spot.shop}</div>
                               </div>
                             ) : (
                               <div className="flex-1 flex items-center justify-center opacity-10"><MapPin size={24} /></div>
                             )}
                          </div>
                        );
                      })}
                   </div>
                </div>
              ))
            )}
          </div>
      </div>

      {selectedSpot && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-700 p-8 rounded-[3rem] w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-6">
              <div>
                <h3 className="text-3xl font-black tracking-tighter uppercase text-white leading-none">Spot {selectedSpot.id}</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-2">{selectedSpot.area.replace('_', ' ')} Layout Station</p>
              </div>
              <button onClick={() => setSelectedSpot(null)} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white transition shadow-lg"><X size={24} /></button>
            </div>
            
            <div className="space-y-8">
              <div>
                <label className="text-[10px] text-slate-500 font-black mb-2 block uppercase tracking-widest">Vehicle Identification (VIN 17)</label>
                <input disabled={isSubmitting || (selectedSpot.vin && !isManageMode)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 text-xl text-white uppercase font-mono tracking-widest outline-none focus:border-blue-500 transition-all shadow-inner" value={allocationForm.vin} onChange={e => setAllocationForm({...allocationForm, vin: e.target.value.toUpperCase()})} placeholder="ENTER VIN..." maxLength={17} />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] text-slate-500 font-black mb-2 block uppercase tracking-widest">Originating Shop</label>
                  <select disabled={isSubmitting} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 text-white outline-none focus:border-blue-500 transition-all font-bold appearance-none shadow-inner" value={allocationForm.shop} onChange={e => setAllocationForm({...allocationForm, shop: e.target.value})}>
                      {SHOPS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                   {selectedSpot.vin && (
                     <button onClick={() => { setIsMoveMode(true); setSelectedSpot(null); }} className="flex-1 bg-indigo-600 hover:bg-indigo-700 h-[68px] rounded-2xl font-black text-white uppercase tracking-widest flex items-center justify-center gap-3 transition shadow-xl shadow-indigo-500/20 active:scale-95">
                       <Move size={20} /> Move Vehicle
                     </button>
                   )}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-black mb-2 block uppercase tracking-widest">Part Constraints (Missing)</label>
                <div className="flex gap-3 mb-4">
                  <input className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:border-blue-500 transition-all shadow-inner" value={newMissingPart} onChange={e => setNewMissingPart(e.target.value)} placeholder="Part description..." />
                  <button onClick={addMissingPart} className="bg-blue-600 px-6 rounded-2xl hover:bg-blue-700 transition-all shadow-lg active:scale-95"><Plus size={24}/></button>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {allocationForm.missingParts.length === 0 ? (
                    <p className="text-[10px] italic text-slate-600 font-bold uppercase tracking-widest px-2">No missing parts reported</p>
                  ) : (
                    allocationForm.missingParts.map((part, i) => (
                      <span key={i} className="bg-slate-800/80 border border-slate-700 px-4 py-2 rounded-full text-[10px] font-black flex items-center gap-3 text-slate-200 shadow-sm">
                        {part}
                        <button onClick={() => removeMissingPart(i)} className="text-red-500 hover:text-red-400 transition-colors"><Minus size={14} strokeWidth={3} /></button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-black mb-2 block uppercase tracking-widest">Status Observations</label>
                <textarea className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 text-white h-32 outline-none resize-none focus:border-blue-500 transition-all shadow-inner font-medium" value={allocationForm.obs} onChange={e => setAllocationForm({...allocationForm, obs: e.target.value})} placeholder="Maintenance or repair notes..." />
              </div>

              {selectedSpot.vin && (
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={handleCallQuality} disabled={isSubmitting} className={`py-5 rounded-2xl font-black text-xs uppercase tracking-widest flex flex-col items-center justify-center gap-3 border transition-all shadow-lg active:scale-95 ${selectedSpot.callQuality ? 'bg-green-600 border-green-400 text-white' : 'bg-green-600/10 border-green-600 text-green-500 hover:bg-green-600/20'}`}>
                        <Megaphone size={24}/> {selectedSpot.callQuality ? 'Call Active' : 'Quality Call'}
                    </button>
                    {canSetPriority && (
                        <button disabled={isSubmitting} onClick={() => {
                            db.updateSpot(selectedSpot.id, { priority: !selectedSpot.priority }).then(() => { loadSpots(); setSelectedSpot(null); });
                        }} className={`py-5 rounded-2xl font-black text-xs uppercase tracking-widest border transition-all shadow-lg active:scale-95 ${selectedSpot.priority ? 'bg-red-600 border-red-400 text-white' : 'bg-red-600/10 border-red-600 text-red-500 hover:bg-red-600/20'}`}>Priority</button>
                    )}
                </div>
              )}

              <div className="flex gap-4 pt-4 border-t border-slate-800">
                <button onClick={handleAllocate} disabled={isSubmitting} className="flex-1 bg-blue-600 py-5 rounded-[1.5rem] font-black text-lg shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-3 uppercase tracking-widest active:scale-95">
                   {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />} {selectedSpot.vin ? 'Update Data' : 'Finalize Allocation'}
                </button>
                {selectedSpot.vin && (
                  <button onClick={handleDeallocate} disabled={isSubmitting} className="bg-red-600 px-8 py-5 rounded-[1.5rem] font-black hover:bg-red-700 transition-all flex items-center justify-center shadow-xl shadow-red-500/20 active:scale-95" title="Deallocate Vehicle">
                    <Trash2 size={28} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
