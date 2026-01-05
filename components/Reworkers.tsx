import React, { useState, useEffect } from 'react';
import { User, ReworkSession, SHOPS, ReworkMaterial } from '../types';
import { db } from '../services/mockSupabase';
import { ArrowLeft, Play, Pause, CheckSquare, Clock, Download, Circle, X, Plus, Trash } from 'lucide-react';

interface Props {
  user: User;
  onBack: () => void;
}

export default function Reworkers({ user, onBack }: Props) {
  const [activeSession, setActiveSession] = useState<ReworkSession | null>(null);
  const [sessionForm, setSessionForm] = useState<Partial<ReworkSession>>({
    vin: '',
    shop: SHOPS[0],
    defectsCount: 0,
    observations: ''
  });
  const [materials, setMaterials] = useState<ReworkMaterial[]>([]);
  const [newMaterial, setNewMaterial] = useState({ name: '', qty: 1 });

  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // Estados para gerenciar o tempo pausado
  const [totalPausedTime, setTotalPausedTime] = useState(0);
  const [pauseStartTime, setPauseStartTime] = useState<number | null>(null);
  
  const [allReworkers, setAllReworkers] = useState<User[]>([]);
  const [activeSessionsList, setActiveSessionsList] = useState<ReworkSession[]>([]);
  const canViewRealTime = user.role === 'Admin' || user.permissions.includes('VIEW_REALTIME_STATUS');

  useEffect(() => {
    const checkActiveSession = async () => {
      try {
        const sess = await db.getReworks();
        const myActive = sess.find(s => 
          s.user === user.fullName && 
          (s.status === 'IN_PROGRESS' || s.status === 'PAUSED') &&
          !s.endTime // Garantir que não é uma sessão já finalizada
        );
        
        if (myActive) {
          setActiveSession(myActive);
          setIsRunning(myActive.status === 'IN_PROGRESS');
          setIsPaused(myActive.status === 'PAUSED');
          setSessionForm({
            vin: myActive.vin,
            shop: myActive.shop,
            defectsCount: myActive.defectsCount,
            observations: myActive.observations || ''
          });
          setMaterials(myActive.materials || []);
          
          // Se a sessão estava pausada, inicializar o tempo de pausa
          if (myActive.status === 'PAUSED') {
            setTotalPausedTime(myActive.totalPausedTime || 0);
            setPauseStartTime(Date.now());
          }
        } else {
          // Limpar estado se não houver sessão ativa
          setActiveSession(null);
          setIsRunning(false);
          setIsPaused(false);
          setTotalPausedTime(0);
          setPauseStartTime(null);
        }
      } catch (error) {
        console.error('Error checking active session:', error);
      }
    };
    
    checkActiveSession();
    
    const interval = setInterval(() => {
      if (!isPaused) setCurrentTime(Date.now());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isPaused, user.fullName]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [users, sess] = await Promise.all([db.getUsers(), db.getReworks()]);
        setAllReworkers(users.filter(u => u.role === 'Reworker'));
        
        // Filtrar apenas sessões ativas (sem endTime)
        const activeSessions = sess.filter(s => 
          (s.status === 'IN_PROGRESS' || s.status === 'PAUSED') && 
          !s.endTime
        );
        setActiveSessionsList(activeSessions);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    if (canViewRealTime) {
      fetchData();
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [canViewRealTime]);

  const formatElapsedTime = (startTime: string) => {
    if (!startTime) return "00:00:00";
    
    let diff = currentTime - new Date(startTime).getTime();
    
    // Subtrair o tempo total em pausa
    if (totalPausedTime > 0) {
      diff -= totalPausedTime;
    }
    
    // Se estiver pausado no momento, subtrair o tempo desde que pausou
    if (pauseStartTime) {
      diff -= (Date.now() - pauseStartTime);
    }
    
    if (diff < 0) return "00:00:00";
    const totalSecs = Math.floor(diff / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const addMaterial = () => {
    if (!newMaterial.name.trim()) return;
    
    const existingMaterial = materials.find(m => 
      m.name.toLowerCase() === newMaterial.name.toLowerCase()
    );
    
    if (existingMaterial) {
      // Atualizar quantidade se material já existe
      setMaterials(materials.map(m =>
        m.name.toLowerCase() === newMaterial.name.toLowerCase()
          ? { ...m, qty: m.qty + newMaterial.qty }
          : m
      ));
    } else {
      // Adicionar novo material
      setMaterials([...materials, { 
        name: newMaterial.name.trim(), 
        qty: newMaterial.qty 
      }]);
    }
    
    setNewMaterial({ name: '', qty: 1 });
  };

  const removeMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
  };

  const startRepair = async () => {
    // Validação do VIN
    if (!sessionForm.vin || sessionForm.vin.length !== 17) {
      alert('Enter valid VIN (17 characters)');
      return;
    }
    
    const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/i;
    if (!vinRegex.test(sessionForm.vin)) {
      alert('Invalid VIN format. Only letters and numbers allowed, excluding I, O, Q.');
      return;
    }
    
    try {
      // Verificar se já existe uma sessão ativa para este VIN
      const existingSessions = await db.getReworks();
      const existingActiveSession = existingSessions.find(s => 
        s.vin === sessionForm.vin && 
        (s.status === 'IN_PROGRESS' || s.status === 'PAUSED') &&
        !s.endTime
      );
      
      if (existingActiveSession) {
        alert(`This VIN is already being reworked by ${existingActiveSession.user}`);
        return;
      }
      
      const newSess: ReworkSession = {
        id: `sess-${Date.now()}`,
        vin: sessionForm.vin.toUpperCase(),
        user: user.fullName,
        startTime: new Date().toISOString(),
        status: 'IN_PROGRESS',
        defectsCount: sessionForm.defectsCount || 0,
        shop: sessionForm.shop || SHOPS[0],
        observations: sessionForm.observations || '',
        materials: materials,
        totalPausedTime: 0
      };

      await db.addRework(newSess);
      await db.updateUserStatus(user.username, 'ONLINE');
      
      setActiveSession(newSess);
      setIsRunning(true);
      setIsPaused(false);
      setTotalPausedTime(0);
      setPauseStartTime(null);
      
      // Atualizar a lista de sessões ativas
      if (canViewRealTime) {
        const updatedSessions = await db.getReworks();
        setActiveSessionsList(updatedSessions.filter(s => 
          (s.status === 'IN_PROGRESS' || s.status === 'PAUSED') && !s.endTime
        ));
      }
    } catch (error) {
      console.error('Error starting repair:', error);
      alert('Error starting repair session. Please try again.');
    }
  };

  const togglePause = async () => {
    if (!activeSession) return;
    
    try {
      if (isPaused) {
        // Retomando da pausa
        const newPausedTime = pauseStartTime 
          ? totalPausedTime + (Date.now() - pauseStartTime)
          : totalPausedTime;
          
        await db.updateRework(activeSession.id, { 
          status: 'IN_PROGRESS',
          totalPausedTime: newPausedTime
        });
        
        setTotalPausedTime(newPausedTime);
        setPauseStartTime(null);
        setIsPaused(false);
        setIsRunning(true);
        await db.updateUserStatus(user.username, 'ONLINE');
      } else {
        // Pausando
        setPauseStartTime(Date.now());
        await db.updateRework(activeSession.id, { status: 'PAUSED' });
        setIsPaused(true);
        setIsRunning(false);
        await db.updateUserStatus(user.username, 'ONLINE_PAUSED');
      }
      
      // Atualizar sessão local
      setActiveSession(prev => prev ? { ...prev, status: isPaused ? 'IN_PROGRESS' : 'PAUSED' } : null);
    } catch (error) {
      console.error('Error toggling pause:', error);
      alert('Error updating session status. Please try again.');
    }
  };

  const finishRepair = async () => {
    if (!activeSession) return;
    
    if (!window.confirm('Are you sure you want to finish this repair?')) {
      return;
    }
    
    const completed = window.confirm('Was the repair successfully completed?');
    let reason = '';
    if (!completed) {
      reason = prompt('Please enter the reason for not completing the repair:') || 'Unknown';
      if (!reason.trim()) {
        alert('Reason is required when repair is not completed.');
        return;
      }
    }
    
    try {
      // Calcular tempo total pausado final
      let finalPausedTime = totalPausedTime;
      if (pauseStartTime) {
        finalPausedTime += (Date.now() - pauseStartTime);
      }
      
      // CORREÇÃO CRÍTICA: Atualizar a sessão existente usando updateRework
      // NÃO criar uma nova sessão com addRework
      const updateData = {
        endTime: new Date().toISOString(),
        status: 'COMPLETED' as const,
        defectsCount: sessionForm.defectsCount || 0,
        shop: sessionForm.shop || SHOPS[0],
        observations: sessionForm.observations || '',
        materials: materials,
        notFinishedReason: reason || null,
        totalPausedTime: finalPausedTime
      };
      
      await db.updateRework(activeSession.id, updateData);
      await db.updateUserStatus(user.username, 'OFFLINE');
      
      alert('Repair session completed and saved successfully!');
      
      // Resetar todos os estados
      setActiveSession(null);
      setIsRunning(false);
      setIsPaused(false);
      setTotalPausedTime(0);
      setPauseStartTime(null);
      setSessionForm({ 
        vin: '', 
        shop: SHOPS[0],
        defectsCount: 0, 
        observations: '' 
      });
      setMaterials([]);
      setNewMaterial({ name: '', qty: 1 });
      
      // Atualizar a lista de sessões ativas
      if (canViewRealTime) {
        const updatedSessions = await db.getReworks();
        setActiveSessionsList(updatedSessions.filter(s => 
          (s.status === 'IN_PROGRESS' || s.status === 'PAUSED') && !s.endTime
        ));
      }
    } catch (error) {
      console.error('Error finishing repair:', error);
      alert('Error saving repair session. Please try again.');
    }
  };

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700">
            <ArrowLeft />
          </button>
          <h2 className="text-2xl font-bold uppercase tracking-tighter">Rework Station</h2>
        </div>
        {(isRunning || isPaused) && activeSession && (
          <div className={`px-6 py-2 rounded-2xl border flex items-center gap-4 shadow-lg ${isPaused ? 'bg-yellow-600/20 border-yellow-500/50' : 'bg-blue-600/20 border-blue-500/50 animate-pulse'}`}>
            <Clock className={isPaused ? 'text-yellow-500' : 'text-blue-500'} />
            <span className="text-2xl font-mono font-black text-white">{formatElapsedTime(activeSession.startTime)}</span>
            {isPaused && <span className="text-[10px] font-black uppercase text-yellow-500 ml-2">PAUSED</span>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Painel Esquerdo - Controle da Sessão */}
        <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-slate-500 font-bold mb-1 block uppercase tracking-widest">VIN Number</label>
              <input 
                className="w-full bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xl font-mono tracking-widest outline-none focus:border-blue-500 disabled:opacity-50" 
                placeholder="ENTER VIN (17 characters)..." 
                value={sessionForm.vin} 
                onChange={e => setSessionForm({...sessionForm, vin: e.target.value.toUpperCase()})}
                maxLength={17}
                disabled={isRunning || isPaused}
              />
            </div>
            
            <div>
              <label className="text-[10px] text-slate-500 font-bold mb-1 block uppercase tracking-widest">Shop</label>
              <select 
                className="w-full bg-slate-950 p-4 rounded-2xl border border-slate-800 outline-none focus:border-blue-500 disabled:opacity-50" 
                value={sessionForm.shop} 
                onChange={e => setSessionForm({...sessionForm, shop: e.target.value})}
                disabled={isRunning || isPaused}
              >
                {SHOPS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-slate-500 font-bold mb-1 block uppercase tracking-widest">Defects Count</label>
                <input 
                  className="w-full bg-slate-950 p-4 rounded-2xl border border-slate-800 outline-none" 
                  type="number" 
                  value={sessionForm.defectsCount} 
                  onChange={e => setSessionForm({...sessionForm, defectsCount: parseInt(e.target.value) || 0})} 
                  min="0"
                />
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col justify-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Active Materials</span>
                <span className="text-xl font-black text-white">{materials.length} Items</span>
              </div>
            </div>
            
            <textarea 
              className="w-full bg-slate-950 p-4 rounded-2xl border border-slate-800 h-24 outline-none" 
              placeholder="Observations..." 
              value={sessionForm.observations} 
              onChange={e => setSessionForm({...sessionForm, observations: e.target.value})} 
            />
            
            {/* Seção de Materiais */}
            <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 space-y-4">
              <h4 className="font-black text-xs uppercase tracking-widest text-slate-400">Material Inventory Log</h4>
              <div className="flex gap-2">
                <input 
                  className="flex-1 bg-slate-950 p-3 rounded-xl border border-slate-800 text-sm" 
                  placeholder="Part Name..." 
                  value={newMaterial.name} 
                  onChange={e => setNewMaterial({...newMaterial, name: e.target.value})}
                  onKeyPress={e => e.key === 'Enter' && addMaterial()}
                />
                <input 
                  type="number" 
                  className="w-20 bg-slate-950 p-3 rounded-xl border border-slate-800 text-sm text-center" 
                  value={newMaterial.qty} 
                  onChange={e => setNewMaterial({...newMaterial, qty: parseInt(e.target.value) || 1})} 
                  min="1" 
                />
                <button onClick={addMaterial} className="bg-blue-600 px-4 rounded-xl hover:bg-blue-700 disabled:opacity-50" disabled={!newMaterial.name.trim()}>
                  <Plus size={18}/>
                </button>
              </div>
              
              <div className="space-y-2 max-h-32 overflow-auto pr-2 custom-scrollbar">
                {materials.length === 0 ? (
                  <div className="text-center text-slate-500 text-sm py-4">
                    No materials added yet
                  </div>
                ) : (
                  materials.map((m, i) => (
                    <div key={i} className="flex justify-between items-center text-xs bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <span className="font-bold text-slate-300">{m.name} <span className="text-slate-500">(x{m.qty})</span></span>
                      <button onClick={() => removeMaterial(i)} className="text-red-500 hover:bg-red-500/10 p-1 rounded-lg">
                        <Trash size={14}/>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Botões de Controle */}
          <div className="flex gap-4 pt-4">
            {!isRunning && !isPaused ? (
              <button 
                onClick={startRepair} 
                className="flex-1 bg-green-600 hover:bg-green-700 py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 disabled:opacity-50"
                disabled={!sessionForm.vin || sessionForm.vin.length !== 17}
              >
                <Play /> Start Session
              </button>
            ) : (
              <div className="flex-1 flex gap-3">
                <button 
                  onClick={togglePause} 
                  className={`flex-1 ${isPaused ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-600 hover:bg-yellow-700'} py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg`}
                >
                  {isPaused ? <Play /> : <Pause />} {isPaused ? 'Resume' : 'Pause'}
                </button>
                <button 
                  onClick={finishRepair} 
                  className="flex-1 bg-blue-600 hover:bg-blue-700 py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  <CheckSquare /> Finish & Save
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Painel Direito - Visão Geral dos Reworkers */}
        <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 p-8 flex flex-col h-full min-h-[500px] shadow-2xl">
          <h3 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tighter mb-6">
            <Clock className="text-blue-500" /> Active Reworkers Overview
          </h3>
          
          <div className="space-y-4 flex-1 overflow-auto custom-scrollbar pr-2">
            {allReworkers.length === 0 ? (
              <div className="text-center text-slate-500 py-8">
                No reworkers available
              </div>
            ) : (
              allReworkers.map(rw => {
                const activeSess = activeSessionsList.find(s => s.user === rw.fullName);
                const isOnline = rw.reworkerStatus === 'ONLINE' || rw.reworkerStatus === 'ONLINE_PAUSED';
                
                return (
                  <div key={rw.id} className="bg-slate-950 p-5 rounded-3xl border border-slate-800 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white ${isOnline ? 'bg-green-600 shadow-lg shadow-green-500/20' : 'bg-slate-800'}`}>
                          {rw.fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-black text-white text-lg">{rw.fullName}</div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                            {rw.reworkerStatus || 'OFFLINE'}
                            {rw.reworkerStatus === 'ONLINE_PAUSED' && ' (PAUSED)'}
                          </div>
                        </div>
                      </div>
                      {isOnline && <Circle size={12} fill="#22c55e" className="text-green-500 animate-pulse" />}
                    </div>
                    
                    {isOnline && activeSess && (
                      <div className={`p-4 rounded-2xl border flex justify-between items-center ${activeSess.status === 'PAUSED' ? 'bg-yellow-900/20 border-yellow-500/30' : 'bg-slate-900/50 border-slate-800/50'}`}>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-500 font-black uppercase">Active VIN</span>
                          <span className="text-xs font-mono font-black text-blue-400">
                            {activeSess.vin ? activeSess.vin.slice(-8) : 'N/A'}
                          </span>
                        </div>
                        <div className="flex flex-col items-end text-right">
                          <span className="text-[9px] text-slate-500 font-black uppercase">
                            Duration {activeSess.status === 'PAUSED' && '(PAUSED)'}
                          </span>
                          <span className={`text-sm font-mono font-black ${activeSess.status === 'PAUSED' ? 'text-yellow-500' : 'text-green-500'}`}>
                            {activeSess.startTime ? formatElapsedTime(activeSess.startTime) : '00:00:00'}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {isOnline && !activeSess && (
                      <div className="p-4 rounded-2xl border border-slate-800/50 bg-slate-900/50 text-center text-slate-500 text-sm">
                        No active session
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
