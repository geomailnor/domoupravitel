// backend/src/routes/settings.js
import express from 'express';
import pool from '../db.js';
import { requireAuth } from '../jwt.js';

const router = express.Router();

// GET /api/settings – връща настройките на блока
// Достъпно за всички логнати (админ и жилец)
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT name, value FROM block_params WHERE name IN ($1, $2, $3)',
      ['monthly_fee', 'manager_fee', 'start_month']
    );

    const settings = {};
    for (const row of result.rows) {
      settings[row.name] = row.name === 'start_month'
        ? row.value
        : parseFloat(row.value);
    }

    // Автоматично превключване на start_month на 1 януари новата година
    if (settings.start_month) {
      const currentYear = new Date().getFullYear();
      const startYear = parseInt(settings.start_month.split('-')[0], 10);

      if (startYear < currentYear) {
        const newStartMonth = `${currentYear}-01`;

        // Запиши в базата
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

export default router;