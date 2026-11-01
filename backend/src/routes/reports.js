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
// GET /api/reports/monthly?month=YYYY-MM – общ отчет за месец
router.get('/monthly', requireAuth, requireAdmin, async (req, res) => {
  const { month } = req.query;

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Невалиден формат на месеца. Трябва да е ГГГГ-ММ' });
  }

  try {
    // 1. Вземаме началното салдо (ако има) и start_month
    const settingsRes = await pool.query(
      "SELECT name, value FROM block_params WHERE name IN ('start_month', 'opening_balance')"
    );
    const settings = {};
    settingsRes.rows.forEach(r => { settings[r.name] = r.value; });
    const startMonth = settings.start_month;
    const openingBalance = parseFloat(settings.opening_balance) || 0;

    // 2. Общ брой апартаменти
    const aptCountRes = await pool.query('SELECT COUNT(*)::int AS count FROM apartments');
    const totalApartments = aptCountRes.rows[0].count;

    // 3. Месечни такси за този месец
    const monthlyRes = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'paid')::int AS paid_count,
        COUNT(*) FILTER (WHERE status = 'unpaid')::int AS unpaid_count,
        SUM(total_amount) FILTER (WHERE status = 'paid')::numeric AS paid_sum,
        SUM(elevator_fee) FILTER (WHERE status = 'paid')::numeric AS elevator_fee_sum,
        SUM(elevator_power) FILTER (WHERE status = 'paid')::numeric AS elevator_power_sum,
        SUM(general_power) FILTER (WHERE status = 'paid')::numeric AS general_power_sum,
        SUM(fund_ro) FILTER (WHERE status = 'paid')::numeric AS fund_ro_sum,
        SUM(intercom) FILTER (WHERE status = 'paid')::numeric AS intercom_sum,
        SUM(manager_fee) FILTER (WHERE status = 'paid')::numeric AS manager_fee_sum,
        SUM(total_amount) FILTER (WHERE status = 'unpaid')::numeric AS unpaid_sum
      FROM monthly_charges
      WHERE month = $1
    `, [month]);

    const m = monthlyRes.rows[0];
    const paidCount = m.paid_count || 0;
    const unpaidCount = m.unpaid_count || 0;
    const paidSum = parseFloat(m.paid_sum) || 0;
    const unpaidSum = parseFloat(m.unpaid_sum) || 0;
    const managerFeeSum = parseFloat(m.manager_fee_sum) || 0;

    // 4. Други разходи за този месец (от payments)
    const otherRes = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'paid')::int AS paid_count,
        COUNT(*) FILTER (WHERE status = 'unpaid')::int AS unpaid_count,
        SUM(amount) FILTER (WHERE status = 'paid')::numeric AS paid_sum,
        SUM(amount) FILTER (WHERE status = 'unpaid')::numeric AS unpaid_sum
      FROM payments
      WHERE type = 'other' AND month = $1
    `, [month]);

    const o = otherRes.rows[0];
    const otherPaidCount = o.paid_count || 0;
    const otherUnpaidCount = o.unpaid_count || 0;
    const otherPaidSum = parseFloat(o.paid_sum) || 0;
    const otherUnpaidSum = parseFloat(o.unpaid_sum) || 0;

    // 5. Разходи за месеца (от expenses)
    const expensesRes = await pool.query(`
      SELECT type, SUM(amount)::numeric AS total, COUNT(*)::int AS count
      FROM expenses
      WHERE to_char(date, 'YYYY-MM') = $1
      GROUP BY type
    `, [month]);

    const expensesByType = expensesRes.rows.map(r => ({
      type: r.type,
      total: parseFloat(r.total).toFixed(2),
      count: r.count,
    }));
    const totalExpenses = expensesRes.rows.reduce((sum, r) => sum + parseFloat(r.total), 0);

    // 6. Приходи в касата (без хонорар)
    const toFund = paidSum - managerFeeSum;
    const totalIncome = paidSum + otherPaidSum; // всички платени (месечни + други)
    const balance = toFund + otherPaidSum - totalExpenses;

    // 7. Салдо от предходния месец
    const prevMonth = new Date(month + '-01');
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const prevMonthStr = prevMonth.toISOString().slice(0, 7);

    let prevBalance = openingBalance;
    if (prevMonthStr >= startMonth) {
      // Изчисляваме салдото до предходния месец (може да е сложно, затова за сега го оставяме 0)
      // За по-точна логика ще трябва да сумираме всички приходи и разходи от startMonth до prevMonth.
      prevBalance = 0; // TODO: изчисли реалното салдо
    }

    res.json({
      month,
      start_month: startMonth,
      opening_balance: openingBalance.toFixed(2),
      prev_balance: prevBalance.toFixed(2),
      total_apartments: totalApartments,
      paid_monthly: paidCount,
      unpaid_monthly: unpaidCount,
      other_paid_count: otherPaidCount,
      other_unpaid_count: otherUnpaidCount,
      income: {
        monthly_paid: paidSum.toFixed(2),
        elevator_fee: parseFloat(m.elevator_fee_sum || 0).toFixed(2),
        elevator_power: parseFloat(m.elevator_power_sum || 0).toFixed(2),
        general_power: parseFloat(m.general_power_sum || 0).toFixed(2),
        fund_ro: parseFloat(m.fund_ro_sum || 0).toFixed(2),
        intercom: parseFloat(m.intercom_sum || 0).toFixed(2),
        manager_fee: managerFeeSum.toFixed(2),
        other_paid: otherPaidSum.toFixed(2),
        total: totalIncome.toFixed(2),
      },
      expenses: {
        by_type: expensesByType,
        total: totalExpenses.toFixed(2),
      },
      to_fund: toFund.toFixed(2),
      balance: balance.toFixed(2),
      unpaid: {
        monthly: unpaidSum.toFixed(2),
        other: otherUnpaidSum.toFixed(2),
        total: (unpaidSum + otherUnpaidSum).toFixed(2),
      },
    });

  } catch (error) {
    console.error('Грешка при месечен отчет:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});
export default router;