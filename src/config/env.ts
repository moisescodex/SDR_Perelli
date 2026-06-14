import { config } from 'dotenv';
import path from 'path';

// Carrega .env do diretório raiz do projeto
config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  PORT: process.env.PORT || '3001',
  DATABASE_URL: process.env.DATABASE_URL || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN || '',
  META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN || '',
  META_PHONE_ID: process.env.META_PHONE_ID || '',
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
  ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM' // Default Rachel voice
};

// Validação simples
if (!env.DATABASE_URL) {
  console.warn('⚠️ WARNING: DATABASE_URL não está definida no arquivo .env');
}
if (!env.GEMINI_API_KEY) {
  console.warn('⚠️ WARNING: GEMINI_API_KEY não está definida no arquivo .env');
}
