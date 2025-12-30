
export type Role = 
  | 'Reworker' 
  | 'Visitor' 
  | 'Team Leader' 
  | 'Group Leader' 
  | 'Analyst' 
  | 'Supervisor' 
  | 'Manager' 
  | 'Director' 
  | 'Admin';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  photoUrl?: string;
  password?: string;
  permissions: string[];
  reworkerStatus?: 'ONLINE' | 'PAUSED' | 'OFFLINE';
}

export interface Vehicle {
  vin: string;
  model: string;
  color: string;
  origin: string;
  destination: string;
  status: 'AOFF' | 'OFFLINE' | 'FAST REPAIR';
  missingParts?: string;
  observations?: string;
  createdAt: string;
  finishedAt?: string; // Novo campo para parar o tempo no KPI
  createdBy?: string;
  history: HistoryLog[];
}

export interface ParkingSpot {
  id: string;
  lane: string;
  number: number;
  area: 'BOX_REPAIR' | 'PARKING';
  vin: string | null;
  allocatedAt: string | null;
  allocatedBy: string | null;
  shop: string | null;
  waitingParts: boolean;
  priority: boolean;
  priorityComment?: string;
  reallocationReason?: string;
  callQuality?: boolean;
}

export interface RequestPart {
  id: string;
  vin: string | null;
  line?: string;
  partNumber: string;
  partName: string;
  quantity: number;
  reason: string;
  requester: string;
  requestedAt: string;
  approvedAt?: string;
  processedBy?: string;
  lotNumber?: string;
  status: 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED' | 'UNAVAILABLE' | 'MISSING_PART';
  type: 'LINE' | 'REPAIR';
  color: string;
}

export type HistoryCategory = 'BOX_REPAIR' | 'PARKING' | 'FAST_REPAIR' | 'REWORKERS' | 'SUPPLY_PARTS' | 'KPI' | 'USER_MANAGEMENT' | 'SYSTEM' | 'HISTORY';

export interface HistoryLog {
  id: string;
  date: string;
  vin: string;
  action: string;
  user: string;
  details: string;
  category: HistoryCategory;
}

export interface ReworkMaterial {
  name: string;
  qty: number;
}

export interface ReworkSession {
  id: string;
  vin: string;
  user: string;
  startTime: string;
  endTime?: string;
  status: 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED';
  defectsCount: number;
  shop: string;
  observations: string;
  materials: ReworkMaterial[];
  notFinishedReason?: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  recipientId?: string;
  text: string;
  timestamp: string;
}

export interface ProductionBatch {
  id: string;
  name: string;
  line: 'B-Line' | 'P-Line';
  totalQty: number;
  models: string[];
  colors: Record<string, number>;
  createdAt: string;
  completedAt?: string;
  status: 'ACTIVE' | 'UPCOMING' | 'COMPLETED';
}

export interface LineMessage {
  line: 'B-Line' | 'P-Line';
  message: string;
  expiresAt?: string | null;
}

export const SHOPS = ['Body Shop', 'Paint Shop', 'General Assembly', 'Quality Technology', 'R&D'];
export const INITIAL_CAR_MODELS = ['B01 HEV', 'B01 PHEV19', 'B01 PHEV35', 'P3012', 'P11', 'B03'];
export const INITIAL_COLORS = ['HAMILTON WHITE', 'SUN GOLD BLACK', 'NEBULA GREY', 'AYERS GREY', 'KU GREY', 'ATLANTIS BLUE'];

export const ALL_PERMISSIONS = [
  'Box repair', 'Parking', 'KPI', 'USER PERMISSION MANAGEMENT', 'HISTORY', 
  'SUPPLY PARTS', 'RENAME LANES', 'MANAGE SPOTS', 'REPAIR REQUEST', 
  'LINE REQUEST', 'REQUEST APPROVED', 'APPROVE REQUESTS', 'REWORKERS', 
  'REAL TIME', 'FAST REPAIR',
  'MANAGE_LAYOUT',
  'ADD_LANE',
  'DELETE_LANE',
  'SET_PRIORITY',
  'VIEW_REALTIME_STATUS',
  'MANAGE_LINES',
  'MANAGE_BATCH_QUEUE',
  'UPDATE_BATCH_PROGRESS',
  'ANDON',
  'VIEW_ALL_LOGS',
  'CALL_QUALITY',
  'MANAGE_PRODUCTION_LINES',
  'MANAGE_METADATA'
];
