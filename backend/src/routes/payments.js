// backend/src/routes/payments.js
import express from 'express';
import pool from '../db.js';
import { requireAuth, requireAdmin } from '../jwt.js';

const router = express.Router();

// GET /api/payments – списък с плащания (само админ)
// Филтри: ?month=  ?apartment_number=  ?status=
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const { month, apartment_number, status } = req.query;

  try {
    // Строим заявката постепенно
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (month) {
      conditions.push(`p.month = $${paramIndex}`);
      values.push(month);
      paramIndex++;
    }

    if (apartment_number) {
      const aptNum = parseInt(apartment_number, 10);
      if (!aptNum || aptNum < 1 || aptNum > 90) {
        return res.status(400).json({ error: 'Невалиден номер на апартамент (1-90)' });
      }
      conditions.push(`a.number = $${paramIndex}`);
      values.push(aptNum);
      paramIndex++;
    }
    if (status) {
      const allowedStatuses = ['paid', 'unpaid', 'partial'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          error: `Невалиден статус. Позволени: ${allowedStatuses.join(', ')}`
        });
      }
      conditions.push(`p.status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }
    // Ако има филтри → добавяме WHERE
    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const result = await pool.query(`
      SELECT
        p.id,
        p.ap_id,
        a.number AS apartment_number,
        a.owner_name,
        p.month,
        p.amount,
        p.type,
        p.description,
        p.status,
        p.confirmed_at,
        p.created_at
      FROM payments p
      JOIN apartments a ON a.id = p.ap_id
      ${whereClause}
      ORDER BY p.month DESC, a.number ASC, p.created_at DESC
    `, values);

    res.json(result.rows);
  } catch (error) {
    console.error('Грешка при взимане на плащания:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});

// GET /api/payments/me – собствените плащания на логнатия (жилец или админ)
router.get('/me', requireAuth, async (req, res) => {
  let apartmentId;

  if (req.user.role === 'resident') {
    apartmentId = req.user.id;
  } else if (req.user.role === 'admin') {
    const adminResult = await pool.query(
      'SELECT apartment_id FROM admins WHERE id = $1',
      [req.user.id]
    );

    apartmentId = adminResult.rows[0]?.apartment_id;

    if (!apartmentId) {
      return res.status(404).json({
        error: 'Не е намерен апартаментът на домоуправителя!'
      });
    }
  } else {
    return res.status(403).json({ error: 'Грешка! Трябва admin или resident.' });
  }

  try {
    const result = await pool.query(`
      SELECT
        p.id,
        p.ap_id,
        a.number AS apartment_number,
        p.month,
        p.amount,
        p.type,
        p.description,
        p.status,
        p.confirmed_at,
        p.created_at
      FROM payments p
      JOIN apartments a ON a.id = p.ap_id
      WHERE p.ap_id = $1
      ORDER BY p.month DESC, p.created_at DESC
    `, [apartmentId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Грешка при зареждане на моите плащания:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});

// POST /api/payments – създава ново плащане (само админ)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { apartment_number, month, amount, type, description, status } = req.body;

  // 1. Проверка за задължителни полета
  if (
    apartment_number == null ||
    !month ||
    amount == null ||
    !type
  ) {
    return res.status(400).json({
      error: 'Липсват задължителни полета: apartment_number, month, amount, type'
    });
  }

  // 2. Валидация на apartment_number
  const aptNum = parseInt(apartment_number, 10);
  if (!aptNum || aptNum < 1 || aptNum > 90) {
    return res.status(400).json({ error: 'Невалиден номер на апартамент (1-90)' });
  }

  // 3. Валидация на month (YYYY-MM)
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({
      error: 'Невалиден формат на месеца. Трябва да е ГГГГ-ММ (напр. 2025-01)'
    });
  }

  const [yearStr, monthStr] = month.split('-');
  const yearNum = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);

  if (monthNum < 1 || monthNum > 12) {
    return res.status(400).json({ error: 'Невалиден месец (трябва да е 01-12)' });
  }
  if (yearNum < 2020 || yearNum > 2100) {
    return res.status(400).json({ error: 'Невалидна година (2020-2100)' });
  }

  // 4. Валидация на status
  const finalStatus = status || 'unpaid';
  const allowedStatuses = ['paid', 'unpaid', 'partial'];
  if (!allowedStatuses.includes(finalStatus)) {
    return res.status(400).json({
      error: `Невалиден статус. Позволени: ${allowedStatuses.join(', ')}`
    });
  }

  // 5. Валидация на amount (зависи от status)
  const amountNum = parseFloat(amount);
  if (finalStatus === 'unpaid') {
    if (isNaN(amountNum) || amountNum < 0) {
      return res.status(400).json({ error: 'Невалидна сума' });
    }
  } else {
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'Невалидна сума' });
    }
  }

  // 6. Валидация на type
  const allowedTypes = ['monthly', 'elevator', 'water', 'cleaning', 'door', 'intercom', 'electricity', 'other'];
  if (!allowedTypes.includes(type)) {
    return res.status(400).json({
      error: `Невалиден вид. Позволени: ${allowedTypes.join(', ')}`
    });
  }

  // 7. confirmed_at при 'paid'
  const confirmedAt = finalStatus === 'paid' ? new Date() : null;

  try {
    // 8. Намери реалното id на апартамента по номера
    const aptResult = await pool.query(
      'SELECT id FROM apartments WHERE number = $1',
      [aptNum]
    );

    if (!aptResult.rows[0]) {
      return res.status(404).json({ error: 'Такъв апартамент не е намерен' });
    }

    const realApId = aptResult.rows[0].id;

    // 9. Вмъкни плащането
    const insertResult = await pool.query(`
      INSERT INTO payments (ap_id, month, amount, type, description, status, confirmed_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      realApId,
      month,
      amountNum,
      type,
      description || null,
      finalStatus,
      confirmedAt
    ]);

    const newId = insertResult.rows[0].id;

    // 10. Върни пълните данни
    const fullResult = await pool.query(`
      SELECT
        p.id,
        p.ap_id,
        a.number AS apartment_number,
        a.owner_name,
        p.month,
        p.amount,
        p.type,
        p.description,
        p.status,
        p.confirmed_at,
        p.created_at
      FROM payments p
      JOIN apartments a ON a.id = p.ap_id
      WHERE p.id = $1
    `, [newId]);

    res.status(201).json(fullResult.rows[0]);

  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({
        error: 'Вече има плащане от този вид за този месец'
      });
    }
    console.error('Грешка при създаване на плащане:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});

// PUT /api/payments/:id – обновява плащане (само админ)
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || id < 1) {
    return res.status(400).json({ error: 'Невалиден id' });
  }

  const { status, amount, description, month, type } = req.body;

  // Поне едно поле трябва да е подадено
  if (status === undefined && amount === undefined && description === undefined) {
    return res.status(400).json({
      error: 'Поне едно поле трябва да е подадено (status, amount, description)'
    });
  }

  // Валидация на status, ако е подаден
  const allowedStatuses = ['paid', 'unpaid', 'partial'];
  if (status !== undefined && !allowedStatuses.includes(status)) {
    return res.status(400).json({
      error: `Невалиден статус. Позволени: ${allowedStatuses.join(', ')}`
    });
  }

  // Валидация на amount, ако е подадено
  let amountNum;
  if (amount !== undefined) {
    amountNum = parseFloat(amount);
    const checkStatus = status !== undefined ? status : 'paid';  // ако няма status, приемаме 'paid' за проверка

    if (checkStatus === 'unpaid') {
      if (isNaN(amountNum) || amountNum < 0) {
        return res.status(400).json({ error: 'Невалидна сума' });
      }
    } else {
      if (isNaN(amountNum) || amountNum <= 0) {
        return res.status(400).json({ error: 'Невалидна сума' });
      }
    }
  }

  try {
    // Провери дали плащането съществува
    const exists = await pool.query(
      'SELECT id, status FROM payments WHERE id = $1',
      [id]
    );

    if (!exists.rows[0]) {
      return res.status(404).json({ error: 'Такова плащане не е намерено' });
    }

    // Строим UPDATE динамично (само подадените полета)
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;

      // Обновяваме confirmed_at
      if (status === 'paid') {
        updates.push(`confirmed_at = $${paramIndex}`);
        values.push(new Date());
        paramIndex++;
      } else {
        updates.push(`confirmed_at = $${paramIndex}`);
        values.push(null);
        paramIndex++;
      }
    }

    if (amount !== undefined) {
      updates.push(`amount = $${paramIndex}`);
      values.push(amountNum);
      paramIndex++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(description || null);
      paramIndex++;
    }
    if (month !== undefined) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({
          error: 'Невалиден формат на месеца. Трябва да е ГГГГ-ММ'
        });
      }
      updates.push(`month = $${paramIndex}`);
      values.push(month);
      paramIndex++;
    }

    if (type !== undefined) {
      const allowedTypes = ['monthly', 'elevator', 'water', 'cleaning', 'door', 'intercom', 'electricity', 'other'];
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({
          error: `Невалиден type. Позволени: ${allowedTypes.join(', ')}`
        });
      }
      updates.push(`type = $${paramIndex}`);
      values.push(type);
      paramIndex++;
    }
    // Добавяме id за WHERE
    values.push(id);

    await pool.query(`
      UPDATE payments
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `, values);

    // Връщаме обновеното плащане с JOIN
    const fullResult = await pool.query(`
      SELECT
        p.id,
        p.ap_id,
        a.number AS apartment_number,
        a.owner_name,
        p.month,
        p.amount,
        p.type,
        p.description,
        p.status,
        p.confirmed_at,
        p.created_at
      FROM payments p
      JOIN apartments a ON a.id = p.ap_id
      WHERE p.id = $1
    `, [id]);

    res.json(fullResult.rows[0]);

  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({
        error: 'Вече има плащане от този вид за този месец'
      });
    }
    console.error('Грешка при обновяване на плащане:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});

// DELETE /api/payments/:id – изтрива плащане (само админ)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || id < 1) {
    return res.status(400).json({ error: 'Невалиден id' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM payments WHERE id = $1 RETURNING id, month, amount, type',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Такова плащане не е намерено. Нищо не е изтрито!' });
    }

    res.json({
      message: 'Плащането е изтрито',
      deleted: result.rows[0]
    });

  } catch (error) {
    console.error('Грешка при изтриване на плащане:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});
// POST /api/payments/bulk – създава много плащания наведнъж
router.post('/bulk', requireAuth, requireAdmin, async (req, res) => {
  const { payments } = req.body;

  if (!Array.isArray(payments) || payments.length === 0) {
    return res.status(400).json({ error: 'Липсва масив от плащания' });
  }

  if (payments.length > 90) {
    return res.status(400).json({ error: 'Максимум 90 плащания наведнъж' });
  }

  // Валидация на всяко плащане
  for (const p of payments) {
    if (!p.apartment_number || !p.month || p.amount == null || !p.type) {
      return res.status(400).json({
        error: 'Всяко плащане трябва да има apartment_number, month, amount, type'
      });
    }

    const aptNum = parseInt(p.apartment_number, 10);
    if (!aptNum || aptNum < 1 || aptNum > 90) {
      return res.status(400).json({ error: `Невалиден номер на апартамент: ${p.apartment_number}` });
    }

    if (!/^\d{4}-\d{2}$/.test(p.month)) {
      return res.status(400).json({ error: `Невалиден месец: ${p.month}` });
    }

    const amountNum = parseFloat(p.amount);
    const status = p.status || 'paid';

    if (status === 'unpaid') {
      if (isNaN(amountNum) || amountNum < 0) {
        return res.status(400).json({ error: `Невалидна сума за ап. ${aptNum}` });
      }
    } else {
      if (isNaN(amountNum) || amountNum <= 0) {
        return res.status(400).json({ error: `Невалидна сума за ап. ${aptNum}` });
      }
    }

    const allowedTypes = ['monthly', 'elevator', 'water', 'cleaning', 'door', 'intercom', 'electricity', 'other'];
    if (!allowedTypes.includes(p.type)) {
      return res.status(400).json({ error: `Невалиден вид за ап. ${aptNum}` });
    }
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const created = [];
    const skipped = [];

    for (const p of payments) {
      const aptNum = parseInt(p.apartment_number, 10);
      const status = p.status || 'paid';
      const amountNum = parseFloat(p.amount);
      const confirmedAt = status === 'paid' ? new Date() : null;

      // Намери id на апартамента
      const aptResult = await client.query(
        'SELECT id FROM apartments WHERE number = $1',
        [aptNum]
      );

      if (!aptResult.rows[0]) {
        skipped.push({ apartment_number: aptNum, reason: 'Апартаментът не е намерен' });
        continue;
      }

      const realApId = aptResult.rows[0].id;

      // Провери дали вече съществува (само за типове без 'other')
      if (p.type !== 'other') {
        const exists = await client.query(
          'SELECT id FROM payments WHERE ap_id = $1 AND month = $2 AND type = $3',
          [realApId, p.month, p.type]
        );

        if (exists.rows[0]) {
          await client.query('ROLLBACK');
          const months = {
            '01': 'Януари', '02': 'Февруари', '03': 'Март', '04': 'Април',
            '05': 'Май', '06': 'Юни', '07': 'Юли', '08': 'Август',
            '09': 'Септември', '10': 'Октомври', '11': 'Ноември', '12': 'Декември'
          };
          const [, monthNum] = p.month.split('-');
          const monthName = months[monthNum] || monthNum;
          return res.status(400).json({
            error: `Месец ${monthName} вече съществува за ап. ${aptNum}. Нищо не е добавено.`
          });
        }
      }

      // Вмъкни
      const insertResult = await client.query(`
    INSERT INTO payments (ap_id, month, amount, type, description, status, confirmed_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `, [
        realApId,
        p.month,
        amountNum,
        p.type,
        p.description || null,
        status,
        confirmedAt
      ]);

      created.push({
        apartment_number: aptNum,
        id: insertResult.rows[0].id
      });
    }

    await client.query('COMMIT');

    res.status(201).json({
      created: created.length,
      skipped: skipped.length,
      details: {
        created,
        skipped
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Грешка при bulk създаване:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  } finally {
    client.release();
  }
});
export default router;