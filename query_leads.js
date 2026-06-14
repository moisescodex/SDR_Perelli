const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://perelli_postgres_user:RWDaFJNttEJdeKFKJz0oF28byY9FPog6@dpg-d8nb9fbeo5us73eor7jg-a.oregon-postgres.render.com/perelli_postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const res = await pool.query("SELECT channel_phone_id, count(*) FROM leads GROUP BY channel_phone_id");
    console.log('--- LEADS BY CHANNEL_PHONE_ID ---');
    console.log(res.rows);

    const res2 = await pool.query("SELECT * FROM whatsapp_channels");
    console.log('--- CHANNELS ---');
    console.log(res2.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
