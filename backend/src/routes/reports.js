// backend/src/routes/reports.js
import express from 'express';
import pool from '../db.js';
import { requireAuth, requireAdmin } from '../jwt.js';

const router = express.Router();

// GET /api/reports/apartment/:number – индивидуална бележка
router.get('/apartment/:number', requireAuth, requireAdmin, async (req, res) => {
  const number = parseInt(req.params.number, 10);

  if (!number || number < 1 || number > 90) {
    return res.status(400).json({ error: 'Невалиден номер на апартамент (1-90)' });
  }

  try {
    // 1. Намери апартамента
    const aptResult = await pool.query(
      'SELECT id, number, floor, owner_name, phone FROM apartments WHERE number = $1',
      [number]
    );

    if (!aptResult.rows[0]) {
      return res.status(404).json({ error: 'Апартаментът не е намерен' });
    }

    const apartment = aptResult.rows[0];

    // 2. Вземи start_month и monthly_fee от block_params
    const settingsResult = await pool.query(
      "SELECT name, value FROM block_params WHERE name IN ('start_month', 'monthly_fee')"
    );

    const settings = {};
    settingsResult.rows.forEach(r => {
      settings[r.name] = r.value;
    });

    const startMonth = settings.start_month;
    const monthlyFee = parseFloat(settings.monthly_fee) || 7;

    // 3. Определи периода
    const now = new Date();
    let currentYear = now.getFullYear();
    let currentMonth = now.getMonth() + 1 - 1;  // ← предишен месец

    if (currentMonth === 0) {
      currentMonth = 12;
      currentYear -= 1;
    }

    const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    const from = req.query.from || startMonth || currentMonthStr;
    const to = req.query.to || currentMonthStr;

    // 4. Вземи плащанията за периода
    const paymentsResult = await pool.query(`
      SELECT id, month, amount, type, description, status, confirmed_at
      FROM payments
      WHERE ap_id = $1 AND month >= $2 AND month <= $3
      ORDER BY month DESC
    `, [apartment.id, from, to]);

    const payments = paymentsResult.rows;

    // 5. Изчисли summary

    // 5.1. Платени месечни (за общата платена сума)
    const paidMonthly = payments.filter(p => p.type === 'monthly' && p.status === 'paid');
    const totalPaid = paidMonthly.reduce((sum, p) => sum + parseFloat(p.amount), 0);

    // 5.2. Частично неплатени месечни
    const partialMonthly = payments.filter(p => p.type === 'monthly' && p.status === 'partial');
    const partialMonthlySum = partialMonthly.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const partialMonthlyDue = partialMonthly.length * monthlyFee - partialMonthlySum;

    // 5.3. Неплатени доп. разходи (type = 'other')
    const unpaidOther = payments.filter(p => p.type === 'other' && p.status === 'unpaid');
    const unpaidOtherSum = unpaidOther.reduce((sum, p) => sum + parseFloat(p.amount), 0);

    // 5.4. Генерирай всички месеци в диапазона
    const dueMonths = [];
    let [year, month] = from.split('-').map(Number);
    const [toYear, toMonth] = to.split('-').map(Number);

    while (year < toYear || (year === toYear && month <= toMonth)) {
      dueMonths.push(`${year}-${String(month).padStart(2, '0')}`);
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }

    // 5.5. Месеци с paid или partial → не са напълно неплатени
    const paidOrPartialSet = new Set(
      payments
        .filter(p => p.type === 'monthly' && (p.status === 'paid' || p.status === 'partial'))
        .map(p => p.month)
    );

    const unpaidMonths = dueMonths.filter(m => !paidOrPartialSet.has(m));
    const unpaidMonthsDue = unpaidMonths.length * monthlyFee;

    // 5.6. Общо дължимо
    const amountDue = unpaidMonthsDue + partialMonthlyDue + unpaidOtherSum;

    res.json({
      apartment: {
        number: apartment.number,
        floor: apartment.floor,
        owner_name: apartment.owner_name,
        phone: apartment.phone,
      },
      period: { from, to },
      payments,
      summary: {
        // Платени месечни (само monthly + paid)
        paid_monthly: paidMonthly.length,
        paid_monthly_sum: totalPaid.toFixed(2),

        // Неплатени месечни (monthly + unpaid)
        unpaid_months: unpaidMonths.length,
        unpaid_months_due: unpaidMonthsDue.toFixed(2),

        // Частично неплатени (monthly + partial)
        partial_months: partialMonthly.length,
        partial_months_due: partialMonthlyDue.toFixed(2),

        // Неплатени доп. разходи (other + unpaid)
        unpaid_other: unpaidOther.length,
        unpaid_other_due: unpaidOtherSum.toFixed(2),

        // Общо дължимо
        amount_due: amountDue.toFixed(2),
        monthly_fee: monthlyFee.toFixed(2),
      },
    });

  } catch (error) {
    console.error('Грешка при генериране на бележка:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});
// GET /api/reports/monthly?month=YYYY-MM – общ отчет за месец
router.get('/monthly', requireAuth, requireAdmin, async (req, res) => {
  const { month } = req.query;

  if (!month) {
    return res.status(400).json({ error: 'Липсва параметър month (YYYY-MM)' });
  }

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Невалиден формат на месеца. Трябва да е ГГГГ-ММ' });
  }

  try {
    // 1. Вземи настройките
    const settingsResult = await pool.query(
      "SELECT name, value FROM block_params WHERE name IN ('monthly_fee', 'manager_fee', 'start_month')"
    );

    const settings = {};
    settingsResult.rows.forEach(r => {
      settings[r.name] = r.value;
    });

    const monthlyFee = parseFloat(settings.monthly_fee) || 7;
    const managerFee = parseFloat(settings.manager_fee) || 3;
    const startMonth = settings.start_month;

    // 2. Общ брой апартаменти
    const aptCountResult = await pool.query('SELECT COUNT(*)::int AS count FROM apartments');
    const totalApartments = aptCountResult.rows[0].count;

    // 3. Приходи за този месец (по тип)
    const incomeResult = await pool.query(`
      SELECT type, status, SUM(amount)::numeric AS total, COUNT(*)::int AS count
      FROM payments
      WHERE month = $1
      GROUP BY type, status
    `, [month]);

    // 4. Колко апартамента са платили месечна такса за този месец
    const paidMonthlyResult = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM payments
      WHERE month = $1 AND type = 'monthly' AND status = 'paid'
    `, [month]);

    const paidMonthly = paidMonthlyResult.rows[0].count;
    const unpaidMonthly = totalApartments - paidMonthly;

    // 5. Общо неплатени месечни такси (от start_month до този месец)
    // За всеки месец от start_month до month:
    // - брой дължими = 90
    // - брой платени = колко апартамента имат paid monthly за този месец
    // - неплатени = 90 - платени
    let totalUnpaidMonths = 0;

    if (startMonth && startMonth <= month) {
      const monthsRange = [];
      let [y, m] = startMonth.split('-').map(Number);
      const [toY, toM] = month.split('-').map(Number);

      while (y < toY || (y === toY && m <= toM)) {
        monthsRange.push(`${y}-${String(m).padStart(2, '0')}`);
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
      }

      // Вземи колко платени месечни такси има за всеки месец
      const paidPerMonthResult = await pool.query(`
        SELECT month, COUNT(*)::int AS count
        FROM payments
        WHERE type = 'monthly' AND status = 'paid' AND month = ANY($1)
        GROUP BY month
      `, [monthsRange]);

      const paidMap = {};
      paidPerMonthResult.rows.forEach(r => {
        paidMap[r.month] = r.count;
      });

      monthsRange.forEach(m => {
        const paid = paidMap[m] || 0;
        totalUnpaidMonths += (totalApartments - paid);
      });
    }

    const amountDue = totalUnpaidMonths * monthlyFee;

    // 6. Приходи – групирай
    const incomeByType = {};
    incomeResult.rows.forEach(r => {
      if (!incomeByType[r.type]) {
        incomeByType[r.type] = {
          paid_total: 0,
          unpaid_total: 0,
          partial_total: 0,
          count_paid: 0,
        };
      }
      incomeByType[r.type][`${r.status}_total`] = parseFloat(r.total);
      if (r.status === 'paid') {
        incomeByType[r.type].count_paid = r.count;
      }
    });

    // 7. Общ приход
    const totalIncome = incomeResult.rows
      .filter(r => r.status === 'paid')
      .reduce((sum, r) => sum + parseFloat(r.total), 0);

    // 8. Разпределение
    // За домоуправителя: managerFee × брой платени месечни такси
    const managerPay = paidMonthly * managerFee;

    // В касата на блока: (monthlyFee - managerFee) × брой платени месечни такси + доп. плащания
    const monthlyToFund = paidMonthly * (monthlyFee - managerFee);
    const additionalIncome = incomeResult.rows
      .filter(r => r.type !== 'monthly' && r.status === 'paid')
      .reduce((sum, r) => sum + parseFloat(r.total), 0);
    const toFund = monthlyToFund + additionalIncome;

    // 9. Разходи за този месец
    const expensesResult = await pool.query(`
      SELECT type, SUM(amount)::numeric AS total, COUNT(*)::int AS count
      FROM expenses
      WHERE to_char(date, 'YYYY-MM') = $1
      GROUP BY type
    `, [month]);

    const expensesByType = expensesResult.rows.map(r => ({
      type: r.type,
      total: parseFloat(r.total).toFixed(2),
      count: r.count,
    }));

    const totalExpenses = expensesResult.rows
      .reduce((sum, r) => sum + parseFloat(r.total), 0);

    // 10. Баланс
    // Приходи в касата - разходи
    const balance = toFund - totalExpenses;

    res.json({
      month,
      total_apartments: totalApartments,
      paid_monthly: paidMonthly,
      unpaid_monthly: unpaidMonthly,
      unpaid_months_total: totalUnpaidMonths,
      amount_due: amountDue.toFixed(2),
      monthly_fee: monthlyFee.toFixed(2),
      manager_fee: managerFee.toFixed(2),
      income: {
        by_type: incomeByType,
        total_paid: totalIncome.toFixed(2),
        monthly_total: (incomeByType.monthly?.paid_total || 0).toFixed(2),
        additional_total: additionalIncome.toFixed(2),
      },
      manager_pay: managerPay.toFixed(2),
      to_fund: toFund.toFixed(2),
      expenses: {
        by_type: expensesByType,
        total: totalExpenses.toFixed(2),
      },
      balance: balance.toFixed(2),
    });

  } catch (error) {
    console.error('Грешка при генериране на месечен отчет:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});
export default router;