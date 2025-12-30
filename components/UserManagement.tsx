import React, { useState, useEffect } from 'react';
import { User, ALL_PERMISSIONS, Role } from '../types';
import { db } from '../services/mockSupabase';
import { ArrowLeft, Check, X, Download, Trash2, KeyRound } from 'lucide-react';

interface Props {
  user: User;
  onBack: () => void;
}

export default function UserManagement({ user, onBack }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    refreshUsers();
  }, []);

  const refreshUsers = async () => {
    const data = await db.getUsers();
    setUsers(data);
  };

  if (user.role !== 'Admin') {
    return <div className="p-10 text-center text-red-500">Access Denied</div>;
  }

  const togglePermission = async (perm: string) => {
    if (!selectedUser) return;
    const current = selectedUser.permissions;
    const updated = current.includes(perm) 
      ? current.filter(p => p !== perm)
      : [...current, perm];
    
    const newUser = { ...selectedUser, permissions: updated };
    await db.updateUser(newUser);
    setSelectedUser(newUser);
    refreshUsers();
  };

  const handleRoleChange = async (role: string) => {
     if(!selectedUser) return;
     if(selectedUser.role === 'Admin' && role !== 'Admin') {
         if(!window.confirm('Downgrade Admin?')) return;
     }
     const newUser = { ...selectedUser, role: role as Role };
     await db.updateUser(newUser);
     setSelectedUser(newUser);
     refreshUsers();
  };

  const handleDeleteUser = async () => {
    if(!selectedUser) return;
    if(selectedUser.id === user.id) {
        alert("Cannot delete yourself.");
        return;
    }
    if(window.confirm(`Are you sure you want to delete ${selectedUser.fullName}?`)) {
        await db.deleteUser(selectedUser.id);
        setSelectedUser(null);
        refreshUsers();
    }
  };

  const handleChangePassword = async () => {
      if(!selectedUser) return;
      const newPass = prompt(`Enter new password for ${selectedUser.fullName}:`);
      if(newPass) {
          await db.changePassword(selectedUser.id, newPass);
          alert("Password changed.");
      }
  };

  const handleExport = () => {
      db.exportData(users.map(u => ({...u, permissions: u.permissions.join(', ')})), 'User_List');
  };

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700">
              <ArrowLeft />
            </button>
            <h2 className="text-2xl font-bold">Permission Management (权限管理)</h2>
        </div>
        <button onClick={handleExport} className="bg-green-600 px-3 py-2 rounded hover:bg-green-700 font-bold flex items-center gap-2">
           <Download size={18} /> Export XLSX
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
         {/* User List */}
         <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[80vh]">
            <div className="p-4 bg-slate-800 font-bold">Users</div>
            <div className="flex-1 overflow-auto p-2">
               {users.map(u => (
                 <div 
                   key={u.id} 
                   onClick={() => setSelectedUser(u)}
                   className={`p-3 mb-2 rounded cursor-pointer border ${selectedUser?.id === u.id ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                 >
                    <div className="font-bold">{u.fullName}</div>
                    <div className="text-xs text-slate-400">{u.role}</div>
                 </div>
               ))}
            </div>
         </div>

         {/* Details & Permissions */}
         <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
            {selectedUser ? (
               <div>
                  <div className="flex justify-between items-start mb-6 border-b border-slate-800 pb-4">
                     <div>
                        <h3 className="text-xl font-bold">{selectedUser.fullName}</h3>
                        <p className="text-slate-400">Username: {selectedUser.username}</p>
                     </div>
                     <div className="flex flex-col gap-2">
                         <select 
                           value={selectedUser.role} 
                           onChange={(e) => handleRoleChange(e.target.value)}
                           className="bg-slate-800 border border-slate-600 rounded p-2"
                         >
                           <option>Visitor</option>
                           <option>Reworker</option>
                           <option>Team Leader</option>
                           <option>Supervisor</option>
                           <option>Manager</option>
                           <option>Admin</option>
                         </select>
                         <div className="flex gap-2">
                             <button onClick={handleChangePassword} className="p-2 bg-yellow-600/20 text-yellow-500 border border-yellow-600 rounded hover:bg-yellow-600/40" title="Change Password">
                                <KeyRound size={16} />
                             </button>
                             <button onClick={handleDeleteUser} className="p-2 bg-red-600/20 text-red-500 border border-red-600 rounded hover:bg-red-600/40" title="Delete User">
                                <Trash2 size={16} />
                             </button>
                         </div>
                     </div>
                  </div>

                  {selectedUser.role !== 'Admin' ? (
                    <div>
                      <h4 className="font-bold mb-4 text-slate-300">Access Permissions</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {ALL_PERMISSIONS.map(perm => {
                           const has = selectedUser.permissions.includes(perm);
                           return (
                             <button
                               key={perm}
                               onClick={() => togglePermission(perm)}
                               className={`
                                 flex items-center justify-between p-3 rounded border text-sm transition-all
                                 ${has ? 'bg-green-600/20 border-green-500 text-green-100' : 'bg-slate-800 border-slate-700 text-slate-500 opacity-60'}
                               `}
                             >
                               {perm}
                               {has ? <Check size={16} /> : <X size={16} />}
                             </button>
                           );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-yellow-600/20 text-yellow-500 border border-yellow-600 rounded">
                       This user is an Admin and has full system access.
                    </div>
                  )}
               </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">
                Select a user to manage permissions
              </div>
            )}
         </div>
      </div>
    </div>
  );
}