// backend/src/routes/settings.js
import express from 'express';
import pool from '../db.js';
import { requireAuth } from '../jwt.js';

const router = express.Router();

// GET /api/settings – връща настройките на блока
// Достъпно за всички логнати (админ и жилец)
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT name, value FROM block_params');

    const settings = {};
    for (const row of result.rows) {
      if (row.name === 'start_month') {
        settings[row.name] = row.value;
      } else {
        settings[row.name] = parseFloat(row.value);
      }
    }
    res.json(settings);
  } catch (error) {
    console.error('Грешка при взимане на настройки:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});
// PUT /api/settings – обновяване на цените (само за админ)
router.put('/', requireAuth, async (req, res) => {
  try {
    const {
      elevator_fee_rate, elevator_power_rate, general_power_rate,
      fund_ro_rate, intercom_rate, manager_fee_rate, opening_balance,
      opening_balance_k1, opening_balance_k2
    } = req.body;

    // 1. Ако е подадено САМО салдо (K1 или K2), записваме го и излизаме
    const keys = Object.keys(req.body);
    const isOnlyBalance = keys.length === 1 && (
      keys[0] === 'opening_balance' ||
      keys[0] === 'opening_balance_k1' ||
      keys[0] === 'opening_balance_k2'
    );

    if (isOnlyBalance) {
      const field = keys[0];
      const value = req.body[field];
      await pool.query(
        `INSERT INTO block_params (name, value) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value`,
        [field, String(value)]
      );
      return res.json({ message: 'Началното салдо е запазено' });
    }

    // 2. Иначе проверяваме за таксите
    if (
      elevator_fee_rate === undefined || elevator_power_rate === undefined ||
      general_power_rate === undefined || fund_ro_rate === undefined ||
      intercom_rate === undefined || manager_fee_rate === undefined
    ) {
      return res.status(400).json({ error: 'Липсват стойности за някои от таксите' });
    }

    // 3. Обновяваме таксите (и салдата, ако са подадени заедно с тях)
    const updates = [
      ['elevator_fee_rate', elevator_fee_rate],
      ['elevator_power_rate', elevator_power_rate],
      ['general_power_rate', general_power_rate],
      ['fund_ro_rate', fund_ro_rate],
      ['intercom_rate', intercom_rate],
      ['manager_fee_rate', manager_fee_rate],
    ];
    if (opening_balance !== undefined) {
      updates.push(['opening_balance', opening_balance]);
    }
    if (opening_balance_k1 !== undefined) {
      updates.push(['opening_balance_k1', opening_balance_k1]);
    }
    if (opening_balance_k2 !== undefined) {
      updates.push(['opening_balance_k2', opening_balance_k2]);
    }

    for (const [name, value] of updates) {
      await pool.query(
        `INSERT INTO block_params (name, value) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value`,
        [name, String(value)]
      );
    }

    res.json({ message: 'Настройките са запазени успешно' });
  } catch (error) {
    console.error('Грешка при запис на настройки:', error);
    res.status(500).json({ error: 'Сървърна грешка при запис на настройки' });
  }
});
export default router;