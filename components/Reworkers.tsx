
import React, { useState, useEffect } from 'react';
import { User, ReworkSession, SHOPS, ReworkMaterial } from '../types';
import { db } from '../services/supabaseService';
import { ArrowLeft, Play, Pause, CheckSquare, Clock, Plus, Trash } from 'lucide-react';

interface Props {
  user: User;
  onBack: () => void;
}

export default function Reworkers({ user, onBack }: Props) {
  const [activeSession, setActiveSession] = useState<ReworkSession | null>(null);
  const [sessionForm, setSessionForm] = useState({ vin: '', shop: SHOPS[0], defectsCount: 0, obs: '' });
  const [materials, setMaterials] = useState<ReworkMaterial[]>([]);
  const [newMaterial, setNewMaterial] = useState({ name: '', qty: 1 });
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [activeSessionsList, setActiveSessionsList] = useState<ReworkSession[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const sess = await db.getReworks();
      const myActive = sess.find(s => s.user === user.fullName && (s.status === 'IN_PROGRESS' || s.status === 'PAUSED'));
      if (myActive) { 
        setActiveSession(myActive); 
        setSessionForm({ vin: myActive.vin, shop: myActive.shop, defectsCount: myActive.defectsCount, obs: myActive.observations }); 
        setMaterials(myActive.materials); 
      }
      setActiveSessionsList(sess.filter(s => s.status === 'IN_PROGRESS' || s.status === 'PAUSED'));
    };
    fetch();
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    const poller = setInterval(fetch, 5000);
    return () => { clearInterval(interval); clearInterval(poller); };
  }, [user.fullName]);

  const formatElapsed = (start: string) => {
    const diff = Math.max(0, currentTime - new Date(start).getTime());
    const s = Math.floor(diff / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const startRepair = async () => {
    const vinRegex = /^[A-Z0-9]{17}$/;
    if (!vinRegex.test(sessionForm.vin)) return alert('Enter valid 17-character alphanumeric VIN');
    const sess: ReworkSession = { id: `sess-${Date.now()}`, vin: sessionForm.vin, user: user.fullName, startTime: new Date().toISOString(), status: 'IN_PROGRESS', defectsCount: sessionForm.defectsCount, shop: sessionForm.shop, observations: sessionForm.obs, materials };
    await db.addRework(sess);
    await db.updateUserStatus(user.username, 'ONLINE');
    setActiveSession(sess);
  };

  const finishRepair = async () => {
    if (!activeSession) return;
    try {
      await db.updateRework(activeSession.id, { 
        status: 'COMPLETED', 
        endTime: new Date().toISOString(),
        observations: sessionForm.obs,
        defectsCount: sessionForm.defectsCount
      });
      await db.updateUserStatus(user.username, 'OFFLINE');
      await db.logHistory(activeSession.vin, 'REWORK_FINISH', user.fullName, `Finished repair with ${materials.length} materials`, 'REWORKERS');
      
      setActiveSession(null);
      setMaterials([]);
      setSessionForm({ vin: '', shop: SHOPS[0], defectsCount: 0, obs: '' });
      alert('Repair session finalized and saved.');
    } catch (e) {
      alert('Failed to finish session.');
    }
  };

  return (
    <div className="flex flex-col min-h-screen pb-10">
       <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
             <button onClick={onBack} className="p-2 bg-slate-800 rounded-full transition hover:bg-slate-700"><ArrowLeft /></button>
             <h2 className="text-2xl font-bold uppercase">Rework Station</h2>
          </div>
          {activeSession && (
              <div className="px-6 py-2 rounded-2xl border bg-blue-600/20 border-blue-500/50 flex items-center gap-4">
                  <Clock size={20} className="text-blue-500" />
                  <span className="text-2xl font-mono font-black">{formatElapsed(activeSession.startTime)}</span>
              </div>
          )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-6">
          <div className="space-y-4">
             <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">VIN Number (17 chars)</label>
             <input disabled={!!activeSession} className="w-full bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xl font-mono outline-none uppercase" placeholder="ENTER VIN..." value={sessionForm.vin} onChange={e => setSessionForm({...sessionForm, vin: e.target.value.toUpperCase()})} maxLength={17} />
             
             <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Shop</label>
             <select disabled={!!activeSession} className="w-full bg-slate-950 p-4 rounded-2xl border border-slate-800" value={sessionForm.shop} onChange={e => setSessionForm({...sessionForm, shop: e.target.value})}>
                {SHOPS.map(s => <option key={s}>{s}</option>)}
             </select>

             <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Materials Log</label>
             <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 space-y-4">
                <div className="flex gap-2">
                    <input className="flex-1 bg-slate-950 p-3 rounded-xl border border-slate-800" placeholder="Material Name..." value={newMaterial.name} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} />
                    <input type="number" className="w-20 bg-slate-950 p-3 rounded-xl border border-slate-800 text-center" value={newMaterial.qty} onChange={e => setNewMaterial({...newMaterial, qty: parseInt(e.target.value) || 1})} min={1} />
                    <button onClick={() => { if(newMaterial.name) setMaterials([...materials, {...newMaterial}]); setNewMaterial({name:'', qty:1}); }} className="bg-blue-600 px-4 rounded-xl hover:bg-blue-700 transition"><Plus size={18}/></button>
                </div>
                {materials.map((m, i) => (
                    <div key={i} className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <span className="font-bold">{m.name} <span className="text-blue-500">x{m.qty}</span></span>
                        <button onClick={() => setMaterials(materials.filter((_,idx)=>idx!==i))} className="text-red-500"><Trash size={14}/></button>
                    </div>
                ))}
             </div>

             <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Observations</label>
             <textarea className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white h-24 outline-none resize-none" value={sessionForm.obs} onChange={e => setSessionForm({...sessionForm, obs: e.target.value})} placeholder="Session notes..." />
          </div>
          {!activeSession ? (
            <button onClick={startRepair} className="w-full bg-green-600 hover:bg-green-700 py-4 rounded-2xl font-black uppercase shadow-lg transition flex items-center justify-center gap-2"><Play /> Start Session</button>
          ) : (
            <button onClick={finishRepair} className="w-full bg-blue-600 hover:bg-blue-700 py-4 rounded-2xl font-black uppercase shadow-lg transition flex items-center justify-center gap-2"><CheckSquare /> Finish & Save</button>
          )}
        </div>
        <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 p-8 shadow-2xl overflow-auto">
            <h3 className="text-xl font-black mb-6 flex items-center gap-3"><Clock className="text-blue-500" /> Active Reworkers</h3>
            <div className="space-y-4">
                {activeSessionsList.map(sess => (
                    <div key={sess.id} className="bg-slate-950 p-5 rounded-3xl border border-slate-800 flex justify-between items-center">
                        <div>
                            <div className="font-black">{sess.user}</div>
                            <div className="text-xs text-blue-400 font-mono">{sess.vin.slice(-8)}</div>
                        </div>
                        <div className="text-green-500 font-mono text-sm">{formatElapsed(sess.startTime)}</div>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
}
