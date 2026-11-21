// backend/src/routes/expenses.js
import express from 'express';
import pool from '../db.js';
import { requireAuth, requireAdmin } from '../jwt.js';

const router = express.Router();

// GET /api/expenses – списък с разходи (само админ)
// Филтри: ?month=2025-01  ?type=cleaning  ?cash_box=K1
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const { month, type, cash_box } = req.query;

  try {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ error: 'Невалиден формат за месец. Трябва да е YYYY-MM' });
      }
      conditions.push(`to_char(date, 'YYYY-MM') = $${paramIndex}`);
      values.push(month);
      paramIndex++;
    }

    if (type) {
      const allowedTypes = ['cleaning', 'elevator', 'water', 'door', 'intercom', 'electricity', 'other'];
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({ error: `Невалиден type. Позволени: ${allowedTypes.join(', ')}` });
      }
      conditions.push(`type = $${paramIndex}`);
      values.push(type);
      paramIndex++;
    }

    if (cash_box) {
      if (!['K1', 'K2'].includes(cash_box)) {
        return res.status(400).json({ error: 'Невалидна каса. Позволени: K1, K2' });
      }
      conditions.push(`cash_box = $${paramIndex}`);
      values.push(cash_box);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT id, date, amount, type, description, cash_box, category, created_at
      FROM expenses
      ${whereClause}
      ORDER BY date DESC
    `, values);

    res.json(result.rows);
  } catch (error) {
    console.error('Грешка при зареждане на разходи:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});

// POST /api/expenses – създава нов разход (само админ)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { date, amount, type, description, cash_box, category } = req.body;

  if (!date || !amount || !type) {
    return res.status(400).json({ error: 'Липсват задължителни полета: date, amount, type' });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Невалиден формат за дата. Трябва да е YYYY-MM-DD' });
  }

  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return res.status(400).json({ error: 'Невалидна дата' });
  }

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return res.status(400).json({ error: 'Невалидна сума' });
  }

  const allowedTypes = ['cleaning', 'elevator', 'water', 'door', 'intercom', 'electricity', 'other'];
  if (!allowedTypes.includes(type)) {
    return res.status(400).json({ error: `Невалиден type. Позволени: ${allowedTypes.join(', ')}` });
  }

  // Валидация на cash_box (по подразбиране K1)
  const finalCashBox = cash_box || 'K1';
  if (!['K1', 'K2'].includes(finalCashBox)) {
    return res.status(400).json({ error: 'Невалидна каса. Позволени: K1, K2' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO expenses (date, amount, type, description, cash_box, category)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, date, amount, type, description, cash_box, category, created_at
    `, [date, amountNum, type, description || null, finalCashBox, category || null]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Грешка при създаване на разход:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});

// PUT /api/expenses/:id – обновява разход (само админ)
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || id < 1) {
    return res.status(400).json({ error: 'Невалиден id' });
  }

  const { date, amount, type, description, cash_box, category } = req.body;

  if (date === undefined && amount === undefined && type === undefined && description === undefined && cash_box === undefined && category === undefined) {
    return res.status(400).json({ error: 'Поне едно поле трябва да е подадено' });
  }

  if (date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Невалиден формат за дата. Трябва да е YYYY-MM-DD' });
    }
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Невалидна дата' });
    }
  }

  let amountNum;
  if (amount !== undefined) {
    amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'Невалидна сума' });
    }
  }

  if (type !== undefined) {
    const allowedTypes = ['cleaning', 'elevator', 'water', 'door', 'intercom', 'electricity', 'other'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: `Невалиден type. Позволени: ${allowedTypes.join(', ')}` });
    }
  }

  if (cash_box !== undefined && !['K1', 'K2'].includes(cash_box)) {
    return res.status(400).json({ error: 'Невалидна каса. Позволени: K1, K2' });
  }

  try {
    const exists = await pool.query('SELECT id FROM expenses WHERE id = $1', [id]);
    if (!exists.rows[0]) {
      return res.status(404).json({ error: 'Такъв разход не е намерен' });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (date !== undefined) { updates.push(`date = $${paramIndex}`); values.push(date); paramIndex++; }
    if (amount !== undefined) { updates.push(`amount = $${paramIndex}`); values.push(amountNum); paramIndex++; }
    if (type !== undefined) { updates.push(`type = $${paramIndex}`); values.push(type); paramIndex++; }
    if (description !== undefined) { updates.push(`description = $${paramIndex}`); values.push(description || null); paramIndex++; }
    if (cash_box !== undefined) { updates.push(`cash_box = $${paramIndex}`); values.push(cash_box); paramIndex++; }
    if (category !== undefined) { updates.push(`category = $${paramIndex}`); values.push(category || null); paramIndex++; }

    values.push(id);

    const result = await pool.query(`
      UPDATE expenses
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, date, amount, type, description, cash_box, category, created_at
    `, values);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Грешка при обновяване на разход:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});

// DELETE /api/expenses/:id – изтрива разход (само админ)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || id < 1) {
    return res.status(400).json({ error: 'Невалиден id' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM expenses WHERE id = $1 RETURNING id, date, amount, type',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Такъв разход не е намерен. Нищо не е изтрито!' });
    }

    res.json({ message: 'Разходът е изтрит', deleted: result.rows[0] });
  } catch (error) {
    console.error('Грешка при изтриване на разхода:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});

export default router;