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

        // Общо дължимо за периода
        total_unpaid: amountDue.toFixed(2),
        monthly_fee: monthlyFee.toFixed(2),
      },
    });

  } catch (error) {
    console.error('Грешка при генериране на бележка:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});
// GET /api/reports/monthly?month=YYYY-MM – общ отчет за месец (К1 и К2)
router.get('/monthly', requireAuth, requireAdmin, async (req, res) => {
  const { month } = req.query;

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Невалиден формат на месеца. Трябва да е ГГГГ-ММ' });
  }

  try {
    // 1. Вземаме началните салда и start_month
    const settingsRes = await pool.query(
      "SELECT name, value FROM block_params WHERE name IN ('start_month', 'opening_balance_k1', 'opening_balance_k2')"
    );
    const settings = {};
    settingsRes.rows.forEach(r => { settings[r.name] = r.value; });

    const startMonth = settings.start_month;
    const openingBalanceK1 = parseFloat(settings.opening_balance_k1) || 0;
    const openingBalanceK2 = parseFloat(settings.opening_balance_k2) || 0;

    // 2. Статистика за апартаментите (за месеца)
    const statsRes = await pool.query(`
      SELECT 
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'paid')::int AS paid,
        COUNT(*) FILTER (WHERE status = 'unpaid')::int AS unpaid
      FROM monthly_charges
      WHERE month = $1
    `, [month]);
    const stats = statsRes.rows[0];

    // 3. Месечни такси (приходи) за месеца (само платени)
    const monthlyRes = await pool.query(`
      SELECT 
        SUM(elevator_fee)::numeric AS elevator_fee,
        SUM(elevator_power)::numeric AS elevator_power,
        SUM(general_power)::numeric AS general_power,
        SUM(fund_ro)::numeric AS fund_ro,
        SUM(intercom)::numeric AS intercom,
        SUM(manager_fee)::numeric AS manager_fee,
        SUM(total_amount)::numeric AS total
      FROM monthly_charges
      WHERE month = $1 AND status = 'paid'
    `, [month]);
    const m = monthlyRes.rows[0];

    // Приходи К1 (без фонд Р.О.)
    const k1Income = {
      elevator_fee: parseFloat(m.elevator_fee) || 0,
      elevator_power: parseFloat(m.elevator_power) || 0,
      general_power: parseFloat(m.general_power) || 0,
      intercom: parseFloat(m.intercom) || 0,
      manager_fee: parseFloat(m.manager_fee) || 0,
    };
    k1Income.total = k1Income.elevator_fee + k1Income.elevator_power + k1Income.general_power + k1Income.intercom + k1Income.manager_fee;

    // Приходи К2 (само фонд Р.О. от месечните такси)
    const k2IncomeFund = parseFloat(m.fund_ro) || 0;

    // 4. Други приходи (other плащания) за месеца
    const otherRes = await pool.query(`
      SELECT SUM(amount)::numeric AS total
      FROM payments
      WHERE type = 'other' AND status = 'paid' AND month = $1
    `, [month]);
    const otherIncome = parseFloat(otherRes.rows[0]?.total) || 0;

    // Обикновено other отиват в К2 (ремонти), но ако имаш логика за К1, може да се раздели
    const k2IncomeOther = otherIncome;

    // 5. Ръчни приходи (наеми и др.) за месеца – отиват в К2
    const manualRes = await pool.query(`
      SELECT SUM(amount)::numeric AS total
      FROM manual_incomes
      WHERE month = $1
    `, [month]);
    const manualIncome = parseFloat(manualRes.rows[0]?.total) || 0;

    // 6. Разходи за месеца (разделени по каси)
    const expensesRes = await pool.query(`
      SELECT cash_box, category, SUM(amount)::numeric AS total
      FROM expenses
      WHERE to_char(date, 'YYYY-MM') = $1
      GROUP BY cash_box, category
    `, [month]);

    const expensesK1 = {};
    const expensesK2 = {};
    let totalExpensesK1 = 0;
    let totalExpensesK2 = 0;

    expensesRes.rows.forEach(r => {
      const amount = parseFloat(r.total);
      if (r.cash_box === 'K1') {
        expensesK1[r.category] = (expensesK1[r.category] || 0) + amount;
        totalExpensesK1 += amount;
      } else {
        expensesK2[r.category] = (expensesK2[r.category] || 0) + amount;
        totalExpensesK2 += amount;
      }
    });

    // 7. Изчисляване на салда от предходния месец (за всяка каса)
    const [yearStr, monthStr] = month.split('-');
    let prevYear = parseInt(yearStr, 10);
    let prevMonthNum = parseInt(monthStr, 10) - 1;
    if (prevMonthNum === 0) {
      prevMonthNum = 12;
      prevYear -= 1;
    }
    const prevMonthStr = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}`;

    let prevBalanceK1 = openingBalanceK1;
    let prevBalanceK2 = openingBalanceK2;

    if (prevMonthStr >= startMonth) {
      // Приходи К1 от началото до предходния месец
      const prevMonthlyRes = await pool.query(`
        SELECT 
          SUM(elevator_fee + elevator_power + general_power + intercom + manager_fee)::numeric AS k1_income,
          SUM(fund_ro)::numeric AS k2_income
        FROM monthly_charges
        WHERE month >= $1 AND month <= $2 AND status = 'paid'
      `, [startMonth, prevMonthStr]);

      const prevK1Income = parseFloat(prevMonthlyRes.rows[0]?.k1_income) || 0;
      const prevK2Income = parseFloat(prevMonthlyRes.rows[0]?.k2_income) || 0;

      // Other приходи до предходния месец
      const prevOtherRes = await pool.query(`
        SELECT SUM(amount)::numeric AS total
        FROM payments
        WHERE type = 'other' AND status = 'paid' AND month >= $1 AND month <= $2
      `, [startMonth, prevMonthStr]);
      const prevOtherIncome = parseFloat(prevOtherRes.rows[0]?.total) || 0;

      // Ръчни приходи до предходния месец
      const prevManualRes = await pool.query(`
        SELECT SUM(amount)::numeric AS total
        FROM manual_incomes
        WHERE month >= $1 AND month <= $2
      `, [startMonth, prevMonthStr]);
      const prevManualIncome = parseFloat(prevManualRes.rows[0]?.total) || 0;

      // Разходи до предходния месец
      const prevExpensesRes = await pool.query(`
        SELECT cash_box, SUM(amount)::numeric AS total
        FROM expenses
        WHERE to_char(date, 'YYYY-MM') >= $1 AND to_char(date, 'YYYY-MM') <= $2
        GROUP BY cash_box
      `, [startMonth, prevMonthStr]);

      let prevExpK1 = 0;
      let prevExpK2 = 0;
      prevExpensesRes.rows.forEach(r => {
        if (r.cash_box === 'K1') prevExpK1 = parseFloat(r.total);
        else prevExpK2 = parseFloat(r.total);
      });

      prevBalanceK1 = openingBalanceK1 + prevK1Income - prevExpK1;
      prevBalanceK2 = openingBalanceK2 + prevK2Income + prevOtherIncome + prevManualIncome - prevExpK2;
    }

    // 8. Текущи салда
    const currentBalanceK1 = prevBalanceK1 + k1Income.total - totalExpensesK1;
    const currentBalanceK2 = prevBalanceK2 + k2IncomeFund + k2IncomeOther + manualIncome - totalExpensesK2;

    // 9. Неплатени (за информация)
    const unpaidRes = await pool.query(`
      SELECT 
        SUM(total_amount)::numeric AS monthly,
        (SELECT SUM(amount) FROM payments WHERE type = 'other' AND status = 'unpaid' AND month = $1)::numeric AS other
      FROM monthly_charges
      WHERE month = $1 AND status = 'unpaid'
    `, [month]);
    const unpaidMonthly = parseFloat(unpaidRes.rows[0]?.monthly) || 0;
    const unpaidOther = parseFloat(unpaidRes.rows[0]?.other) || 0;

    // 10. Форматиране на отговора
    res.json({
      month,
      start_month: startMonth,
      stats: {
        total: stats.total,
        paid: stats.paid,
        unpaid: stats.unpaid,
      },
      k1: {
        prev_balance: prevBalanceK1.toFixed(2),
        income: {
          elevator_fee: k1Income.elevator_fee.toFixed(2),
          elevator_power: k1Income.elevator_power.toFixed(2),
          general_power: k1Income.general_power.toFixed(2),
          intercom: k1Income.intercom.toFixed(2),
          manager_fee: k1Income.manager_fee.toFixed(2),
          total: k1Income.total.toFixed(2),
        },
        expenses: {
          by_category: expensesK1,
          total: totalExpensesK1.toFixed(2),
        },
        balance: currentBalanceK1.toFixed(2),
      },
      k2: {
        prev_balance: prevBalanceK2.toFixed(2),
        income: {
          fund_ro: k2IncomeFund.toFixed(2),
          other: k2IncomeOther.toFixed(2),
          manual: manualIncome.toFixed(2),
          total: (k2IncomeFund + k2IncomeOther + manualIncome).toFixed(2),
        },
        expenses: {
          by_category: expensesK2,
          total: totalExpensesK2.toFixed(2),
        },
        balance: currentBalanceK2.toFixed(2),
      },
      unpaid: {
        monthly: unpaidMonthly.toFixed(2),
        other: unpaidOther.toFixed(2),
        total: (unpaidMonthly + unpaidOther).toFixed(2),
      }
    });

  } catch (error) {
    console.error('Грешка при месечен отчет:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});
export default router;