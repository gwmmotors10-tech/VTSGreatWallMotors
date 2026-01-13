
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { User, ParkingSpot, RequestPart, Vehicle, HistoryLog, ReworkSession, Role, HistoryCategory, ChatMessage, ProductionBatch, LineMessage } from '../types';
import * as XLSX from 'xlsx';

const SUPABASE_URL = 'https://uqahfzuoujqtgglsctei.supabase.co';
const SUPABASE_KEY = 'sb_publishable_NS2oWxTl5HFBkw0N4iBzLg_GRsHOb4A';

class SupabaseService {
  public supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  private mapUser(row: any): User {
    return {
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      role: row.role as Role,
      photoUrl: row.photo_url,
      password: row.password, 
      permissions: row.permissions || [],
      reworkerStatus: row.reworker_status
    };
  }

  async login(username: string, password: string): Promise<{ user: User | null, error: string | null }> {
    try {
      const { data, error } = await this.supabase.from('users').select('*').eq('username', username).eq('password', password).maybeSingle();
      if (error) return { user: null, error: error.message };
      if (!data) return { user: null, error: 'Invalid credentials' };
      return { user: this.mapUser(data), error: null };
    } catch (e: any) { return { user: null, error: e.message }; }
  }

  async register(user: Omit<User, 'id'>): Promise<{ success: boolean, error?: string }> {
    try {
      const newId = `user-${Date.now()}`;
      const { error } = await this.supabase.from('users').insert({ 
        id: newId, 
        username: user.username, 
        full_name: user.fullName, 
        role: user.role, 
        password: user.password, 
        permissions: user.permissions, 
        reworker_status: 'OFFLINE' 
      });
      return { success: !error, error: error?.message };
    } catch (e: any) { return { success: false, error: e.message }; }
  }

  async getUsers(): Promise<User[]> {
    const { data } = await this.supabase.from('users').select('*').order('full_name');
    return (data || []).map(this.mapUser);
  }

  async updateUser(user: User): Promise<void> {
    await this.supabase.from('users').update({ 
      full_name: user.fullName, 
      role: user.role, 
      photo_url: user.photoUrl, 
      permissions: user.permissions, 
      reworker_status: user.reworkerStatus 
    }).eq('id', user.id);
  }

  async updateUserStatus(username: string, status: string): Promise<void> {
    await this.supabase.from('users').update({ reworker_status: status }).eq('username', username);
  }

  async deleteUser(userId: string): Promise<void> { 
    await this.supabase.from('users').delete().eq('id', userId); 
  }

  async changePassword(userId: string, newPass: string): Promise<void> { 
    await this.supabase.from('users').update({ password: newPass }).eq('id', userId); 
  }

  async getSpots(area: 'BOX_REPAIR' | 'PARKING'): Promise<ParkingSpot[]> {
    const { data } = await this.supabase.from('parking_spots').select('*').eq('area', area).order('lane').order('number');
    return (data || []).map(row => ({
      id: row.id,
      lane: row.lane,
      number: row.number,
      area: row.area,
      vin: row.vin,
      allocatedAt: row.allocated_at,
      allocatedBy: row.allocated_by,
      shop: row.shop,
      waitingParts: row.waiting_parts,
      priority: row.priority,
      priorityComment: row.priority_comment,
      reallocationReason: row.reallocation_reason,
      callQuality: row.call_quality,
      missingParts: row.missing_parts || [],
      observations: row.observations
    }));
  }

