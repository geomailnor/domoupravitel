// backend/src/routes/manualIncomes.js
import express from 'express';
import pool from '../db.js';
import { requireAuth, requireAdmin } from '../jwt.js';

const router = express.Router();

// Помощна функция за проверка на месеца (същата като в payments.js)
function isMonthInvalid(month) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

  if (month < currentMonthStr) {
    return 'Не може да се добавят приходи за минал месец.';
  }

  let maxYear = currentYear;
  let maxMonth = currentMonth + 3;
  if (maxMonth > 12) {
    maxMonth -= 12;
    maxYear += 1;
  }
  const maxMonthStr = `${maxYear}-${String(maxMonth).padStart(2, '0')}`;

  if (month > maxMonthStr) {
    return 'Не може да се добавят приходи за повече от 3 месеца напред.';
  }

  return null;
}

// GET /api/manual-incomes – списък с ръчни приходи (само админ)
// Филтри: ?month=YYYY-MM  ?category=rent|other
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const { month, category } = req.query;

  try {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ error: 'Невалиден формат за месец. Трябва да е YYYY-MM' });
      }
      conditions.push(`month = $${paramIndex}`);
      values.push(month);
      paramIndex++;
    }

    if (category) {
      const allowed = ['rent', 'other'];
      if (!allowed.includes(category)) {
        return res.status(400).json({ error: `Невалидна категория. Позволени: ${allowed.join(', ')}` });
      }
      conditions.push(`category = $${paramIndex}`);
      values.push(category);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT id, month, amount, category, description, created_at
      FROM manual_incomes
      ${whereClause}
      ORDER BY month DESC, created_at DESC
    `, values);

    res.json(result.rows);
  } catch (error) {
    console.error('Грешка при зареждане на ръчни приходи:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});

// POST /api/manual-incomes – създава нов ръчен приход (само админ)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { month, amount, category, description } = req.body;

  if (!month || amount == null || !category) {
    return res.status(400).json({ error: 'Липсват задължителни полета: month, amount, category' });
  }

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Невалиден формат за месец. Трябва да е YYYY-MM' });
  }

  // НОВО: Проверка за минал месец или твърде далечно бъдеще
  const monthError = isMonthInvalid(month);
  if (monthError) {
    return res.status(400).json({ error: monthError });
  }

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return res.status(400).json({ error: 'Невалидна сума' });
  }

  const allowedCategories = ['rent', 'other'];
  if (!allowedCategories.includes(category)) {
    return res.status(400).json({ error: `Невалидна категория. Позволени: ${allowedCategories.join(', ')}` });
  }

  try {
    const result = await pool.query(`
      INSERT INTO manual_incomes (month, amount, category, description)
      VALUES ($1, $2, $3, $4)
      RETURNING id, month, amount, category, description, created_at
    `, [month, amountNum, category, description || null]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Грешка при създаване на ръчен приход:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});

// PUT /api/manual-incomes/:id – обновява ръчен приход (само админ)
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || id < 1) {
    return res.status(400).json({ error: 'Невалиден id' });
  }

  const { month, amount, category, description } = req.body;

  if (month === undefined && amount === undefined && category === undefined && description === undefined) {
    return res.status(400).json({ error: 'Поне едно поле трябва да е подадено' });
  }

  if (month !== undefined) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Невалиден формат за месец. Трябва да е YYYY-MM' });
    }
    // НОВО: Проверка за минал месец или твърде далечно бъдеще
    const monthError = isMonthInvalid(month);
    if (monthError) {
      return res.status(400).json({ error: monthError });
    }
  }

  let amountNum;
  if (amount !== undefined) {
    amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'Невалидна сума' });
    }
  }

  if (category !== undefined) {
    const allowedCategories = ['rent', 'other'];
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({ error: `Невалидна категория. Позволени: ${allowedCategories.join(', ')}` });
    }
  }

  try {
    const exists = await pool.query('SELECT id FROM manual_incomes WHERE id = $1', [id]);
    if (!exists.rows[0]) {
      return res.status(404).json({ error: 'Такъв приход не е намерен' });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (month !== undefined) { updates.push(`month = $${paramIndex}`); values.push(month); paramIndex++; }
    if (amount !== undefined) { updates.push(`amount = $${paramIndex}`); values.push(amountNum); paramIndex++; }
    if (category !== undefined) { updates.push(`category = $${paramIndex}`); values.push(category); paramIndex++; }
    if (description !== undefined) { updates.push(`description = $${paramIndex}`); values.push(description || null); paramIndex++; }

    values.push(id);

    const result = await pool.query(`
      UPDATE manual_incomes
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, month, amount, category, description, created_at
    `, values);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Грешка при обновяване на ръчен приход:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});

// DELETE /api/manual-incomes/:id – изтрива ръчен приход (само админ)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || id < 1) {
    return res.status(400).json({ error: 'Невалиден id' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM manual_incomes WHERE id = $1 RETURNING id, month, amount, category',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Такъв приход не е намерен. Нищо не е изтрито!' });
    }

    res.json({ message: 'Приходът е изтрит', deleted: result.rows[0] });
  } catch (error) {
    console.error('Грешка при изтриване на ръчен приход:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});

export default router;