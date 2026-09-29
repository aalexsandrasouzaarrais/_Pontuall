import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authRoutes } from './modules/auth/authRoutes.js';
import { shiftRoutes } from './modules/shifts/shiftRoutes.js';
import { attendanceRoutes } from './modules/attendance/attendanceRoutes.js';
import { requestRoutes } from './modules/requests/requestRoutes.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middlewares
app.use(cors({
  origin: '*', // Permitir acesso do frontend Vite
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Rota de Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    system: 'Pontuall API',
    architecture: 'DDD-Lite',
    convention: 'BNE Standard (TAB_)',
    timestamp: new Date().toISOString()
  });
});

// Registro dos Módulos DDD-Lite
app.use('/api/auth', authRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/requests', requestRoutes);

// Inicialização do Servidor
app.listen(port, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 Servidor Pontuall Backend rodando na porta ${port}`);
  console.log(`📍 Endpoint Health Check: http://localhost:${port}/api/health`);
  console.log(`📚 Padrão de Nomenclatura: BNE Standard (TAB_)`);
  console.log(`==================================================\n`);
});
