import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { User, ParkingSpot, RequestPart, Vehicle, HistoryLog, ReworkSession, Role, HistoryCategory, ChatMessage, ProductionBatch, LineMessage } from '../types';
import * as XLSX from 'xlsx';

const SUPABASE_URL = 'https://sqefcgtihapowjguachy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_6BcgxqZUtUZyh7PD0gd45A_TyUdEALp';

class SupabaseService {
  private supabase: SupabaseClient;
  private lines: string[] = ['Trim Line', 'Chassis Line', 'Final Line', 'Door Line', 'Engine Line'];

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

  private mapSpot(row: any): ParkingSpot {
    return {
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
      callQuality: row.call_quality
    };
  }

  private mapRequest(row: any): RequestPart {
    return {
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
      status: row.status as any,
      type: row.type as any,
      color: row.color
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
      const { error } = await this.supabase.from('users').insert({ id: newId, username: user.username, full_name: user.fullName, role: user.role, password: user.password, permissions: user.permissions, reworker_status: 'OFFLINE' });
      return { success: !error, error: error?.message };
    } catch (e: any) { return { success: false, error: e.message }; }
  }

  async getUsers(): Promise<User[]> {
    const { data } = await this.supabase.from('users').select('*').order('full_name');
    return (data || []).map(this.mapUser);
  }

  async updateUser(user: User): Promise<void> {
    await this.supabase.from('users').update({ full_name: user.fullName, role: user.role, photo_url: user.photoUrl, permissions: user.permissions, reworker_status: user.reworkerStatus }).eq('id', user.id);
  }

  async updateUserStatus(username: string, status: string): Promise<void> {
    await this.supabase.from('users').update({ reworker_status: status }).eq('username', username);
  }

  async deleteUser(userId: string): Promise<void> { await this.supabase.from('users').delete().eq('id', userId); }
  async changePassword(userId: string, newPass: string): Promise<void> { await this.supabase.from('users').update({ password: newPass }).eq('id', userId); }

  async getSpots(area: 'BOX_REPAIR' | 'PARKING'): Promise<ParkingSpot[]> {
    const { data } = await this.supabase.from('parking_spots').select('*').eq('area', area).order('lane').order('number');
    return (data || []).map(this.mapSpot);
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
    await this.supabase.from('parking_spots').update(dbUpdates).eq('id', spotId);
  }

  async addNewLane(area: 'BOX_REPAIR' | 'PARKING', lane: string, count: number): Promise<void> {
    const inserts = Array.from({ length: count }, (_, i) => ({
      id: `${area}-${lane}-${i + 1}`,
      lane: lane,
      number: i + 1,
      area: area
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
    await this.supabase.from('parking_spots').insert({ id: `${area}-${lane}-${nextNum}`, lane, number: nextNum, area });
  }

  async removeSpotFromLane(area: 'BOX_REPAIR' | 'PARKING', lane: string): Promise<void> {
    const { data } = await this.supabase.from('parking_spots').select('*').eq('area', area).eq('lane', lane).order('number', { ascending: false }).limit(1);
    if (data?.[0]) await this.supabase.from('parking_spots').delete().eq('id', data[0].id);
  }

  async getRequests(): Promise<RequestPart[]> {
    const { data } = await this.supabase.from('part_requests').select('*').order('requested_at', { ascending: false });
    return (data || []).map(this.mapRequest);
  }

  async addRequest(req: RequestPart): Promise<void> {
    await this.supabase.from('part_requests').insert({ id: req.id, vin: req.vin, line: req.line, part_number: req.partNumber, part_name: req.partName, quantity: req.quantity, reason: req.reason, requester: req.requester, requested_at: req.requestedAt, status: req.status, type: req.type, color: req.color });
  }

  async updateRequest(id: string, updates: Partial<RequestPart>): Promise<void> {
    const dbUpdates: any = {};
    if (updates.partNumber) dbUpdates.part_number = updates.partNumber;
    if (updates.partName) dbUpdates.part_name = updates.partName;
    if (updates.lotNumber) dbUpdates.lot_number = updates.lotNumber;
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
      missingParts: v.missing_parts, 
      observations: v.observations, 
      createdAt: v.created_at, 
      createdBy: v.created_by, 
      history: [] 
    }));
  }

