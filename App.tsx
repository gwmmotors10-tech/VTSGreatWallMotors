
import React, { useState, useEffect, useRef } from 'react';
import { User, ChatMessage } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import BoxRepair from './components/BoxRepair';
import Parking from './components/Parking';
import FastRepair from './components/FastRepair';
import Reworkers from './components/Reworkers';
import SupplyParts from './components/SupplyParts';
import KPI from './components/KPI';
import History from './components/History';
import Andon from './components/Andon';
import UserManagement from './components/UserManagement';
import { db } from './services/supabaseService';
import { LogOut, Bell, User as UserIcon, MessageSquare, X, Send, Camera, Save } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('DASHBOARD');
  
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatRecipient, setChatRecipient] = useState<string>(''); 
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [usersList, setUsersList] = useState<User[]>([]);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ fullName: '', photoUrl: '' });
  const [notifications] = useState<string[]>([]);

  useEffect(() => {
    if (isChatOpen) {
      const fetchUsers = async () => {
         const users = await db.getUsers();
         setUsersList(users);
      };
      fetchUsers();
      refreshMessages();
      const interval = setInterval(refreshMessages, 2000);
      return () => clearInterval(interval);
    }
  }, [isChatOpen, chatRecipient]);

  const refreshMessages = async () => {
      const allMsgs = await db.getMessages();
      const visible = allMsgs.filter(m => 
          !m.recipientId || 
          m.recipientId === currentUser?.id || 
          m.userId === currentUser?.id
      );
      setChatMessages(visible);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setProfileForm({ fullName: user.fullName, photoUrl: user.photoUrl || '' });
    setCurrentView('DASHBOARD');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView('LOGIN');
    setIsChatOpen(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;
    await db.sendMessage(currentUser, newMessage, chatRecipient || undefined);
    setNewMessage('');
    refreshMessages();
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, fullName: profileForm.fullName, photoUrl: profileForm.photoUrl };
    await db.updateUser(updatedUser);
    setCurrentUser(updatedUser);
    setIsProfileOpen(false);
    alert('Profile Updated');
  };

  const renderView = () => {
    switch (currentView) {
      case 'DASHBOARD':
        return <Dashboard user={currentUser!} onNavigate={setCurrentView} />;
      case 'BOX_REPAIR':
        return <BoxRepair user={currentUser!} onBack={() => setCurrentView('DASHBOARD')} />;
      case 'PARKING':
        return <Parking user={currentUser!} onBack={() => setCurrentView('DASHBOARD')} />;
      case 'FAST_REPAIR':
        return <FastRepair user={currentUser!} onBack={() => setCurrentView('DASHBOARD')} />;
      case 'REWORKERS':
        return <Reworkers user={currentUser!} onBack={() => setCurrentView('DASHBOARD')} />;
      case 'SUPPLY_PARTS':
        return <SupplyParts user={currentUser!} onBack={() => setCurrentView('DASHBOARD')} />;
      case 'KPI':
        return <KPI user={currentUser!} onBack={() => setCurrentView('DASHBOARD')} />;
      case 'ANDON':
        return <Andon user={currentUser!} onBack={() => setCurrentView('DASHBOARD')} />;
      case 'HISTORY':
        return <History user={currentUser!} onBack={() => setCurrentView('DASHBOARD')} />;
      case 'USER_MANAGEMENT':
        return <UserManagement user={currentUser!} onBack={() => setCurrentView('DASHBOARD')} />;
      default:
        return <Dashboard user={currentUser!} onNavigate={setCurrentView} />;
    }
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="h-16 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-6 sticky top-0 z-50 shadow-lg">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-100 leading-tight">
              GWM Vehicle Traceability System
            </h1>
            <span className="text-xs text-slate-400 block">(GWM 车辆追溯系统)</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative group cursor-pointer">
            <Bell size={20} className="text-slate-400 group-hover:text-blue-400 transition" />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
            )}
          </div>
          
          <div className="flex items-center gap-3 pl-6 border-l border-slate-700">
            <div className="text-right hidden md:block cursor-pointer" onClick={() => setIsProfileOpen(true)}>
              <p className="text-sm font-medium text-slate-200 hover:text-blue-400 transition">{currentUser.fullName}</p>
              <p className="text-xs text-slate-400">{currentUser.role}</p>
            </div>
            <div 
              onClick={() => setIsProfileOpen(true)}
              className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden border border-slate-600 flex items-center justify-center cursor-pointer hover:border-blue-500 transition"
            >
              {currentUser.photoUrl ? (
                <img src={currentUser.photoUrl} alt="User" className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={20} className="text-slate-400" />
              )}
            </div>
            <button 
              onClick={handleLogout}
              className="ml-2 p-2 hover:bg-red-500/20 rounded-full text-slate-400 hover:text-red-500 transition"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto relative">
         <div className="relative z-10 p-6 min-h-full">
            {renderView()}
         </div>
      </main>

      <div className={`fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none`}>
        {isChatOpen && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-80 h-96 mb-4 flex flex-col pointer-events-auto overflow-hidden">
             <div className="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2"><MessageSquare size={16} /> Team Chat</h3>
                <button onClick={() => setIsChatOpen(false)} className="hover:text-red-400"><X size={16} /></button>
             </div>
             <div className="p-2 bg-slate-800 border-b border-slate-700">
                 <select 
                    className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-xs"
                    value={chatRecipient}
                    onChange={e => setChatRecipient(e.target.value)}
                 >
                     <option value="">Everyone (Public)</option>
                     {usersList.filter(u => u.id !== currentUser.id).map(u => (
                         <option key={u.id} value={u.id}>{u.fullName}</option>
                     ))}
                 </select>
             </div>
             <div className="flex-1 overflow-auto p-3 space-y-3 bg-slate-900">
                {chatMessages.map(msg => (
                  <div key={msg.id} className={`flex flex-col ${msg.userId === currentUser.id ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[80%] rounded-lg p-2 text-sm ${msg.userId === currentUser.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200'} ${msg.recipientId ? 'border border-yellow-500/50' : ''}`}>
                       <div className="flex justify-between items-center mb-1 gap-2">
                           {msg.userId !== currentUser.id && <span className="text-[10px] font-bold text-slate-300">{msg.userName}</span>}
                           {msg.recipientId && <span className="text-[9px] text-yellow-400 italic">(Private)</span>}
                       </div>
                       {msg.text}
                    </div>
                    <span className="text-[10px] text-slate-600 mt-1">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                ))}
                <div ref={chatEndRef}></div>
             </div>
             <form onSubmit={handleSendMessage} className="p-2 border-t border-slate-800 flex gap-2 bg-slate-800">
                <input 
                  className="flex-1 bg-slate-900 rounded px-2 py-1 text-sm outline-none border border-slate-700" 
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                />
                <button type="submit" className="bg-blue-600 p-1.5 rounded text-white hover:bg-blue-700">
                   <Send size={16} />
                </button>
             </form>
          </div>
        )}
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg pointer-events-auto transition-transform hover:scale-110"
        >
          <MessageSquare size={24} />
        </button>
      </div>

      {isProfileOpen && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center">
           <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-96 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-bold">Edit Profile</h3>
                 <button onClick={() => setIsProfileOpen(false)} className="hover:text-red-400"><X /></button>
              </div>
              <div className="space-y-4">
                 <div className="flex flex-col items-center mb-4">
                    <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-slate-700 overflow-hidden mb-2 relative group">
                        {profileForm.photoUrl ? (
                          <img src={profileForm.photoUrl} className="w-full h-full object-cover" />
                        ) : (
                          <UserIcon className="w-full h-full p-4 text-slate-600" />
                        )}
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                           <Camera size={24} />
                        </div>
                    </div>
                 </div>
                 <div>
                    <label className="block text-xs text-slate-400 mb-1">Full Name</label>
                    <input className="w-full bg-slate-800 p-2 rounded border border-slate-600" value={profileForm.fullName} onChange={e => setProfileForm({...profileForm, fullName: e.target.value})} />
                 </div>
                 <div>
                    <label className="block text-xs text-slate-400 mb-1">Photo URL</label>
                    <input className="w-full bg-slate-800 p-2 rounded border border-slate-600" value={profileForm.photoUrl} onChange={e => setProfileForm({...profileForm, photoUrl: e.target.value})} />
                 </div>
                 <button onClick={handleSaveProfile} className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded font-bold flex items-center justify-center gap-2">
                    <Save size={18} /> Save Changes
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
