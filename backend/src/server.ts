import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { authRoutes } from './modules/auth/authRoutes.js';
import { shiftRoutes } from './modules/shifts/shiftRoutes.js';
import { attendanceRoutes } from './modules/attendance/attendanceRoutes.js';
import { requestRoutes } from './modules/requests/requestRoutes.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.set('trust proxy', 1);
app.use(helmet());

function buildAllowedOrigins(): Set<string> {
  const origins = new Set<string>();
  const raw = [
    process.env.ALLOWED_ORIGINS || '',
    process.env.APP_URL || '',
    process.env.FRONTEND_URL || '',
  ].join(',');

  for (const item of raw.split(',')) {
    const normalized = item.trim().replace(/\/+$/, '');
    if (normalized && /^https?:\/\//i.test(normalized)) {
      origins.add(normalized);
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
    origins.add('http://localhost:5173');
    origins.add('http://127.0.0.1:5173');
  }

  return origins;
}

const allowedOrigins = buildAllowedOrigins();

// Middlewares
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    const normalized = origin.trim().replace(/\/+$/, '');
    if (allowedOrigins.has(normalized)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origem não autorizada pela política CORS.'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50kb' }));

app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    res.status(400).json({ error: 'Payload JSON inválido ou malformado.' });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Payload acima do limite permitido (50KB).' });
    return;
  }
  next(err);
});

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

// Handler global de erros (evita vazamento de stack traces ou detalhes internos)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (String(err?.message || '').includes('CORS')) {
    res.status(403).json({ error: 'Origem não autorizada.' });
    return;
  }
  console.error('[Server Error]', err?.message || 'Erro inesperado');
  res.status(500).json({ error: 'Erro interno no servidor.' });
});

// Inicialização do Servidor
app.listen(port, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 Servidor Pontuall Backend rodando na porta ${port}`);
  console.log(`📍 Endpoint Health Check: http://localhost:${port}/api/health`);
  console.log(`📚 Padrão de Nomenclatura: BNE Standard (TAB_)`);
  console.log(`==================================================\n`);
});
