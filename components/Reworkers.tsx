
import React, { useState, useEffect, useRef } from 'react';
import { User, ReworkSession, SHOPS, ReworkMaterial } from '../types';
import { db } from '../services/supabaseService';
import { ArrowLeft, Play, Pause, CheckSquare, Clock, Plus, Trash, Loader2, AlertCircle } from 'lucide-react';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Refs para controle de fluxo e evitar race conditions
  const isFinalizingRef = useRef(false);
  const lastFinishedIdRef = useRef<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      // Bloqueia atualização se estivermos no meio de um salvamento
      if (isFinalizingRef.current) return;

      try {
        const sess = await db.getReworks();
        
        // Filtra sessões ativas ignorando a que acabamos de fechar localmente
        const allActive = sess.filter(s => 
          (s.status === 'IN_PROGRESS' || s.status === 'PAUSED') &&
          s.id !== lastFinishedIdRef.current
        );

        // Busca a minha sessão específica
        const myActive = allActive.find(s => s.user === user.fullName);
        
        if (myActive) { 
          setActiveSession(myActive); 
          setSessionForm(prev => ({ 
            ...prev,
            vin: myActive.vin, 
            shop: myActive.shop, 
            defectsCount: myActive.defectsCount, 
            obs: myActive.observations 
          })); 
          setMaterials(myActive.materials); 
        } else {
          // Se o banco não retornou nada ativo para este usuário, limpa a tela
          setActiveSession(null);
        }
        
        setActiveSessionsList(allActive);
      } catch (error) {
        console.error("Fetch error:", error);
      }
    };

    fetchData();
    
    // Poller de dados (Sincroniza com o banco a cada 5 segundos)
    const poller = setInterval(fetchData, 5000);
    
    // Timer de UI (Atualiza o relógio na tela a cada 1 segundo)
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => { 
      clearInterval(poller); 
      clearInterval(timer);
    };
  }, [user.fullName]);

  const formatElapsed = (start: string) => {
    const diff = Math.max(0, currentTime - new Date(start).getTime());
    const s = Math.floor(diff / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const startRepair = async () => {
    // Bloqueio: Somente 1 retrabalho por operador
    if (activeSession || activeSessionsList.some(s => s.user === user.fullName)) {
      alert('You already have an active rework session. Please finish it before starting a new one.');
      return;
    }

    const vinRegex = /^[A-Z0-9]{17}$/;
    if (!vinRegex.test(sessionForm.vin)) return alert('Enter valid 17-character alphanumeric VIN');
    
    setIsSubmitting(true);
    try {
      const sess: ReworkSession = { 
        id: '', 
        vin: sessionForm.vin, 
        user: user.fullName, 
        startTime: new Date().toISOString(), 
        status: 'IN_PROGRESS', 
        defectsCount: sessionForm.defectsCount, 
        shop: sessionForm.shop, 
        observations: sessionForm.obs, 
        materials 
      };
      
      const createdSess = await db.addRework(sess);
      if (createdSess) {
        lastFinishedIdRef.current = null; // Reseta a trava ao iniciar nova
        await db.updateUserStatus(user.username, 'ONLINE');
        setActiveSession(createdSess);
      }
    } catch (e) {
      alert("Error starting repair.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const finishRepair = async () => {
    if (!activeSession) return;
    if (!confirm('Finalize and save this rework session?')) return;

    const sessionIdToClose = activeSession.id;
    isFinalizingRef.current = true; // Ativa trava anti-poller
    setIsSubmitting(true);

    try {
      // 1. Atualiza no Banco de Dados
      await db.updateRework(sessionIdToClose, { 
        status: 'COMPLETED', 
        endTime: new Date().toISOString(),
        observations: sessionForm.obs,
        defectsCount: sessionForm.defectsCount
      });
      
      // 2. Atualiza status do usuário (Offline)
      await db.updateUserStatus(user.username, 'OFFLINE');
      
      // 3. Registra no histórico
      await db.logHistory(activeSession.vin, 'REWORK_FINISH', user.fullName, `Finished repair at ${sessionForm.shop}`, 'REWORKERS');
      
      // 4. Marca como finalizada na trava de segurança local
      lastFinishedIdRef.current = sessionIdToClose;

      // 5. Limpa os estados locais IMEDIATAMENTE para liberar a tela
      setActiveSession(null);
      setMaterials([]);
      setSessionForm({ vin: '', shop: SHOPS[0], defectsCount: 0, obs: '' });
      
      alert('Repair session finalized and saved.');
    } catch (e) {
      console.error(e);
      alert('Failed to finish session. Check connection.');
    } finally {
      setIsSubmitting(false);
      // Mantém a trava anti-poller por 5 segundos para dar tempo do banco de dados refletir a mudança
      setTimeout(() => {
        isFinalizingRef.current = false;
      }, 5000);
    }
  };

  return (
    <div className="flex flex-col min-h-screen pb-10">
       <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
             <button onClick={onBack} className="p-2 bg-slate-800 rounded-full transition hover:bg-slate-700 shadow-lg"><ArrowLeft /></button>
             <h2 className="text-2xl font-bold uppercase tracking-tight text-white">Rework Station</h2>
          </div>
          {activeSession && (
              <div className={`px-6 py-2 rounded-2xl border flex items-center gap-4 shadow-xl transition-all ${activeSession.status === 'IN_PROGRESS' ? 'bg-blue-600/20 border-blue-500/50 animate-pulse' : 'bg-yellow-600/10 border-yellow-500/30'}`}>
                  <Clock size={20} className={activeSession.status === 'IN_PROGRESS' ? "text-blue-500" : "text-yellow-500"} />
                  <span className="text-2xl font-mono font-black">{formatElapsed(activeSession.startTime)}</span>
                  {activeSession.status === 'PAUSED' && <span className="text-[10px] font-black uppercase text-yellow-500">PAUSED</span>}
              </div>
          )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-6">
          {!activeSession && isFinalizingRef.current ? (
            <div className="bg-blue-600/10 border border-blue-500/50 p-10 rounded-3xl flex flex-col items-center gap-4 text-center">
              <Loader2 size={48} className="text-blue-500 animate-spin" />
              <p className="font-black text-blue-500 uppercase tracking-widest">Sincronizando Banco de Dados...</p>
              <p className="text-xs text-slate-400 italic">A tela estará disponível em instantes.</p>
            </div>
          ) : (
            <div className="space-y-4">
               <div>
                 <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 block">Vehicle VIN (17 chars)</label>
                 <input disabled={!!activeSession || isSubmitting} className="w-full bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xl font-mono outline-none uppercase focus:border-blue-500 transition-all shadow-inner" placeholder="ENTER VIN..." value={sessionForm.vin} onChange={e => setSessionForm({...sessionForm, vin: e.target.value.toUpperCase()})} maxLength={17} />
               </div>
               
               <div>
                 <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 block">Responsible Shop</label>
                 <select disabled={!!activeSession || isSubmitting} className="w-full bg-slate-950 p-4 rounded-2xl border border-slate-800 focus:border-blue-500 outline-none transition-all shadow-inner" value={sessionForm.shop} onChange={e => setSessionForm({...sessionForm, shop: e.target.value})}>
                    {SHOPS.map(s => <option key={s}>{s}</option>)}
                 </select>
               </div>

               <div>
                 <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 block">Materials Inventory Log</label>
                 <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 space-y-4 shadow-inner">
                    <div className="flex gap-2">
                        <input disabled={isSubmitting} className="flex-1 bg-slate-950 p-3 rounded-xl border border-slate-800 text-sm outline-none focus:border-blue-500" placeholder="Material Name..." value={newMaterial.name} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} />
                        <input disabled={isSubmitting} type="number" className="w-20 bg-slate-950 p-3 rounded-xl border border-slate-800 text-center text-sm outline-none focus:border-blue-500" value={newMaterial.qty} onChange={e => setNewMaterial({...newMaterial, qty: parseInt(e.target.value) || 1})} min={1} />
                        <button disabled={isSubmitting} onClick={() => { if(newMaterial.name) setMaterials([...materials, {...newMaterial}]); setNewMaterial({name:'', qty:1}); }} className="bg-blue-600 px-4 rounded-xl hover:bg-blue-700 transition shadow-lg active:scale-95"><Plus size={18}/></button>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                      {materials.length === 0 ? (
                        <p className="text-[10px] text-slate-600 uppercase font-black text-center py-4 italic">No materials logged</p>
                      ) : materials.map((m, i) => (
                          <div key={i} className="flex justify-between items-center bg-slate-950/80 p-3 rounded-xl border border-slate-800 group transition-all hover:border-slate-700">
                              <span className="font-bold text-slate-200">{m.name} <span className="text-blue-500 ml-2 font-mono">x{m.qty}</span></span>
                              {!activeSession && <button onClick={() => setMaterials(materials.filter((_,idx)=>idx!==i))} className="text-red-500 hover:bg-red-500/10 p-1 rounded-lg transition-colors"><Trash size={16}/></button>}
                          </div>
                      ))}
                    </div>
                 </div>
               </div>

               <div>
                 <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 block">Defects Count</label>
                 <input type="number" className="w-full bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xl font-mono outline-none focus:border-blue-500 transition-all shadow-inner" value={sessionForm.defectsCount} onChange={e => setSessionForm({...sessionForm, defectsCount: parseInt(e.target.value) || 0})} />
               </div>

               <div>
                 <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 block">Repair Observations</label>
                 <textarea disabled={isSubmitting} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white h-24 outline-none resize-none focus:border-blue-500 transition-all shadow-inner font-medium" value={sessionForm.obs} onChange={e => setSessionForm({...sessionForm, obs: e.target.value})} placeholder="Session notes and findings..." />
               </div>
            </div>
          )}
          
          <div className="pt-4">
            {!activeSession ? (
              <button 
                onClick={startRepair} 
                disabled={isSubmitting || !sessionForm.vin || isFinalizingRef.current} 
                className="w-full bg-green-600 hover:bg-green-700 py-5 rounded-[1.5rem] font-black uppercase text-sm tracking-widest shadow-xl shadow-green-500/20 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : <Play fill="currentColor" size={20} />} 
                Start Rework Session
              </button>
            ) : (
              <button 
                onClick={finishRepair} 
                disabled={isSubmitting} 
                className="w-full bg-blue-600 hover:bg-blue-700 py-5 rounded-[1.5rem] font-black uppercase text-sm tracking-widest shadow-xl shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : <CheckSquare size={24} />} 
                Finalize & Save Session
              </button>
            )}
          </div>
        </div>

        <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 p-8 shadow-2xl flex flex-col h-[700px]">
            <h3 className="text-xl font-black mb-6 flex items-center gap-3 border-b border-slate-800 pb-4 shrink-0 uppercase tracking-tight">
              <Clock className="text-blue-500" /> Active Operator
            </h3>
            <div className="space-y-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                {activeSessionsList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full opacity-10 grayscale">
                    <Clock size={64} />
                    <p className="font-black uppercase mt-4">No active personnel</p>
                  </div>
                ) : activeSessionsList.map(sess => (
                    <div key={sess.id} className="bg-slate-950/80 p-5 rounded-3xl border border-slate-800 flex justify-between items-center shadow-lg transition-all hover:border-slate-700">
                        <div className="space-y-1">
                            <div className="font-black text-slate-200 uppercase tracking-tight">{sess.user}</div>
                            <div className="text-[10px] bg-blue-600/10 text-blue-400 font-mono px-2 py-0.5 rounded border border-blue-500/20 w-fit">{sess.vin}</div>
                            <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{sess.shop}</div>
                        </div>
                        <div className="text-right">
                           <div className="text-green-500 font-mono font-bold text-lg leading-none">
                             {formatElapsed(sess.startTime)}
                           </div>
                           <div className="text-[8px] text-slate-600 font-bold uppercase mt-1">Elapsed Time</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
}
