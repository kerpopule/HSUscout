import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import pitRoutes from './routes/pit.js';
import matchRoutes from './routes/match.js';
import syncRoutes from './routes/sync.js';
import pinRoutes from './routes/pin.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// API routes
app.use('/api', pinRoutes);
app.use('/api', pitRoutes);
app.use('/api', matchRoutes);
app.use('/api', syncRoutes);
app.use('/api', adminRoutes);

// Serve built frontend in production
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Smoky Scout Pro server running on port ${PORT}`);
});
