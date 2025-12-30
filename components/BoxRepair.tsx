
import React, { useState, useEffect, useMemo } from 'react';
import { User, ParkingSpot, SHOPS } from '../types';
import { db } from '../services/mockSupabase';
import { Search, ArrowLeft, Download, Plus, Minus, Edit3, Flag, MapPin, Trash2, Megaphone, Settings, Clock } from 'lucide-react';

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
  const [allocationForm, setAllocationForm] = useState({ vin: '', shop: SHOPS[0], obs: '', waitingParts: false });
  const [isManageMode, setIsManageMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      document.getElementById(`spot-${found.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleSpotClick = (spot: ParkingSpot) => {
    if (user.role === 'Visitor' || isSubmitting) return;
    setAllocationForm({ vin: '', shop: spot.shop || SHOPS[0], obs: '', waitingParts: spot.waitingParts });
    setSelectedSpot(spot);
  };

  const handleCallQuality = async () => {
    if(!selectedSpot || !canCallQuality || isSubmitting) return;
    setIsSubmitting(true);
    const newState = !selectedSpot.callQuality;
    await db.updateSpot(selectedSpot.id, { callQuality: newState });
    if(newState) await db.logHistory(selectedSpot.vin || 'N/A', 'QUALITY_CALL', user.fullName, `Quality called for spot ${selectedSpot.id}`, mode === 'BOX_REPAIR' ? 'BOX_REPAIR' : 'PARKING');
    setIsSubmitting(false);
    setSelectedSpot(null);
    loadSpots();
  };

  const handleAllocate = async () => {
    if (!selectedSpot || isSubmitting) return;
    if (allocationForm.vin.trim().length !== 17) {
      alert("VIN must be exactly 17 characters.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      await db.updateSpot(selectedSpot.id, { 
        vin: allocationForm.vin.trim().toUpperCase(), 
        allocatedBy: user.fullName, 
        allocatedAt: new Date().toISOString(), 
        shop: allocationForm.shop, 
        waitingParts: allocationForm.waitingParts, 
        callQuality: false 
      });
      await db.logHistory(allocationForm.vin, 'ALLOCATION', user.fullName, `Allocated to ${selectedSpot.id}`, mode === 'BOX_REPAIR' ? 'BOX_REPAIR' : 'PARKING');
      setSelectedSpot(null);
      await loadSpots();
    } catch (err) {
      alert("Error during allocation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeallocate = async () => {
    if (!selectedSpot || !selectedSpot.vin || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await db.updateSpot(selectedSpot.id, { vin: null, allocatedBy: null, allocatedAt: null, shop: null, waitingParts: false, priority: false, priorityComment: undefined, callQuality: false });
      await db.logHistory(selectedSpot.vin, 'DEALLOCATION', user.fullName, `Removed from ${selectedSpot.id}`, mode === 'BOX_REPAIR' ? 'BOX_REPAIR' : 'PARKING');
      setSelectedSpot(null);
      await loadSpots();
    } catch (err) {
      alert("Error during deallocation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddLane = async () => {
    const name = prompt("Enter Lane Name:");
    if(!name) return;
    const count = parseInt(prompt("Initial spots count:", "10") || "0");
    await db.addNewLane(mode, name.toUpperCase(), count);
    loadSpots();
  };

  const handleRenameLane = async (oldName: string) => {
    const newName = prompt("New name for lane:", oldName);
    if(newName && newName !== oldName) {
        await db.renameLane(mode, oldName, newName.toUpperCase());
        loadSpots();
    }
  };

  const handleDeleteLane = async (lane: string) => {
    if(confirm(`Delete Lane ${lane}?`)) {
        await db.deleteLane(mode, lane);
        loadSpots();
    }
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
    <div className="flex flex-col min-h-screen pb-10">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700"><ArrowLeft /></button>
          <h2 className="text-2xl font-bold">{mode === 'BOX_REPAIR' ? 'GWM Box Repair' : 'GWM Parking'}</h2>
        </div>
        <div className="flex gap-4 items-center">
           {canManageLayout && (
              <button onClick={() => setIsManageMode(!isManageMode)} className={`p-2 rounded flex items-center gap-2 ${isManageMode ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                <Settings size={18} /> {isManageMode ? 'Exit Layout Mode' : 'Manage Layout'}
              </button>
           )}
           <div className="flex bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
             <input type="text" placeholder="VIN..." className="bg-transparent px-4 py-2 outline-none w-32 text-sm" value={searchVin} onChange={e => setSearchVin(e.target.value)} />
             <button onClick={handleSearch} className="px-4 bg-blue-600 hover:bg-blue-700"><Search size={18} /></button>
           </div>
        </div>
      </div>

      {isManageMode && (
          <div className="bg-blue-900/20 border border-blue-500/50 p-4 rounded-xl mb-6 flex gap-4">
              <button onClick={handleAddLane} className="bg-blue-600 px-4 py-2 rounded font-bold flex items-center gap-2"><Plus size={16}/> Add Lane</button>
          </div>
      )}

      <div className="bg-slate-950 rounded-xl border border-slate-800 p-6 shadow-inner overflow-x-auto">
          <div className="flex flex-col gap-12 min-w-[1200px]">
            {sortedLaneKeys.length === 0 && !loading && <div className="text-center text-slate-500 py-20">No lanes created. Use Manage Layout to add one.</div>}
            {sortedLaneKeys.map(lane => (
              <div key={lane} className="flex flex-col gap-4">
                 <div className="flex items-center gap-4">
                    <div className="bg-yellow-500 text-black font-black px-6 py-1.5 rounded-r-xl shadow-lg">LANE {lane}</div>
                    {isManageMode && (
                        <div className="flex gap-2">
                           <button onClick={() => handleRenameLane(lane)} className="p-1.5 bg-slate-800 rounded hover:text-blue-400" title="Rename"><Edit3 size={14}/></button>
                           <button onClick={() => db.addSpotToLane(mode, lane).then(loadSpots)} className="p-1.5 bg-slate-800 rounded hover:text-green-400" title="Add Spot"><Plus size={14}/></button>
                           <button onClick={() => db.removeSpotFromLane(mode, lane).then(loadSpots)} className="p-1.5 bg-slate-800 rounded hover:text-red-400" title="Remove Spot"><Minus size={14}/></button>
                           <button onClick={() => handleDeleteLane(lane)} className="p-1.5 bg-slate-800 rounded hover:text-red-600" title="Delete Lane"><Trash2 size={14}/></button>
                        </div>
                    )}
                 </div>
                 <div className="grid grid-cols-10 gap-3">
                    {lanes[lane].map(spot => {
                      // Determina as classes visuais da vaga
                      let visualClasses = "bg-slate-900 border-slate-700 hover:border-slate-500";
                      
                      if (spot.callQuality) {
                        visualClasses = "animate-blink-green-neon border-green-400 bg-green-900/20";
                      } else if (spot.priority) {
                        visualClasses = "animate-blink-red-neon shadow-lg shadow-red-500/20";
                      } else if (spot.vin) {
                        visualClasses = "bg-slate-900 border-red-600 shadow-md";
                      }

                      return (
                        <div
                          key={spot.id}
                          id={`spot-${spot.id}`}
                          onClick={() => handleSpotClick(spot)}
                          className={`
                            relative aspect-[3/4] border-2 flex flex-col p-2 cursor-pointer transition-all duration-300 rounded-xl
                            ${visualClasses}
                            ${highlightedSpotId === spot.id ? 'ring-4 ring-white shadow-2xl scale-105 z-10' : ''}
                          `}
                        >
                           <div className="text-[10px] font-bold text-white/50 mb-1">{spot.number}</div>
                           
                           {spot.vin ? (
                             <div className="flex-1 flex flex-col justify-center items-center gap-1.5">
                                <div className="text-[11px] font-black bg-black/40 px-1 rounded text-white shadow-sm font-mono tracking-tighter">
                                  {spot.vin.slice(-6)}
                                </div>
                                <div className="text-[8px] font-black text-blue-300 uppercase leading-none text-center bg-blue-900/30 px-1 py-0.5 rounded border border-blue-500/20">
                                  {spot.shop}
                                </div>
                                <div className="text-[7px] text-white/40 leading-none text-center flex items-center gap-0.5">
                                  <Clock size={6} /> {new Date(spot.allocatedAt!).toLocaleString([], {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}
                                </div>
                             </div>
                           ) : (
                             <div className="flex-1 flex items-center justify-center opacity-10">
                                <MapPin size={16} />
                             </div>
                           )}
                           
                           <div className="text-[7px] text-center opacity-20 mt-1 uppercase tracking-tighter truncate">{spot.id}</div>
                        </div>
                      );
                    })}
                 </div>
              </div>
            ))}
          </div>
      </div>

      {selectedSpot && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-8 rounded-3xl w-96 shadow-2xl">
            <h3 className="text-2xl font-black mb-6 border-b border-slate-800 pb-4 tracking-tighter uppercase">Spot {selectedSpot.id}</h3>
            {selectedSpot.vin ? (
              <div className="space-y-4">
                <div className="bg-slate-950 p-4 rounded-xl text-sm border border-slate-800">
                  <p className="flex justify-between py-1"><span className="text-slate-500 uppercase font-bold text-[10px]">VIN Number:</span> <span className="font-mono text-blue-400">{selectedSpot.vin}</span></p>
                  <p className="flex justify-between py-1"><span className="text-slate-500 uppercase font-bold text-[10px]">Responsible Shop:</span> {selectedSpot.shop}</p>
                  <p className="flex justify-between py-1"><span className="text-slate-500 uppercase font-bold text-[10px]">Allocated At:</span> <span className="text-xs text-slate-300">{new Date(selectedSpot.allocatedAt!).toLocaleString()}</span></p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={handleCallQuality} 
                        disabled={isSubmitting}
                        className={`py-4 rounded-xl font-black text-xs flex flex-col items-center justify-center gap-2 border transition shadow-lg ${selectedSpot.callQuality ? 'bg-green-600 border-green-400 animate-pulse' : 'bg-green-600/10 border-green-600 text-green-500 hover:bg-green-600/20'} disabled:opacity-50`}
                    >
                        <Megaphone size={20}/> {selectedSpot.callQuality ? 'Active Call' : 'Quality Call'}
                    </button>
                    {canSetPriority && (
                        <button 
                            disabled={isSubmitting}
                            onClick={() => {
                                setIsSubmitting(true);
                                db.updateSpot(selectedSpot!.id, { priority: !selectedSpot!.priority }).then(() => {
                                    setIsSubmitting(false);
                                    loadSpots();
                                    setSelectedSpot(null);
                                });
                            }} 
                            className={`py-4 rounded-xl font-black text-xs border transition shadow-lg ${selectedSpot.priority ? 'bg-red-600 border-red-400 text-white' : 'bg-red-600/10 border-red-600 text-red-500 hover:bg-red-600/20'} disabled:opacity-50`}
                        >Priority</button>
                    )}
                </div>
                <button 
                    onClick={handleDeallocate} 
                    disabled={isSubmitting}
                    className="w-full bg-red-600 py-4 rounded-xl font-black text-lg hover:bg-red-700 transition shadow-lg shadow-red-500/20 uppercase tracking-widest disabled:opacity-50"
                >
                    {isSubmitting ? 'Processing...' : 'Deallocate'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                    <label className="text-[10px] text-slate-500 font-bold mb-1 block uppercase tracking-widest">VIN NUMBER (17 Digits)</label>
                    <input 
                      autoFocus
                      disabled={isSubmitting}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white uppercase font-mono tracking-widest focus:border-blue-500 transition-all outline-none disabled:opacity-50" 
                      value={allocationForm.vin} 
                      onChange={e => setAllocationForm({...allocationForm, vin: e.target.value.toUpperCase()})} 
                      placeholder="ENTER VIN..." 
                      maxLength={17} 
                    />
                </div>
                <div>
                    <label className="text-[10px] text-slate-500 font-bold mb-1 block uppercase tracking-widest">RESPONSIBLE SHOP</label>
                    <select 
                      disabled={isSubmitting}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white appearance-none cursor-pointer focus:border-blue-500 outline-none disabled:opacity-50" 
                      value={allocationForm.shop} 
                      onChange={e => setAllocationForm({...allocationForm, shop: e.target.value})}
                    >
                        {SHOPS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <button 
                    onClick={handleAllocate} 
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 py-4 rounded-xl font-black text-lg mt-4 shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all uppercase tracking-widest disabled:opacity-50"
                >
                    {isSubmitting ? 'Processing...' : 'Allocate'}
                </button>
              </div>
            )}
            <button 
                onClick={() => !isSubmitting && setSelectedSpot(null)} 
                className="mt-6 w-full text-slate-500 font-bold hover:text-white transition-colors py-2 uppercase text-xs tracking-widest disabled:opacity-50"
            >CLOSE</button>
          </div>
        </div>
      )}
    </div>
  );
}
