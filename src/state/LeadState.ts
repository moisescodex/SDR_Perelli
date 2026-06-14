import { getDb, isDbConnected } from './db';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  media?: {
    type: 'document' | 'image' | 'audio' | 'video';
    url: string;
    filename?: string;
  } | null;
}

export interface Lead {
  phone: string;
  channel_phone_id: string; // ID do canal oficial de WhatsApp (display_phone_number ou phone_number_id)
  name: string | null;
  stage: 'SITUATION' | 'PROBLEM' | 'IMPLICATION' | 'NEED_PAYOFF' | 'MEETING_SCHEDULED' | 'CONVERTED' | 'LOST';
  status: 'pending' | 'active';
  unread?: boolean;
  has_cnpj?: string | null;
  current_plan?: string | null;
  num_lives?: string | null;
  preferred_hospitals?: string | null;
  requires_intervention?: boolean;
  document_status?: string | null;
  created_at?: string;
  updated_at?: string;
  history: Message[];
}

const inMemoryLeads = new Map<string, Lead>();

export class LeadState {
  static getInMemoryKey(phone: string, channelPhoneId: string): string {
    return `${phone}_${channelPhoneId}`;
  }

  static async getLead(phone: string, channelPhoneId: string = 'default'): Promise<Lead> {
    const db = await getDb();
    if (!isDbConnected || !db) {
      const key = this.getInMemoryKey(phone, channelPhoneId);
      let lead = inMemoryLeads.get(key);
      if (!lead) {
        lead = {
          phone,
          channel_phone_id: channelPhoneId,
          name: null,
          stage: 'SITUATION',
          status: 'active',
          unread: false,
          has_cnpj: null,
          current_plan: null,
          num_lives: null,
          preferred_hospitals: null,
          requires_intervention: false,
          document_status: null,
          history: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        inMemoryLeads.set(key, lead);
      }
      return lead;
    }

    const res = await db.query('SELECT * FROM leads WHERE phone = $1 AND channel_phone_id = $2', [phone, channelPhoneId]);
    const row = res.rows[0];
    
    if (row) {
      return {
        phone: row.phone,
        channel_phone_id: row.channel_phone_id,
        name: row.name,
        stage: row.stage as Lead['stage'],
        status: (row.status || 'active') as Lead['status'],
        unread: row.unread || false,
        has_cnpj: row.has_cnpj,
        current_plan: row.current_plan,
        num_lives: row.num_lives,
        preferred_hospitals: row.preferred_hospitals,
        requires_intervention: row.requires_intervention || false,
        document_status: row.document_status,
        created_at: row.created_at ? new Date(row.created_at).toISOString() : undefined,
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
        history: JSON.parse(row.history || '[]')
      };
    }

    // Retorna novo lead se não existir
    const newLead: Lead = {
      phone,
      channel_phone_id: channelPhoneId,
      name: null,
      stage: 'SITUATION',
      status: 'active',
      unread: false,
      has_cnpj: null,
      current_plan: null,
      num_lives: null,
      preferred_hospitals: null,
      requires_intervention: false,
      document_status: null,
      history: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    await this.saveLead(newLead);
    return newLead;
  }

  static async saveLead(lead: Lead): Promise<void> {
    lead.updated_at = new Date().toISOString();
    const db = await getDb();
    if (!isDbConnected || !db) {
      const key = this.getInMemoryKey(lead.phone, lead.channel_phone_id);
      inMemoryLeads.set(key, lead);
      return;
    }

    await db.query(
      `INSERT INTO leads (phone, channel_phone_id, name, stage, status, history, unread, has_cnpj, current_plan, num_lives, preferred_hospitals, requires_intervention, document_status, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
       ON CONFLICT(phone, channel_phone_id) DO UPDATE SET 
       name=excluded.name, 
       stage=excluded.stage, 
       status=excluded.status, 
       history=excluded.history, 
       unread=excluded.unread,
       has_cnpj=excluded.has_cnpj,
       current_plan=excluded.current_plan,
       num_lives=excluded.num_lives,
       preferred_hospitals=excluded.preferred_hospitals,
       requires_intervention=excluded.requires_intervention,
       document_status=excluded.document_status,
       updated_at=CURRENT_TIMESTAMP`,
      [
        lead.phone,
        lead.channel_phone_id,
        lead.name,
        lead.stage,
        lead.status || 'active',
        JSON.stringify(lead.history),
        lead.unread || false,
        lead.has_cnpj || null,
        lead.current_plan || null,
        lead.num_lives || null,
        lead.preferred_hospitals || null,
        lead.requires_intervention || false,
        lead.document_status || null
      ]
    );
  }

  static async addMessage(phone: string, channelPhoneId: string, role: 'user' | 'assistant', content: string, media?: Message['media']): Promise<void> {
    const lead = await this.getLead(phone, channelPhoneId);
    lead.history.push({ role, content, media: media || null });
    if (role === 'user') {
      lead.unread = true;
    }
    await this.saveLead(lead);
  }

  static async updateStage(phone: string, channelPhoneId: string, stage: Lead['stage']): Promise<void> {
    const lead = await this.getLead(phone, channelPhoneId);
    lead.stage = stage;
    await this.saveLead(lead);
  }

  static async getAllLeads(channelPhoneId?: string): Promise<Lead[]> {
    const db = await getDb();
    if (!isDbConnected || !db) {
      let list = Array.from(inMemoryLeads.values());
      if (channelPhoneId) {
        list = list.filter(l => l.channel_phone_id === channelPhoneId);
      }
      return list.sort((a, b) => {
        const tA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const tB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return tB - tA;
      });
    }

    let query = 'SELECT * FROM leads';
    const params: any[] = [];
    if (channelPhoneId) {
      query += ' WHERE channel_phone_id = $1';
      params.push(channelPhoneId);
    }
    query += ' ORDER BY updated_at DESC';

    const res = await db.query(query, params);
    return res.rows.map(row => ({
      phone: row.phone,
      channel_phone_id: row.channel_phone_id,
      name: row.name,
      stage: row.stage as Lead['stage'],
      status: (row.status || 'active') as Lead['status'],
      unread: row.unread || false,
      has_cnpj: row.has_cnpj,
      current_plan: row.current_plan,
      num_lives: row.num_lives,
      preferred_hospitals: row.preferred_hospitals,
      requires_intervention: row.requires_intervention || false,
      document_status: row.document_status,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : undefined,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
      history: JSON.parse(row.history || '[]')
    }));
  }

  static async getInactiveLeads(days: number = 7, channelPhoneId?: string): Promise<Lead[]> {
    const db = await getDb();
    if (!isDbConnected || !db) {
      const cutOff = new Date();
      cutOff.setDate(cutOff.getDate() - days);
      let list = Array.from(inMemoryLeads.values()).filter(lead => {
        if (lead.stage === 'CONVERTED' || lead.stage === 'LOST' || lead.status !== 'active') {
          return false;
        }
        const updated = lead.updated_at ? new Date(lead.updated_at) : new Date();
        return updated < cutOff;
      });
      if (channelPhoneId) {
        list = list.filter(l => l.channel_phone_id === channelPhoneId);
      }
      return list;
    }

    let query = `SELECT * FROM leads 
       WHERE stage NOT IN ('CONVERTED', 'LOST') 
       AND status = 'active'
       AND updated_at < NOW() - ($1 || ' days')::interval`;
    const params: any[] = [days];

    if (channelPhoneId) {
      query += ' AND channel_phone_id = $2';
      params.push(channelPhoneId);
    }

    const res = await db.query(query, params);
    const rows = res.rows;
    
    return rows.map(row => ({
      phone: row.phone,
      channel_phone_id: row.channel_phone_id,
      name: row.name,
      stage: row.stage as Lead['stage'],
      status: (row.status || 'active') as Lead['status'],
      unread: row.unread || false,
      has_cnpj: row.has_cnpj,
      current_plan: row.current_plan,
      num_lives: row.num_lives,
      preferred_hospitals: row.preferred_hospitals,
      requires_intervention: row.requires_intervention || false,
      document_status: row.document_status,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : undefined,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
      history: JSON.parse(row.history || '[]')
    }));
  }

  static async getActiveLeadsForFollowUp(channelPhoneId?: string): Promise<Lead[]> {
    const db = await getDb();
    if (!isDbConnected || !db) {
      const cutOff = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
      let list = Array.from(inMemoryLeads.values())
        .filter(lead => {
          if (lead.stage === 'CONVERTED' || lead.stage === 'LOST' || lead.status !== 'active') {
            return false;
          }
          const updated = lead.updated_at ? new Date(lead.updated_at) : new Date();
          return updated < cutOff;
        });
      if (channelPhoneId) {
        list = list.filter(l => l.channel_phone_id === channelPhoneId);
      }
      return list.sort((a, b) => {
        const tA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const tB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return tA - tB;
      });
    }

    let query = `SELECT * FROM leads 
       WHERE stage NOT IN ('CONVERTED', 'LOST') 
       AND status = 'active'
       AND updated_at < NOW() - INTERVAL '3 hours'`;
    const params: any[] = [];

    if (channelPhoneId) {
      query += ' AND channel_phone_id = $1';
      params.push(channelPhoneId);
    }
    query += ' ORDER BY updated_at ASC';

    const res = await db.query(query, params);
    const rows = res.rows;
    
    return rows.map(row => ({
      phone: row.phone,
      channel_phone_id: row.channel_phone_id,
      name: row.name,
      stage: row.stage as Lead['stage'],
      status: (row.status || 'active') as Lead['status'],
      unread: row.unread || false,
      has_cnpj: row.has_cnpj,
      current_plan: row.current_plan,
      num_lives: row.num_lives,
      preferred_hospitals: row.preferred_hospitals,
      requires_intervention: row.requires_intervention || false,
      document_status: row.document_status,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : undefined,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
      history: JSON.parse(row.history || '[]')
    }));
  }

  static async importLeads(leads: { phone: string, name: string, channel_phone_id?: string, created_at?: string, history?: string }[]): Promise<void> {
    const db = await getDb();
    if (!isDbConnected || !db) {
      for (const lead of leads) {
        const cleanPhone = lead.phone.replace(/\D/g, '');
        if (!cleanPhone) continue;
        const channelId = lead.channel_phone_id || 'default';
        const key = this.getInMemoryKey(cleanPhone, channelId);
        
        let existing = inMemoryLeads.get(key);
        if (!existing) {
          existing = {
            phone: cleanPhone,
            channel_phone_id: channelId,
            name: lead.name,
            stage: 'SITUATION',
            status: 'pending',
            unread: false,
            has_cnpj: null,
            current_plan: null,
            num_lives: null,
            preferred_hospitals: null,
            history: JSON.parse(lead.history || '[]'),
            created_at: lead.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          inMemoryLeads.set(key, existing);
        } else {
          existing.name = lead.name;
          if (!existing.history || existing.history.length === 0) {
            existing.history = JSON.parse(lead.history || '[]');
          }
          if (lead.created_at) existing.created_at = lead.created_at;
          existing.updated_at = new Date().toISOString();
        }
      }
      return;
    }

    for (const lead of leads) {
      const cleanPhone = lead.phone.replace(/\D/g, '');
      if (!cleanPhone) continue;
      
      const channelId = lead.channel_phone_id || 'default';
      const historyStr = lead.history || '[]';
      const createdAt = lead.created_at ? new Date(lead.created_at) : new Date();

      await db.query(
        `INSERT INTO leads (phone, channel_phone_id, name, stage, status, history, created_at, updated_at)
         VALUES ($1, $2, 'SITUATION', 'pending', $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT(phone, channel_phone_id) DO UPDATE SET 
           name = EXCLUDED.name,
           history = CASE WHEN leads.history IS NULL OR leads.history = '[]' THEN EXCLUDED.history ELSE leads.history END,
           created_at = EXCLUDED.created_at`,
        [cleanPhone, channelId, historyStr, createdAt]
      );
    }
  }

  static async getNextPendingLeads(limit: number = 25, channelPhoneId?: string): Promise<Lead[]> {
    const db = await getDb();
    if (!isDbConnected || !db) {
      let list = Array.from(inMemoryLeads.values()).filter(lead => lead.status === 'pending');
      if (channelPhoneId) {
        list = list.filter(l => l.channel_phone_id === channelPhoneId);
      }
      return list.sort((a, b) => {
        const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tA - tB;
      }).slice(0, limit);
    }

    let query = `SELECT * FROM leads WHERE status = 'pending'`;
    const params: any[] = [];
    if (channelPhoneId) {
      query += ' AND channel_phone_id = $2'; // limit is $1
      params.push(channelPhoneId);
    }
    query += ' ORDER BY created_at ASC LIMIT $1';

    const res = await db.query(query, [limit, ...params]);
    return res.rows.map(row => ({
      phone: row.phone,
      channel_phone_id: row.channel_phone_id,
      name: row.name,
      stage: row.stage as Lead['stage'],
      status: (row.status || 'pending') as Lead['status'],
      has_cnpj: row.has_cnpj,
      current_plan: row.current_plan,
      num_lives: row.num_lives,
      preferred_hospitals: row.preferred_hospitals,
      requires_intervention: row.requires_intervention || false,
      document_status: row.document_status,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : undefined,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
      history: JSON.parse(row.history || '[]')
    }));
  }
}