  async swapSpots(fromId: string, toId: string, user: string): Promise<void> {
    const { data: fromSpot } = await this.supabase.from('parking_spots').select('*').eq('id', fromId).single();
    if (!fromSpot || !fromSpot.vin) return;

    await this.supabase.from('parking_spots').update({
      vin: fromSpot.vin,
      allocated_at: fromSpot.allocated_at,
      allocated_by: fromSpot.allocated_by,
      shop: fromSpot.shop,
      waiting_parts: fromSpot.waiting_parts,
      priority: fromSpot.priority,
      priority_comment: fromSpot.priority_comment,
      call_quality: fromSpot.call_quality,
      missing_parts: fromSpot.missing_parts,
      observations: fromSpot.observations
    }).eq('id', toId);

    await this.supabase.from('parking_spots').update({
      vin: null, allocated_at: null, allocated_by: null, shop: null,
      waiting_parts: false, priority: false, priority_comment: null,
      call_quality: false, missing_parts: [], observations: null
    }).eq('id', fromId);

    await this.logHistory(fromSpot.vin, 'SWAP_SPOT', user, `Moved from ${fromId} to ${toId}`, fromSpot.area as HistoryCategory);
  }

  async updateSpot(spotId: string, updates: Partial<ParkingSpot>): Promise<void> {
    const dbUpdates: any = {};
    if (updates.vin !== undefined) dbUpdates.vin = updates.vin;
    if (updates.allocatedBy !== undefined) dbUpdates.allocated_by = updates.allocatedBy;
    if (updates.allocatedAt !== undefined) dbUpdates.allocated_at = updates.allocatedAt;
    if (updates.shop !== undefined) dbUpdates.shop = updates.shop;
    if (updates.waitingParts !== undefined) dbUpdates.waiting_parts = updates.waitingParts;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.priorityComment !== undefined) dbUpdates.priority_comment = updates.priorityComment;
    if (updates.callQuality !== undefined) dbUpdates.call_quality = updates.callQuality;
    if (updates.missingParts !== undefined) dbUpdates.missing_parts = updates.missingParts;
    if (updates.observations !== undefined) dbUpdates.observations = updates.observations;
    await this.supabase.from('parking_spots').update(dbUpdates).eq('id', spotId);
  }

  async addNewLane(area: 'BOX_REPAIR' | 'PARKING', lane: string, count: number): Promise<void> {
    const inserts = Array.from({ length: count }, (_, i) => ({
      id: `${area}-${lane}-${i + 1}`,
      lane: lane,
      number: i + 1,
      area: area,
      missing_parts: []
    }));
    await this.supabase.from('parking_spots').insert(inserts);
  }

  async deleteLane(area: 'BOX_REPAIR' | 'PARKING', lane: string): Promise<void> {
    await this.supabase.from('parking_spots').delete().eq('area', area).eq('lane', lane);
  }

  async renameLane(area: 'BOX_REPAIR' | 'PARKING', oldLane: string, newLane: string): Promise<void> {
    const { data } = await this.supabase.from('parking_spots').select('*').eq('area', area).eq('lane', oldLane);
    if (!data) return;
    for (const spot of data) {
      const newId = `${area}-${newLane}-${spot.number}`;
      await this.supabase.from('parking_spots').update({ lane: newLane, id: newId }).eq('id', spot.id);
    }
  }

  async addSpotToLane(area: 'BOX_REPAIR' | 'PARKING', lane: string): Promise<void> {
    const { data } = await this.supabase.from('parking_spots').select('number').eq('area', area).eq('lane', lane).order('number', { ascending: false }).limit(1);
    const nextNum = (data?.[0]?.number || 0) + 1;
    const newId = `${area}-${lane}-${nextNum}`;
    await this.supabase.from('parking_spots').insert({ id: newId, lane, number: nextNum, area, missing_parts: [] });
  }

  async removeSpotFromLane(area: 'BOX_REPAIR' | 'PARKING', lane: string): Promise<void> {
    const { data } = await this.supabase.from('parking_spots').select('*').eq('area', area).eq('lane', lane).order('number', { ascending: false }).limit(1);
    if (data?.[0]) {
      if (data[0].vin) {
          throw new Error("Last spot in lane is not empty.");
      }
      await this.supabase.from('parking_spots').delete().eq('id', data[0].id);
    }
  }

  async getRequests(): Promise<RequestPart[]> {
    const { data } = await this.supabase.from('part_requests').select('*').order('requested_at', { ascending: false });
    return (data || []).map(row => ({
      id: row.id,
      vin: row.vin,
      line: row.line,
      partNumber: row.part_number,
      partName: row.part_name,
      quantity: row.quantity,
      reason: row.reason,
      requester: row.requester,
      requestedAt: row.requested_at,
      approvedAt: row.approved_at,
      processedBy: row.processed_by,
      lotNumber: row.lot_number,
      batchRetirada: row.batch_retirada,
      caseRetirada: row.case_retirada,
      rejectionReason: row.rejection_reason,
      receivedAt: row.received_at,
      receiverName: row.receiver_name,
      status: row.status as any,
      type: row.type as any,
      color: row.color
    }));
  }

  async addRequest(req: RequestPart): Promise<void> {
    await this.supabase.from('part_requests').insert({ 
      id: req.id, vin: req.vin, line: req.line, part_number: req.partNumber, 
      part_name: req.partName, quantity: req.quantity, reason: req.reason, 
      requester: req.requester, requested_at: req.requestedAt, status: req.status, 
      type: req.type, color: req.color 
    });
  }

  async updateRequest(id: string, updates: Partial<RequestPart>): Promise<void> {
    const dbUpdates: any = {};
    if (updates.partNumber) dbUpdates.part_number = updates.partNumber;
    if (updates.partName) dbUpdates.part_name = updates.partName;
    if (updates.lotNumber) dbUpdates.lot_number = updates.lotNumber;
    if (updates.batchRetirada) dbUpdates.batch_retirada = updates.batchRetirada;
    if (updates.caseRetirada) dbUpdates.case_retirada = updates.caseRetirada;
    if (updates.rejectionReason) dbUpdates.rejection_reason = updates.rejectionReason;
    if (updates.receivedAt) dbUpdates.received_at = updates.receivedAt;
    if (updates.receiverName) dbUpdates.receiver_name = updates.receiverName;
    if (updates.processedBy) dbUpdates.processed_by = updates.processedBy;
    if (updates.status) {
      dbUpdates.status = updates.status;
      dbUpdates.approved_at = new Date().toISOString(); 
    }
    await this.supabase.from('part_requests').update(dbUpdates).eq('id', id);
  }

  async getLineMessages(): Promise<LineMessage[]> {
    const { data } = await this.supabase.from('line_messages').select('*');
    return (data || []).map(r => ({ line: r.line as any, message: r.message, expiresAt: r.expires_at }));
  }

  async setLineMessage(line: 'B-Line' | 'P-Line', message: string, durationMinutes: number | null = null): Promise<void> {
    let expiresAt: string | null = null;
    if (durationMinutes && durationMinutes > 0) expiresAt = new Date(Date.now() + durationMinutes * 60000).toISOString();
    await this.supabase.from('line_messages').upsert({ line, message, expires_at: expiresAt, updated_at: new Date().toISOString() });
  }

  async getVehicles(): Promise<Vehicle[]> {
    const { data } = await this.supabase.from('vehicles').select('*').order('created_at', { ascending: false });
    return (data || []).map(v => ({ 
      vin: v.vin, 
      model: v.model, 
      color: v.color, 
      origin: v.origin, 
      destination: v.destination, 
      status: v.status, 
      missingParts: v.missing_parts || [], 
      observations: v.observations, 
      responsible: v.responsible || [],
      createdAt: v.created_at, 
      createdBy: v.created_by,
      finishedAt: v.finished_at, 
      history: [] 
    }));
  }

  async addVehicle(vehicle: Vehicle): Promise<void> {
    await this.supabase.from('vehicles').insert({ 
      vin: vehicle.vin.trim().toUpperCase(), 
      model: vehicle.model, 
      color: vehicle.color, 
      origin: vehicle.origin, 
      destination: vehicle.destination, 
      status: vehicle.status, 
      missing_parts: vehicle.missingParts, 
      observations: vehicle.observations, 
      responsible: vehicle.responsible,
      created_at: vehicle.createdAt, 
      created_by: vehicle.createdBy 
    });
  }

  async updateVehicle(vin: string, updates: Partial<Vehicle>): Promise<void> {
    const dbUpdates: any = {};
    if (updates.vin !== undefined) dbUpdates.vin = updates.vin.trim().toUpperCase(); // Allow VIN update
    if (updates.model !== undefined) dbUpdates.model = updates.model;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.origin !== undefined) dbUpdates.origin = updates.origin;
    if (updates.destination !== undefined) dbUpdates.destination = updates.destination;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.missingParts !== undefined) dbUpdates.missing_parts = updates.missingParts;
    if (updates.observations !== undefined) dbUpdates.observations = updates.observations;
    if (updates.responsible !== undefined) dbUpdates.responsible = updates.responsible;
    if (updates.finishedAt !== undefined) dbUpdates.finished_at = updates.finishedAt;
    await this.supabase.from('vehicles').update(dbUpdates).eq('vin', vin.trim().toUpperCase());
  }

  async getReworks(): Promise<ReworkSession[]> {
    const { data: sessions } = await this.supabase.from('rework_sessions').select('*').order('start_time', { ascending: false });
    const results: ReworkSession[] = [];
    for(const s of (sessions || [])) {
        const { data: mats } = await this.supabase.from('rework_materials').select('*').eq('session_id', s.id);
        results.push({ 
          id: s.id.toString(), vin: s.vin, user: s.user_name, startTime: s.start_time, 
          endTime: s.end_time, status: s.status as any, defectsCount: s.defects_count, 
          shop: s.shop, observations: s.observations, notFinishedReason: s.not_finished_reason, 
          materials: (mats || []).map(m => ({ name: m.name, qty: m.qty })) 
        });
    }
    return results;
  }

  async addRework(session: ReworkSession): Promise<void> {
    const { data } = await this.supabase.from('rework_sessions').insert({ 
      vin: session.vin, user_name: session.user, start_time: session.startTime, 
      end_time: session.endTime, status: session.status, defects_count: session.defectsCount, 
      shop: session.shop, observations: session.observations, not_finished_reason: session.notFinishedReason 
    }).select().single();
    if (data && session.materials.length > 0) {
      await this.supabase.from('rework_materials').insert(session.materials.map(m => ({ session_id: data.id, name: m.name, qty: m.qty })));
    }
  }

  async updateRework(sessionId: string, updates: Partial<ReworkSession>): Promise<void> {
    const dbUpdates: any = {};
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.endTime) dbUpdates.end_time = updates.endTime;
    if (updates.observations !== undefined) dbUpdates.observations = updates.observations;
    if (updates.defectsCount !== undefined) dbUpdates.defects_count = updates.defectsCount;
    await this.supabase.from('rework_sessions').update(dbUpdates).eq('id', sessionId);
  }

  async getBatches(): Promise<ProductionBatch[]> {
    const { data } = await this.supabase.from('production_batches').select('*').order('created_at', { ascending: false });
    return (data || []).map(b => {
      let parsedColors = {};
      try { 
        parsedColors = b.colors || {}; 
      } catch(e) { 
        parsedColors = {}; 
      }
      return { 
        id: b.id, name: b.name, line: b.line as any, totalQty: b.total_qty, 
        models: b.models, colors: parsedColors, status: b.status as any, 
        createdAt: b.created_at, completedAt: b.completed_at 
      };
    });
  }

  async addBatch(batch: ProductionBatch, user: string): Promise<void> {
    if (batch.status === 'ACTIVE') {
      await this.supabase.from('production_batches')
        .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
        .eq('line', batch.line)
        .eq('status', 'ACTIVE');
    }
    await this.supabase.from('production_batches').insert({ 
      id: batch.id, name: batch.name, line: batch.line, total_qty: batch.totalQty, 
      models: batch.models, colors: batch.colors, status: batch.status, created_at: batch.createdAt 
    });
    await this.logHistory(batch.name, 'BATCH_CREATE', user, `Created batch ${batch.name} for ${batch.line}`, 'KPI');
  }

  async updateBatch(batchId: string, updates: Partial<ProductionBatch>): Promise<void> {
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.models) dbUpdates.models = updates.models;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.colors) {
      dbUpdates.colors = updates.colors;
      dbUpdates.total_qty = (Object.values(updates.colors) as number[]).reduce((a, b) => a + b, 0);
    }
    await this.supabase.from('production_batches').update(dbUpdates).eq('id', batchId);
  }

  async deleteBatch(batchId: string): Promise<void> {
    await this.supabase.from('production_batches').delete().eq('id', batchId);
  }

  async decrementBatchQty(batchId: string, color: string): Promise<void> {
    const batches = await this.getBatches();
    const batch = batches.find(b => b.id === batchId);
    if (!batch) return;
    const colors = { ...batch.colors };
    if (colors[color] > 0) {
      colors[color]--;
      const newTotal = (Object.values(colors) as number[]).reduce((a, b) => a + b, 0);
      const isCompleted = newTotal === 0;
      const updates: any = { 
        colors, 
        total_qty: newTotal, 
        status: isCompleted ? 'COMPLETED' : batch.status 
      };
      if(isCompleted) updates.completed_at = new Date().toISOString();
      await this.supabase.from('production_batches').update(updates).eq('id', batchId);
      if (isCompleted) {
        const upcoming = batches
          .filter(b => b.line === batch.line && b.status === 'UPCOMING')
          .sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        if (upcoming[0]) {
          await this.supabase.from('production_batches').update({ status: 'ACTIVE' }).eq('id', upcoming[0].id);
        }
      }
    }
  }

  async incrementBatchQty(batchId: string, color: string): Promise<void> {
    const batches = await this.getBatches();
    const batch = batches.find(b => b.id === batchId);
    if (!batch) return;
    const colors = { ...batch.colors };
    colors[color] = (colors[color] || 0) + 1;
    const newTotal = (Object.values(colors) as number[]).reduce((a, b) => a + b, 0);
    await this.supabase.from('production_batches').update({ 
      colors, 
      total_qty: newTotal 
    }).eq('id', batchId);
  }

  async getHistory(): Promise<HistoryLog[]> {
    const { data } = await this.supabase.from('history_logs').select('*').order('date', { ascending: false }).limit(1000);
    return (data || []).map(r => ({ 
      id: r.id.toString(), date: r.date, vin: r.vin, action: r.action, 
      user: r.user_name, details: r.details, category: r.category as any 
    }));
  }

  async logHistory(vin: string, action: string, user: string, details: string, category: HistoryCategory): Promise<void> {
    await this.supabase.from('history_logs').insert({ vin: vin.trim().toUpperCase(), action, user_name: user, details, category, date: new Date().toISOString() });
  }

  async getMessages(): Promise<ChatMessage[]> {
    const { data } = await this.supabase.from('chat_messages').select('*').order('created_at', { ascending: true }).limit(50);
    return (data || []).map(r => ({ id: r.id.toString(), userId: r.user_id, userName: r.user_name, userPhoto: r.user_photo, recipientId: r.recipient_id, text: r.text, timestamp: r.created_at }));
  }

  async sendMessage(user: User, text: string, recipientId?: string): Promise<void> {
    await this.supabase.from('chat_messages').insert({ user_id: user.id, user_name: user.fullName, user_photo: user.photoUrl, recipient_id: recipientId, text });
  }

  exportData(data: any[], filename: string) {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
  }
}

export const db = new SupabaseService();
