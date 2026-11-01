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

    // Автоматично превключване на start_month на 1 януари новата година
    if (settings.start_month) {
      const currentYear = new Date().getFullYear();
      const startYear = parseInt(settings.start_month.split('-')[0], 10);

      if (startYear < currentYear) {
        const newStartMonth = `${currentYear}-01`;
        await pool.query(
          'UPDATE block_params SET value = $1 WHERE name = $2',
          [newStartMonth, 'start_month']
        );
        settings.start_month = newStartMonth;
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
      fund_ro_rate, intercom_rate, manager_fee_rate, opening_balance
    } = req.body;

    // 1. Ако е подаден САМО opening_balance, записваме го и излизаме
    if (opening_balance !== undefined && Object.keys(req.body).length === 1) {
      await pool.query(
        `INSERT INTO block_params (name, value) VALUES ('opening_balance', $1)
         ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value`,
        [String(opening_balance)]
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

    // 3. Обновяваме таксите (и opening_balance, ако е подаден заедно с тях)
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