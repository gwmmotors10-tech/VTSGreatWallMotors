
import React, { useState, useEffect, useRef } from 'react';
import { User, ALL_PERMISSIONS, Role } from '../types';
import { db } from '../services/supabaseService';
import { ArrowLeft, Check, X, ChevronDown, MousePointer2 } from 'lucide-react';

interface Props {
  user: User;
  onBack: () => void;
}

export default function UserManagement({ user, onBack }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Referências para controle de scroll
  const userListRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  useEffect(() => { refreshUsers(); }, []);

  const refreshUsers = async () => { setUsers(await db.getUsers()); };

  const scrollToBottom = () => {
    if (userListRef.current) {
      userListRef.current.scrollTo({
        top: userListRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
    if (detailsRef.current) {
      detailsRef.current.scrollTo({
        top: detailsRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  if (user.role !== 'Admin') return <div className="p-10 text-center text-red-500">Access Denied</div>;

  const togglePermission = async (perm: string) => {
    if (!selectedUser) return;
    const current = selectedUser.permissions;
    const updated = current.includes(perm) ? current.filter(p => p !== perm) : [...current, perm];
    const newUser = { ...selectedUser, permissions: updated };
    await db.updateUser(newUser);
    setSelectedUser(newUser);
    refreshUsers();
  };

  const handleRoleChange = async (role: string) => {
     if(!selectedUser) return;
     const newUser = { ...selectedUser, role: role as Role };
     await db.updateUser(newUser);
     setSelectedUser(newUser);
     refreshUsers();
  };

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition shadow-lg border border-slate-700"><ArrowLeft /></button>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white">User Management</h2>
        </div>
        
        <button 
          onClick={scrollToBottom}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg active:scale-95 border border-blue-500"
        >
          <ChevronDown size={18} /> Scroll to Bottom
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Lista de Usuários */}
         <div 
           ref={userListRef}
           className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden h-[75vh] overflow-y-auto custom-scrollbar shadow-2xl"
         >
            <div className="p-5 bg-slate-800/50 border-b border-slate-800 font-black uppercase tracking-widest text-[10px] text-slate-400 flex items-center gap-2">
              <MousePointer2 size={14} /> Registered Personnel
            </div>
            <div className="p-4 space-y-2">
               {users.map(u => (
                 <div 
                   key={u.id} 
                   onClick={() => setSelectedUser(u)} 
                   className={`p-4 rounded-2xl cursor-pointer border transition-all duration-300 ${
                     selectedUser?.id === u.id 
                       ? 'bg-blue-600/20 border-blue-500 shadow-lg scale-[1.02]' 
                       : 'bg-slate-950/50 border-slate-800 hover:border-slate-600'
                   }`}
                 >
                    <div className="font-black text-white">{u.fullName}</div>
                    <div className={`text-[10px] font-black uppercase tracking-widest mt-1 ${selectedUser?.id === u.id ? 'text-blue-400' : 'text-slate-500'}`}>
                      {u.role}
                    </div>
                 </div>
               ))}
            </div>
         </div>

         {/* Detalhes e Permissões */}
         <div 
           ref={detailsRef}
           className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-[2rem] p-8 h-[75vh] overflow-y-auto custom-scrollbar shadow-2xl"
         >
            {selectedUser ? (
               <div className="space-y-8">
                  <div className="flex justify-between items-start border-b border-slate-800 pb-8">
                     <div>
                        <h3 className="text-3xl font-black text-white tracking-tighter uppercase">{selectedUser.fullName}</h3>
                        <p className="text-slate-500 font-mono text-sm mt-1">UID: {selectedUser.username}</p>
                     </div>
                     <div className="flex flex-col items-end gap-2">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">System Role</label>
                       <select 
                         value={selectedUser.role} 
                         onChange={(e) => handleRoleChange(e.target.value)} 
                         className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-blue-500 transition-all font-bold text-white shadow-inner"
                       >
                         {['Visitor', 'Reworker', 'Team Leader', 'Supervisor', 'Manager', 'Admin'].map(r => <option key={r} value={r}>{r}</option>)}
                       </select>
                     </div>
                  </div>

                  {selectedUser.role !== 'Admin' ? (
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="h-px bg-slate-800 flex-1"></div>
                          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Access Matrix</h4>
                          <div className="h-px bg-slate-800 flex-1"></div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {ALL_PERMISSIONS.map(perm => {
                               const has = selectedUser.permissions.includes(perm);
                               return (
                                 <button 
                                   key={perm} 
                                   onClick={() => togglePermission(perm)} 
                                   className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 group ${
                                     has 
                                       ? 'bg-green-600/10 border-green-500/50 text-green-100 shadow-lg shadow-green-500/5' 
                                       : 'bg-slate-950 border-slate-800 text-slate-500 opacity-60 hover:opacity-100 hover:border-slate-700'
                                   }`}
                                 >
                                   <span className="text-[10px] font-black uppercase tracking-wider">{perm}</span>
                                   <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                                     has ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-600 group-hover:bg-slate-700'
                                   }`}>
                                     {has ? <Check size={14} strokeWidth={3} /> : <X size={14} />}
                                   </div>
                                 </button>
                               );
                            })}
                        </div>
                    </div>
                  ) : (
                    <div className="p-10 bg-blue-600/10 text-blue-400 border border-blue-500/30 rounded-[2rem] text-center flex flex-col items-center gap-4">
                       <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-xl">
                         <Check size={32} strokeWidth={3} />
                       </div>
                       <div>
                         <h4 className="text-xl font-black uppercase">Administrator Privilege</h4>
                         <p className="text-sm font-medium text-slate-500 mt-1 max-w-xs mx-auto">This user has full administrative access and bypasses the standard permission matrix.</p>
                       </div>
                    </div>
                  )}
                  
                  {/* Div auxiliar para garantir que o scroll chegue ao final */}
                  <div className="h-4"></div>
               </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4 opacity-20">
                <MousePointer2 size={64} />
                <p className="text-2xl font-black uppercase italic tracking-widest">Select Personnel to configure</p>
              </div>
            )}
         </div>
      </div>
    </div>
  );
}
