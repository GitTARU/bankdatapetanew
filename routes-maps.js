const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const pool = require('./src/db');

const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, file.originalname + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    file.mimetype.startsWith('image/')
      ? cb(null, true)
      : cb(new Error('Only image files are allowed'));
  }
});

// GET /api/maps
router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  try {
    const { rows } = await pool.query(
      `SELECT maps.id, name, maps.notes, filename, original_name, file_size, uploaded_at, maps.updated_at,
              (SELECT COUNT(*) FROM road_pins rp WHERE rp.map_id = maps.id) AS pin_count
       FROM maps
       LEFT JOIN road_pins on maps.id = road_pins.map_id
       WHERE ($1 = '' OR name ILIKE '%' || $1 || '%') or ($1 = '' OR road_name ILIKE '%' || $1 || '%')
       ORDER BY uploaded_at DESC`,
      [q]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/maps/:id  — single map with its pins
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, notes, filename, original_name, file_size, uploaded_at, updated_at
       FROM maps WHERE id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });

    const { rows: pins } = await pool.query(
      `SELECT id, road_name, notes, x_pct, y_pct, created_at, updated_at
       FROM road_pins WHERE map_id = $1 ORDER BY created_at ASC`,
      [req.params.id]
    );

    res.json({ ...rows[0], pins });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/maps — upload new map
router.post('/', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  const name  = (req.body.name  || req.file.originalname).trim();
  const notes = (req.body.notes || '').trim();

  try {
    const { rows } = await pool.query(
      `INSERT INTO maps (name, notes, filename, original_name, file_size)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, notes, req.file.filename, req.file.originalname, req.file.size]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    // Clean up uploaded file on DB error
    fs.unlink(req.file.path, () => {});
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/maps/:id — update metadata
router.put('/:id', async (req, res) => {
  const { name, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE maps SET name = COALESCE($1, name), notes = COALESCE($2, notes), updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [name?.trim() || null, notes?.trim() ?? null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/maps/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM maps WHERE id = $1 RETURNING filename`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });

    const filePath = path.join(UPLOADS_DIR, rows[0].filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = { router, upload };
