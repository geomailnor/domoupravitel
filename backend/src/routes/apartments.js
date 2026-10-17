// backend/src/routes/apartments.js
import express from 'express';
import pool from '../db.js';
import { requireAuth, requireAdmin } from '../jwt.js';

const router = express.Router();

// GET /api/apartments – списък с всички апартаменти (само админ)
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, number, floor, owner_name, phone, notes, password, created_at
      FROM apartments
      ORDER BY number ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Грешка при взимане на апартаменти:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});
// GET /api/apartments/:number – връща един апартамент по номер
router.get('/:number', requireAuth, requireAdmin, async (req, res) => {
  const number = parseInt(req.params.number, 10);

  if (!number || number < 1 || number > 90) {
    return res.status(400).json({ error: 'Невалиден номер на апартамент' });
  }

  try {
    const result = await pool.query(`
      SELECT id, number, floor, owner_name, phone, notes, password, created_at
      FROM apartments
      WHERE number = $1
    `, [number]);

    const apartment = result.rows[0];

    if (!apartment) {
      return res.status(404).json({ error: 'Апартаментът не е намерен' });
    }

    res.json(apartment);
  } catch (error) {
    console.error('Грешка при взимане на апартамент:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});
// PUT /api/apartments/:number – обновява данните на апартамент
router.put('/:number', requireAuth, requireAdmin, async (req, res) => {
  const number = parseInt(req.params.number, 10);

  if (!number || number < 1 || number > 90) {
    return res.status(400).json({ error: 'Невалиден номер на апартамент' });
  }

  const { owner_name, phone, notes } = req.body;

  try {
    const exists = await pool.query(
      'SELECT id FROM apartments WHERE number = $1',
      [number]
    );

    if (!exists.rows[0]) {
      return res.status(404).json({ error: 'Апартаментът не е намерен' });
    }

    const result = await pool.query(`
      UPDATE apartments
      SET owner_name = $1,
          phone = $2,
          notes = $3
      WHERE number = $4
      RETURNING id, number, floor, owner_name, phone, notes, created_at
    `, [
      owner_name || null,
      phone || null,
      notes || null,
      number
    ]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Грешка при редактиране на апартамент:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});
export default router;