  async addVehicle(vehicle: Vehicle): Promise<void> {
    const { error } = await this.supabase.from('vehicles').insert({ 
      vin: vehicle.vin.trim().toUpperCase(), 
      model: vehicle.model, 
      color: vehicle.color, 
      origin: vehicle.origin, 
      destination: vehicle.destination, 
      status: vehicle.status, 
      missing_parts: vehicle.missingParts, 
      observations: vehicle.observations, 
      created_at: vehicle.createdAt, 
      created_by: vehicle.createdBy 
    });
    if (error) {
        console.error("Error adding vehicle:", error.message);
        throw new Error(error.message);
    }
  }

  async updateVehicle(vin: string, updates: Partial<Vehicle>): Promise<void> {
    const dbUpdates: any = {};
    if (updates.model !== undefined) dbUpdates.model = updates.model;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.origin !== undefined) dbUpdates.origin = updates.origin;
    if (updates.destination !== undefined) dbUpdates.destination = updates.destination;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.missingParts !== undefined) dbUpdates.missing_parts = updates.missingParts;
    if (updates.observations !== undefined) dbUpdates.observations = updates.observations;
    
    // Cleanup any accidental undefined values
    Object.keys(dbUpdates).forEach(key => dbUpdates[key] === undefined && delete dbUpdates[key]);

    const cleanVin = vin.trim().toUpperCase();
    const { data, error } = await this.supabase
        .from('vehicles')
        .update(dbUpdates)
        .eq('vin', cleanVin)
        .select();

    if (error) {
        const fullError = `Error updating vehicle ${cleanVin}: ${error.message} (Code: ${error.code})`;
        console.error(fullError);
        throw new Error(fullError);
    }

    if (!data || data.length === 0) {
        console.warn(`Update executed but no rows were matched for VIN: ${cleanVin}`);
    }
  }

  async getReworks(): Promise<ReworkSession[]> {
    const { data: sessions } = await this.supabase.from('rework_sessions').select('*').order('start_time', { ascending: false });
    const results: ReworkSession[] = [];
    for(const s of (sessions || [])) {
        const { data: mats } = await this.supabase.from('rework_materials').select('*').eq('session_id', s.id);
        results.push({ 
          id: s.id.toString(), 
          vin: s.vin, 
          user: s.user_name, 
          startTime: s.start_time, 
          endTime: s.end_time, 
          status: s.status as any, 
          defectsCount: s.defects_count, 
          shop: s.shop, 
          observations: s.observations, 
          notFinishedReason: s.not_finished_reason, 
          materials: (mats || []).map(m => ({ name: m.name, qty: m.qty })),
          totalPausedTime: s.total_paused_time || 0
        });
    }
    return results;
  }

  async addRework(session: ReworkSession): Promise<void> {
    const { data, error } = await this.supabase
      .from('rework_sessions')
      .insert({ 
        id: session.id,
        vin: session.vin, 
        user_name: session.user, 
        start_time: session.startTime, 
        end_time: session.endTime, 
        status: session.status, 
        defects_count: session.defectsCount, 
        shop: session.shop, 
        observations: session.observations, 
        not_finished_reason: session.notFinishedReason,
        total_paused_time: session.totalPausedTime || 0
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error adding rework session:', error);
      throw error;
    }
    
    if (data && session.materials && session.materials.length > 0) {
      const materialsInsert = session.materials.map(m => ({ 
        session_id: data.id, 
        name: m.name, 
        qty: m.qty 
      }));
      
      const { error: matError } = await this.supabase
        .from('rework_materials')
        .insert(materialsInsert);
      
      if (matError) {
        console.error('Error adding rework materials:', matError);
      }
    }
  }

  async updateRework(sessionId: string, updates: Partial<ReworkSession>): Promise<void> {
    try {
      // Primeiro, atualiza os dados principais da sessão
      const sessionUpdates: any = {};
      
      if (updates.status !== undefined) sessionUpdates.status = updates.status;
      if (updates.endTime !== undefined) sessionUpdates.end_time = updates.endTime;
      if (updates.defectsCount !== undefined) sessionUpdates.defects_count = updates.defectsCount;
      if (updates.shop !== undefined) sessionUpdates.shop = updates.shop;
      if (updates.observations !== undefined) sessionUpdates.observations = updates.observations;
      if (updates.notFinishedReason !== undefined) sessionUpdates.not_finished_reason = updates.notFinishedReason;
      
      // Atualiza a sessão principal
      const { error: sessionError } = await this.supabase
        .from('rework_sessions')
        .update(sessionUpdates)
        .eq('id', sessionId);
      
      if (sessionError) {
        console.error('Error updating rework session:', sessionError);
        throw sessionError;
      }
      
      // Se houver materiais para atualizar, remove os antigos e insere os novos
      if (updates.materials !== undefined) {
        // Remove todos os materiais existentes para esta sessão
        const { error: deleteError } = await this.supabase
          .from('rework_materials')
          .delete()
          .eq('session_id', sessionId);
        
        if (deleteError) {
          console.error('Error deleting old materials:', deleteError);
        }
        
        // Insere os novos materiais
        if (updates.materials.length > 0) {
          const materialsInsert = updates.materials.map(m => ({ 
            session_id: sessionId, 
            name: m.name, 
            qty: m.qty 
          }));
          
          const { error: insertError } = await this.supabase
            .from('rework_materials')
            .insert(materialsInsert);
          
          if (insertError) {
            console.error('Error inserting new materials:', insertError);
          }
        }
      }
      
      console.log(`Rework session ${sessionId} updated successfully`);
    } catch (error) {
      console.error('Error in updateRework:', error);
      throw error;
    }
  }

  async getBatches(): Promise<ProductionBatch[]> {
    const { data } = await this.supabase.from('production_batches').select('*').order('created_at', { ascending: false });
    return (data || []).map(b => {
      let parsedColors = b.colors;
      if (typeof b.colors === 'string') {
        try { 
          const decoded = atob(b.colors);
          parsedColors = JSON.parse(decoded); 
        } catch(e) { 
          try {
            parsedColors = JSON.parse(b.colors);
          } catch(e2) {
            parsedColors = {}; 
          }
        }
      }
      return { id: b.id, name: b.name, line: b.line as any, totalQty: b.total_qty, models: b.models, colors: parsedColors, status: b.status as any, createdAt: b.created_at, completedAt: b.completed_at };
    });
  }

  async addBatch(batch: ProductionBatch): Promise<void> {
    if (batch.status === 'ACTIVE') {
      await this.supabase.from('production_batches')
        .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
        .eq('line', batch.line)
        .eq('status', 'ACTIVE');
    }
    
    const colorsData = btoa(JSON.stringify(batch.colors));
    const { error } = await this.supabase.from('production_batches').insert({ 
      id: batch.id, 
      name: batch.name, 
      line: batch.line, 
      total_qty: batch.totalQty, 
      models: batch.models, 
      colors: colorsData, 
      status: batch.status, 
      created_at: batch.createdAt 
    });
    
    if (error) throw error;
  }

  async updateBatch(batchId: string, updates: Partial<ProductionBatch>): Promise<void> {
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.models) dbUpdates.models = updates.models;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.colors) {
      dbUpdates.colors = btoa(JSON.stringify(updates.colors));
      dbUpdates.total_qty = (Object.values(updates.colors) as number[]).reduce((a, b) => a + b, 0);
    }

    await this.supabase.from('production_batches').update(dbUpdates).eq('id', batchId);
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
        colors: btoa(JSON.stringify(colors)), 
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

  async getHistory(): Promise<HistoryLog[]> {
    const { data } = await this.supabase.from('history_logs').select('*').order('date', { ascending: false }).limit(500);
    return (data || []).map(r => ({ id: r.id.toString(), date: r.date, vin: r.vin, action: r.action, user: r.user_name, details: r.details, category: r.category as any }));
  }

  async logHistory(vin: string, action: string, user: string, details: string, category: HistoryCategory): Promise<void> {
    await this.supabase.from('history_logs').insert({ vin: vin.trim().toUpperCase(), action, user_name: user, details, category, date: new Date().toISOString() });
  }

  async getMessages(): Promise<ChatMessage[]> {
    const { data } = await this.supabase.from('chat_messages').select('*').order('created_at', { ascending: true }).limit(50);
    return (data || []).map(r => ({ id: r.id.toString(), userId: r.user_id, userName: r.user_name, userPhoto: r.user_photo, recipient_id: r.recipient_id, text: r.text, timestamp: r.created_at }));
  }

  async sendMessage(user: User, text: string, recipientId?: string): Promise<void> {
    await this.supabase.from('chat_messages').insert({ user_id: user.id, user_name: user.fullName, user_photo: user.photoUrl, recipient_id: recipientId, text });
  }

  getLines() { return this.lines; }
  addLine(l: string) { if(!this.lines.includes(l)) this.lines.push(l); }
  removeLine(l: string) { this.lines = this.lines.filter(x => x !== l); }

  exportData(data: any[], filename: string) {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
  }
}

export const db = new SupabaseService();
