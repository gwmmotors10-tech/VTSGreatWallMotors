import React from 'react';
import { User, ALL_PERMISSIONS } from '../types';
import { 
  Car, 
  ParkingSquare, 
  Zap, 
  Wrench, 
  History, 
  Package, 
  BarChart3, 
  ShieldCheck,
  Lock,
  MonitorPlay
} from 'lucide-react';

interface DashboardProps {
  user: User;
  onNavigate: (view: string) => void;
}

const MENU_ITEMS = [
  { id: 'BOX_REPAIR', title: 'GWM Box Repair', sub: '(GWM 盒子维修)', icon: Wrench, perm: 'Box repair', color: 'bg-blue-600' },
  { id: 'PARKING', title: 'GWM Parking', sub: '(GWM 停车处)', icon: ParkingSquare, perm: 'Parking', color: 'bg-indigo-600' },
  { id: 'FAST_REPAIR', title: 'Fast Repair', sub: '(快速维修)', icon: Zap, perm: 'FAST REPAIR', color: 'bg-yellow-600' },
  { id: 'REWORKERS', title: 'Reworkers', sub: '(返工人员)', icon: Car, perm: 'REWORKERS', color: 'bg-emerald-600' },
  { id: 'HISTORY', title: 'History', sub: '(历史记录)', icon: History, perm: 'HISTORY', color: 'bg-slate-600' },
  { id: 'SUPPLY_PARTS', title: 'Supply Parts', sub: '(零件供应)', icon: Package, perm: 'SUPPLY PARTS', color: 'bg-cyan-600' },
  { id: 'KPI', title: 'KPI', sub: '(关键绩效指标)', icon: BarChart3, perm: 'KPI', color: 'bg-purple-600' },
  { id: 'ANDON', title: 'Andon', sub: '(安灯系统)', icon: MonitorPlay, perm: 'ANDON', color: 'bg-orange-600' },
  { id: 'USER_MANAGEMENT', title: 'Permission Management', sub: '(权限管理)', icon: ShieldCheck, perm: 'USER PERMISSION MANAGEMENT', color: 'bg-rose-600' },
];

export default function Dashboard({ user, onNavigate }: DashboardProps) {
  
  const hasPermission = (perm: string) => {
    if (user.role === 'Admin') return true; // Admin has all by default for check
    if (user.permissions.includes('ALL')) return true;
    return user.permissions.includes(perm);
  };

  return (
    <div className="max-w-7xl mx-auto pt-10">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Main Menu (主菜单)</h2>
        <p className="text-slate-400">Select a module to proceed (请选择一个模块继续)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {MENU_ITEMS.map((item) => {
          const allowed = hasPermission(item.perm);
          const Icon = item.icon;

          if (!allowed && item.id !== 'USER_MANAGEMENT') return null; // Hide if no permission, unless user mgmt (show locked)
          if (!allowed && item.id === 'USER_MANAGEMENT' && user.role !== 'Admin') return null;

          return (
            <button
              key={item.id}
              onClick={() => allowed && onNavigate(item.id)}
              className={`
                relative group flex flex-col items-center justify-center p-8 rounded-2xl 
                transition-all duration-300 border border-slate-700/50 shadow-2xl backdrop-blur-sm
                ${allowed ? 'hover:scale-105 hover:shadow-blue-500/20 cursor-pointer bg-slate-800/80' : 'opacity-50 cursor-not-allowed bg-slate-900'}
              `}
            >
              <div className={`p-4 rounded-full mb-4 ${allowed ? item.color : 'bg-slate-700'} text-white shadow-lg`}>
                {allowed ? <Icon size={32} /> : <Lock size={32} />}
              </div>
              <h3 className="text-xl font-bold text-white text-center">{item.title}</h3>
              <span className="text-sm text-slate-400 mt-1">{item.sub}</span>
              
              {/* Request Approval Notification Badge for Admins */}
              {item.id === 'USER_MANAGEMENT' && user.role === 'Admin' && (
                <div className="absolute top-4 right-4 flex items-center gap-1 bg-red-500/90 text-white text-xs px-2 py-1 rounded-full">
                  <span>3 Pending</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}