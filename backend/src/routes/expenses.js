// backend/src/routes/expenses.js
import express from 'express';
import pool from '../db.js';
import { requireAuth, requireAdmin } from '../jwt.js';

const router = express.Router();

// GET /api/expenses – списък с разходи (само админ)
// Филтри: ?month=2025-01  ?type=cleaning
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const { month, type } = req.query;

  try {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (month) {
      // Проверка на формата YYYY-MM
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({
          error: 'Невалиден формат за месец. Трябва да е YYYY-MM (напр. 2025-01)'
        });
      }
      conditions.push(`to_char(date, 'YYYY-MM') = $${paramIndex}`);
      values.push(month);
      paramIndex++;
    }

    if (type) {
      const allowedTypes = ['cleaning', 'elevator', 'water', 'door', 'intercom', 'electricity', 'other'];
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({
          error: `Невалиден type. Позволени: ${allowedTypes.join(', ')}`
        });
      }
      conditions.push(`type = $${paramIndex}`);
      values.push(type);
      paramIndex++;
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const result = await pool.query(`
      SELECT
        id,
        date,
        amount,
        type,
        description,
        created_at
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
  const { date, amount, type, description } = req.body;

  // 1. Проверка за задължителни полета
  if (!date || !amount || !type) {
    return res.status(400).json({
      error: 'Липсват задължителни полета: date, amount, type'
    });
  }

  // 2. Валидация на date (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({
      error: 'Невалиден формат за дата. Трябва да е YYYY-MM-DD (напр. 2025-01-15)'
    });
  }

  // Проверка дали е реална дата
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return res.status(400).json({ error: 'Невалидна дата' });
  }

  // 3. Валидация на amount
  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return res.status(400).json({ error: 'Невалидна сума' });
  }

  // 4. Валидация на type
  const allowedTypes = ['cleaning', 'elevator', 'water', 'door', 'intercom', 'electricity', 'other'];
  if (!allowedTypes.includes(type)) {
    return res.status(400).json({
      error: `Невалиден type. Позволени: ${allowedTypes.join(', ')}`
    });
  }

  try {
    const result = await pool.query(`
      INSERT INTO expenses (date, amount, type, description)
      VALUES ($1, $2, $3, $4)
      RETURNING id, date, amount, type, description, created_at
    `, [date, amountNum, type, description || null]);

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

  const { date, amount, type, description } = req.body;

  // Поне едно поле трябва да е подадено
  if (date === undefined && amount === undefined && type === undefined && description === undefined) {
    return res.status(400).json({
      error: 'Поне едно поле трябва да е подадено (date, amount, type, description)'
    });
  }

  // Валидация на date, ако е подадено
  if (date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        error: 'Невалиден формат за дата. Трябва да е YYYY-MM-DD'
      });
    }
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Невалидна дата' });
    }
  }

  // Валидация на amount, ако е подадено
  let amountNum;
  if (amount !== undefined) {
    amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'Невалидна сума' });
    }
  }

  // Валидация на type, ако е подаден
  if (type !== undefined) {
    const allowedTypes = ['cleaning', 'elevator', 'water', 'door', 'intercom', 'electricity', 'other'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        error: `Невалиден type. Позволени: ${allowedTypes.join(', ')}`
      });
    }
  }

  try {
    // Провери дали разходът съществува
    const exists = await pool.query(
      'SELECT id FROM expenses WHERE id = $1',
      [id]
    );

    if (!exists.rows[0]) {
      return res.status(404).json({ error: 'Такъв разход не е намерен' });
    }

    // Строим UPDATE динамично
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (date !== undefined) {
      updates.push(`date = $${paramIndex}`);
      values.push(date);
      paramIndex++;
    }

    if (amount !== undefined) {
      updates.push(`amount = $${paramIndex}`);
      values.push(amountNum);
      paramIndex++;
    }

    if (type !== undefined) {
      updates.push(`type = $${paramIndex}`);
      values.push(type);
      paramIndex++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(description || null);
      paramIndex++;
    }

    values.push(id);

    const result = await pool.query(`
      UPDATE expenses
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, date, amount, type, description, created_at
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

    res.json({
      message: 'Разходът е изтрит',
      deleted: result.rows[0]
    });

  } catch (error) {
    console.error('Грешка при изтриване на разхода:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});

export default router;