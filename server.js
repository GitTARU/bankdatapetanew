require('dotenv').config();
const express = require('express');
const path = require('path');
const pool = require('./src/db');
const { router: mapsRouter } = require('./routes-maps');
const pinsRouter = require('./routes-pins');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/maps', mapsRouter);
app.use('/api/maps/:mapId/pins', pinsRouter);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// Catch-all → serve SPA
app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🗺  Cartotheca v2 running at http://localhost:${PORT}`);
  console.log(`   PostgreSQL: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}\n`);
});
