const express = require('express');
const router = express.Router({ mergeParams: true }); // gives access to :mapId
const pool = require('./src/db');

// GET /api/maps/:mapId/pins
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, road_name, notes, x_pct, y_pct, created_at, updated_at
       FROM road_pins WHERE map_id = $1 ORDER BY created_at ASC`,
      [req.params.mapId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/maps/:mapId/pins
router.post('/', async (req, res) => {
  const { road_name, notes, x_pct, y_pct } = req.body;

  if (!road_name?.trim()) return res.status(400).json({ error: 'road_name is required' });
  if (x_pct == null || y_pct == null) return res.status(400).json({ error: 'x_pct and y_pct are required' });
  if (x_pct < 0 || x_pct > 100 || y_pct < 0 || y_pct > 100)
    return res.status(400).json({ error: 'Coordinates must be 0–100' });

  // Verify map exists
  const mapCheck = await pool.query('SELECT id FROM maps WHERE id = $1', [req.params.mapId]);
  if (!mapCheck.rowCount) return res.status(404).json({ error: 'Map not found' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO road_pins (map_id, road_name, notes, x_pct, y_pct)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.mapId, road_name.trim(), (notes || '').trim(), x_pct, y_pct]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/maps/:mapId/pins/:pinId
router.put('/:pinId', async (req, res) => {
  const { road_name, notes, x_pct, y_pct } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE road_pins
       SET road_name  = COALESCE($1, road_name),
           notes      = COALESCE($2, notes),
           x_pct      = COALESCE($3, x_pct),
           y_pct      = COALESCE($4, y_pct),
           updated_at = NOW()
       WHERE id = $5 AND map_id = $6
       RETURNING *`,
      [road_name?.trim() || null, notes?.trim() ?? null, x_pct ?? null, y_pct ?? null,
       req.params.pinId, req.params.mapId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Pin not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/maps/:mapId/pins/:pinId
router.delete('/:pinId', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM road_pins WHERE id = $1 AND map_id = $2`,
      [req.params.pinId, req.params.mapId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Pin not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
