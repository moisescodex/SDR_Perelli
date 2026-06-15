import { Pool } from 'pg';
import { env } from '../config/env';

let pool: Pool | null = null;
export let isDbConnected = false;
let isDbChecked = false;

export async function getDb(): Promise<Pool | null> {
  if (isDbChecked) return pool;

  if (!env.DATABASE_URL) {
    isDbConnected = false;
    isDbChecked = true;
    return null;
  }

  try {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: env.DATABASE_URL.includes('localhost') || env.DATABASE_URL.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
    });
    const client = await pool.connect();
    client.release();
    isDbConnected = true;
    console.log('✅ Banco de dados PostgreSQL conectado com sucesso.');
    await initDb(pool);
  } catch (error) {
    console.error('❌ Erro ao conectar no PostgreSQL:', error);
    console.warn('⚠️ WARNING: O banco de dados PostgreSQL falhou ou não está configurado. Entrando em modo EM MEMÓRIA.');
    isDbConnected = false;
    pool = null;
  }
  isDbChecked = true;
  return pool;
}

async function initDb(pool: Pool) {
  // 1. Cria a tabela de canais do WhatsApp
  await pool.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_channels (
      phone_number_id TEXT PRIMARY KEY,
      display_phone_number TEXT NOT NULL,
      access_token TEXT,
      name TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Criação da tabela principal de leads com chave composta
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      phone TEXT,
      channel_phone_id TEXT DEFAULT 'default',
      name TEXT,
      stage TEXT DEFAULT 'SITUATION',
      status TEXT DEFAULT 'active',
      unread BOOLEAN DEFAULT FALSE,
      history TEXT,
      has_cnpj TEXT,
      current_plan TEXT,
      num_lives TEXT,
      preferred_hospitals TEXT,
      requires_intervention BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (phone, channel_phone_id)
    );
  `);

  // Se a tabela já existia e não possuía a coluna channel_phone_id, vamos adicioná-la e atualizar a PK
  try {
    await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS channel_phone_id TEXT DEFAULT 'default';`);
    await pool.query(`UPDATE leads SET channel_phone_id = 'default' WHERE channel_phone_id IS NULL;`);
    await pool.query(`ALTER TABLE leads ALTER COLUMN channel_phone_id SET NOT NULL;`);
    
    // Tenta atualizar a PK se ela for apenas 'phone'
    const pkCheck = await pool.query(`
      SELECT a.attname
      FROM   pg_index i
      JOIN   pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE  i.indrelid = 'leads'::regclass
      AND    i.indisprimary;
    `);
    
    if (pkCheck.rows.length === 1 && pkCheck.rows[0].attname === 'phone') {
      console.log('🔄 Atualizando chave primária de leads para composta (phone, channel_phone_id)...');
      await pool.query(`ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_pkey;`);
      await pool.query(`ALTER TABLE leads ADD PRIMARY KEY (phone, channel_phone_id);`);
    }
  } catch (err) {
    console.error('⚠️ Erro na migração das colunas/PK do banco:', err);
  }

  // Garante que todas as colunas necessárias existam
  await pool.query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
  `);
  await pool.query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS unread BOOLEAN DEFAULT FALSE;
  `);
  await pool.query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_cnpj TEXT;
  `);
  await pool.query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS current_plan TEXT;
  `);
  await pool.query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS num_lives TEXT;
  `);
  await pool.query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS preferred_hospitals TEXT;
  `);
  await pool.query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS requires_intervention BOOLEAN DEFAULT FALSE;
  `);
  await pool.query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS document_status TEXT;
  `);
  await pool.query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_level INT DEFAULT 0;
  `);
  await pool.query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_follow_up_at TIMESTAMP DEFAULT NULL;
  `);

  // Tabela de configurações
  await pool.query(`
    CREATE TABLE IF NOT EXISTS configs (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  console.log('✅ Banco de dados PostgreSQL inicializado com sucesso.');
}
