
import React, { useState, useEffect } from 'react';
import { User, ALL_PERMISSIONS, Role } from '../types';
import { db } from '../services/supabaseService';
import { ArrowLeft, Check, X, Download, Trash2, KeyRound } from 'lucide-react';

interface Props {
  user: User;
  onBack: () => void;
}

export default function UserManagement({ user, onBack }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => { refreshUsers(); }, []);

  const refreshUsers = async () => { setUsers(await db.getUsers()); };

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
            <button onClick={onBack} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition"><ArrowLeft /></button>
            <h2 className="text-2xl font-bold uppercase tracking-tight">User Management</h2>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-6">
         <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden h-[80vh] overflow-auto">
            <div className="p-4 bg-slate-800 font-bold uppercase tracking-widest text-xs">Users List</div>
            <div className="p-2">
               {users.map(u => (
                 <div key={u.id} onClick={() => setSelectedUser(u)} className={`p-3 mb-2 rounded cursor-pointer border transition ${selectedUser?.id === u.id ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}>
                    <div className="font-bold">{u.fullName}</div>
                    <div className="text-xs text-slate-400">{u.role}</div>
                 </div>
               ))}
            </div>
         </div>
         <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
            {selectedUser ? (
               <div>
                  <div className="flex justify-between items-start mb-6 border-b border-slate-800 pb-4">
                     <div>
                        <h3 className="text-xl font-bold">{selectedUser.fullName}</h3>
                        <p className="text-slate-400 text-sm">Username: {selectedUser.username}</p>
                     </div>
                     <select value={selectedUser.role} onChange={(e) => handleRoleChange(e.target.value)} className="bg-slate-800 border border-slate-600 rounded p-2 text-sm outline-none">
                       {['Visitor', 'Reworker', 'Team Leader', 'Supervisor', 'Manager', 'Admin'].map(r => <option key={r} value={r}>{r}</option>)}
                     </select>
                  </div>
                  {selectedUser.role !== 'Admin' ? (
                    <div className="grid grid-cols-2 gap-3">
                        {ALL_PERMISSIONS.map(perm => {
                           const has = selectedUser.permissions.includes(perm);
                           return (
                             <button key={perm} onClick={() => togglePermission(perm)} className={`flex items-center justify-between p-3 rounded border text-xs transition-all ${has ? 'bg-green-600/20 border-green-500 text-green-100' : 'bg-slate-800 border-slate-700 text-slate-500 opacity-60'}`}>
                               {perm}
                               {has ? <Check size={14} /> : <X size={14} />}
                             </button>
                           );
                        })}
                    </div>
                  ) : <div className="p-4 bg-yellow-600/20 text-yellow-500 border border-yellow-600 rounded text-center">Admin has full access.</div>}
               </div>
            ) : <div className="h-full flex items-center justify-center text-slate-500">Select a user to manage.</div>}
         </div>
      </div>
    </div>
  );
}
