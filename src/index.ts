import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { getDb } from './state/db';
import { whatsappRouter } from './whatsapp/client';

import path from 'path';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend CRM panel
app.use(express.static(path.join(__dirname, '../public')));

// Serve documentos statically
app.use('/documentos', express.static(path.join(__dirname, '../documentos')));

// Registra endpoints do WhatsApp e CRM
app.use(whatsappRouter);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

async function startServer() {
  try {
    // 1. Inicializa Conexão e Tabelas no Banco de Dados
    await getDb();
    
    // 2. Inicia o Servidor Express
    app.listen(env.PORT, () => {
      console.log(`==================================================`);
      console.log(`  SDR Perelli Server Running!                      `);
      console.log(`  Port: ${env.PORT}                               `);
      console.log(`  Local Endpoint: http://localhost:${env.PORT}     `);
      console.log(`==================================================`);
    });
  } catch (error) {
    console.error('❌ Erro fatal ao iniciar o servidor:', error);
    process.exit(1);
  }
}

startServer();
