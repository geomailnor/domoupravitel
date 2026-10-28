// backend/src/routes/charges.js
import express from 'express';
import pool from '../db.js';
import { requireAuth, requireAdmin } from '../jwt.js';

const router = express.Router();

// Помощна функция за закръгляне до 2 знака
const round2 = (num) => Math.round(num * 100) / 100;

// Помощна функция за изчисляване на сумите за един апартамент
function calculateCharges(ap, rates, residentsCount, elevatorPayersCount) {
  // Ако е свободен, всичко е 0, освен фиксираните
  if (ap.is_vacant) {
    return {
      elevator_fee: 0,
      elevator_power: 0,
      general_power: 0,
      fund_ro: rates.fund_ro_rate,
      intercom: rates.intercom_rate,
      manager_fee: rates.manager_fee_rate,
      total_amount: rates.fund_ro_rate + rates.intercom_rate + rates.manager_fee_rate
    };
  }

  // Изчисляване
  const elevator_fee = round2(elevatorPayersCount * rates.elevator_fee_rate);
  const elevator_power = round2(elevatorPayersCount * rates.elevator_power_rate);
  const general_power = round2(residentsCount * rates.general_power_rate);
  const fund_ro = rates.fund_ro_rate;
  const intercom = rates.intercom_rate;
  const manager_fee = rates.manager_fee_rate;

  return {
    elevator_fee,
    elevator_power,
    general_power,
    fund_ro,
    intercom,
    manager_fee,
    total_amount: round2(elevator_fee + elevator_power + general_power + fund_ro + intercom + manager_fee)
  };
}

// GET /api/charges?month=YYYY-MM
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const { month } = req.query;

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Невалиден месец. Формат: YYYY-MM' });
  }
  // Проверка дали месецът е преди start_month
  const startRes = await pool.query('SELECT value FROM block_params WHERE name = $1', ['start_month']);
  const startMonth = startRes.rows[0]?.value;

  if (startMonth && month < startMonth) {
    return res.json([]); // Връщаме празен масив, без да генерираме
  }
  try {
    // 1. Вземаме текущите настройки (цени)
    const paramsRes = await pool.query('SELECT name, value FROM block_params WHERE name LIKE \'%_rate\'');
    const rates = {};
    paramsRes.rows.forEach(row => {
      rates[row.name] = parseFloat(row.value);
    });

    // Ако някои липсват, слагаме default (за сигурност)
    const defaultRates = {
      elevator_fee_rate: 1.13, elevator_power_rate: 0.82, general_power_rate: 0.65,
      fund_ro_rate: 3.00, intercom_rate: 1.00, manager_fee_rate: 3.00
    };
    Object.assign(rates, defaultRates, rates);

    // 2. Проверяваме дали има записи за този месец
    const checkRes = await pool.query('SELECT COUNT(*) FROM monthly_charges WHERE month = $1', [month]);

    if (parseInt(checkRes.rows[0].count) === 0) {
      // Ако няма, генерираме за всички апартаменти
      // Вземаме последния съществуващ месец (преди текущия)
      const prevMonthRes = await pool.query(
        'SELECT MAX(month) as prev_month FROM monthly_charges WHERE month < $1',
        [month]
      );
      const prevMonth = prevMonthRes.rows[0]?.prev_month;

      const apsRes = await pool.query('SELECT * FROM apartments ORDER BY number');

      let prevChargesMap = {};
      if (prevMonth) {
        const prevChargesRes = await pool.query(
          'SELECT ap_id, residents_count, elevator_payers_count FROM monthly_charges WHERE month = $1',
          [prevMonth]
        );
        prevChargesRes.rows.forEach(row => {
          prevChargesMap[row.ap_id] = {
            residents: row.residents_count,
            elevatorPayers: row.elevator_payers_count
          };
        });
      }

      const insertPromises = apsRes.rows.map(ap => {
        let residentsCount = ap.residents;
        let elevatorPayers = ap.residents;

        // Ако има предишен месец, взимаме неговите стойности
        if (prevMonth && prevChargesMap[ap.id]) {
          residentsCount = prevChargesMap[ap.id].residents;
          elevatorPayers = prevChargesMap[ap.id].elevatorPayers;
        } else {
          // Ако няма предишен месец (първи месец), взимаме от apartments
          if (ap.is_vacant) elevatorPayers = 0;
        }

        const calc = calculateCharges(ap, rates, residentsCount, elevatorPayers);

        return pool.query(`
          INSERT INTO monthly_charges (
            ap_id, month, residents_count, elevator_payers_count,
            elevator_fee, elevator_power, general_power,
            fund_ro, intercom, manager_fee, total_amount, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'unpaid')
        `, [
          ap.id, month, residentsCount, elevatorPayers,
          calc.elevator_fee, calc.elevator_power, calc.general_power,
          calc.fund_ro, calc.intercom, calc.manager_fee, calc.total_amount
        ]);
      });

      await Promise.all(insertPromises);
    }

    // 3. Връщаме данните за месеца (свързани с апартаментите)
    const result = await pool.query(`
      SELECT 
        m.id as charge_id, m.ap_id, m.month, m.residents_count, m.elevator_payers_count,
        m.elevator_fee::float, m.elevator_power::float, m.general_power::float,
        m.fund_ro::float, m.intercom::float, m.manager_fee::float, m.total_amount::float, 
        m.status, m.paid_at,
        a.number as ap_number, a.floor, a.owner_name, a.is_vacant, a.phone, a.notes
      FROM monthly_charges m
      JOIN apartments a ON m.ap_id = a.id
      WHERE m.month = $1
      ORDER BY a.number
    `, [month]);

    res.json(result.rows);
  } catch (error) {
    console.error('Грешка при зареждане на такси:', error);
    res.status(500).json({ error: 'Вътрешна грешка при зареждане на таксите' });
  }
});

// PUT /api/charges/:id (Инлайн редакция)
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { residents_count, elevator_payers_count, is_vacant, owner_name, status } = req.body;

  try {
    // 1. Вземаме текущите цени
    const paramsRes = await pool.query('SELECT name, value FROM block_params WHERE name LIKE \'%_rate\'');
    const rates = {};
    paramsRes.rows.forEach(row => {
      rates[row.name] = parseFloat(row.value);
    });

    const defaultRates = {
      elevator_fee_rate: 1.13, elevator_power_rate: 0.82, general_power_rate: 0.65,
      fund_ro_rate: 3.00, intercom_rate: 1.00, manager_fee_rate: 3.00
    };
    Object.assign(rates, defaultRates, rates);

    // 2. Вземаме данните за апартамента и текущия запис
    const chargeRes = await pool.query(`
      SELECT m.*, a.is_vacant as ap_is_vacant, a.default_pays_elevator
      FROM monthly_charges m
      JOIN apartments a ON m.ap_id = a.id
      WHERE m.id = $1
    `, [id]);

    if (chargeRes.rows.length === 0) {
      return res.status(404).json({ error: 'Записът не е намерен' });
    }
    const charge = chargeRes.rows[0];

    // 3. Определяме новите стойности
    const newResidents = residents_count !== undefined ? parseInt(residents_count) : charge.residents_count;

    // Ако потребителят е променил живущите, но не е пипал плащащите асансьор,
    // автоматично изравняваме плащащите с новия брой живущи.
    let newElevatorPayers = charge.elevator_payers_count;
    if (elevator_payers_count !== undefined) {
      newElevatorPayers = parseInt(elevator_payers_count);
    } else if (residents_count !== undefined) {
      newElevatorPayers = newResidents;
    }

    // Ако е маркиран като свободен, принудително нулираме живущите
    const isVacant = is_vacant !== undefined ? is_vacant : charge.ap_is_vacant;
    const finalResidents = isVacant ? 0 : newResidents;
    const finalElevatorPayers = isVacant ? 0 : newElevatorPayers;

    // 4. Преизчисляваме сумите
    const fakeAp = { is_vacant: isVacant }; // За функцията
    const calc = calculateCharges(fakeAp, rates, finalResidents, finalElevatorPayers);

    // 5. Обновяваме записа
    const updateRes = await pool.query(`
      UPDATE monthly_charges SET
        residents_count = $1,
        elevator_payers_count = $2,
        elevator_fee = $3,
        elevator_power = $4,
        general_power = $5,
        fund_ro = $6,
        intercom = $7,
        manager_fee = $8,
        total_amount = $9
      WHERE id = $10
      RETURNING *
    `, [
      finalResidents, finalElevatorPayers,
      calc.elevator_fee, calc.elevator_power, calc.general_power,
      calc.fund_ro, calc.intercom, calc.manager_fee, calc.total_amount,
      id
    ]);

    // Ако сме променили is_vacant на ниво апартамент (може да не е нужно, но за сигурност)
    if (is_vacant !== undefined) {
      await pool.query('UPDATE apartments SET is_vacant = $1 WHERE id = $2', [isVacant, charge.ap_id]);
    }
    // Ако сме променили residents_count, обновяваме и apartments таблицата
    // (за да може първият месец да взима правилните данни)
    if (residents_count !== undefined) {
      await pool.query(
        'UPDATE apartments SET residents = $1 WHERE id = $2',
        [finalResidents, charge.ap_id]
      );
    }
    // Ако е подадено ново име, обновяваме и apartments таблицата
    if (owner_name !== undefined) {
      await pool.query('UPDATE apartments SET owner_name = $1 WHERE id = $2', [owner_name, charge.ap_id]);
    }
    // Ако е подаден нов статус
    if (status !== undefined) {
      const paidAt = status === 'paid' ? new Date() : null;
      await pool.query(`
        UPDATE monthly_charges 
        SET status = $1, paid_at = $2 
        WHERE id = $3
      `, [status, paidAt, id]);
    }
    res.json(updateRes.rows[0]);
  } catch (error) {
    console.error('Грешка при обновяване на такса:', error);
    res.status(500).json({ error: 'Вътрешна грешка при обновяване' });
  }
});
// GET /api/charges/history/:ap_id – история на таксите и другите разходи
router.get('/history/:ap_id', requireAuth, requireAdmin, async (req, res) => {
  const { ap_id } = req.params;

  try {
    // 1. Вземаме месечните такси
    const monthlyRes = await pool.query(`
      SELECT 
        id, month, residents_count, elevator_payers_count,
        elevator_fee::float, elevator_power::float, general_power::float,
        fund_ro::float, intercom::float, manager_fee::float, total_amount::float,
        status, paid_at
      FROM monthly_charges
      WHERE ap_id = $1
      ORDER BY month DESC
    `, [ap_id]);

    // 2. Вземаме other разходите от старата таблица payments
    const otherRes = await pool.query(`
      SELECT id, month, amount::float, type, description, status
      FROM payments
      WHERE ap_id = $1 AND type = 'other'
      ORDER BY month DESC
    `, [ap_id]);

    res.json({
      monthly: monthlyRes.rows,
      other: otherRes.rows,
    });
  } catch (error) {
    console.error('Грешка при зареждане на историята:', error);
    res.status(500).json({ error: 'Вътрешна грешка при зареждане на историята' });
  }
});
// POST /api/charges/recalculate-unpaid – преизчислява неплатените такси за текущия месец
router.post('/recalculate-unpaid', requireAuth, requireAdmin, async (req, res) => {
  const currentMonth = new Date().toISOString().slice(0, 7);

  try {
    // 1. Вземаме актуалните цени
    const paramsRes = await pool.query('SELECT name, value FROM block_params WHERE name LIKE \'%_rate\'');
    const rates = {};
    paramsRes.rows.forEach(row => { rates[row.name] = parseFloat(row.value); });

    const defaultRates = {
      elevator_fee_rate: 1.13, elevator_power_rate: 0.82, general_power_rate: 0.65,
      fund_ro_rate: 3.00, intercom_rate: 1.00, manager_fee_rate: 3.00
    };
    Object.assign(rates, defaultRates, rates);

    // 2. Вземаме неплатените такси за текущия месец
    const unpaidRes = await pool.query(`
      SELECT m.id, m.ap_id, m.residents_count, m.elevator_payers_count, a.is_vacant
      FROM monthly_charges m
      JOIN apartments a ON m.ap_id = a.id
      WHERE m.month = $1 AND m.status = 'unpaid'
    `, [currentMonth]);

    // 3. Преизчисляваме всяка неплатена такса
    for (const charge of unpaidRes.rows) {
      let elevatorPayers = charge.elevator_payers_count;
      // Ако е свободен, 0
      if (charge.is_vacant) elevatorPayers = 0;

      const elevator_fee = Math.round(elevatorPayers * rates.elevator_fee_rate * 100) / 100;
      const elevator_power = Math.round(elevatorPayers * rates.elevator_power_rate * 100) / 100;
      const general_power = Math.round(charge.residents_count * rates.general_power_rate * 100) / 100;
      const fund_ro = rates.fund_ro_rate;
      const intercom = rates.intercom_rate;
      const manager_fee = rates.manager_fee_rate;
      const total_amount = Math.round((elevator_fee + elevator_power + general_power + fund_ro + intercom + manager_fee) * 100) / 100;

      await pool.query(`
        UPDATE monthly_charges SET
          elevator_fee = $1, elevator_power = $2, general_power = $3,
          fund_ro = $4, intercom = $5, manager_fee = $6, total_amount = $7
        WHERE id = $8
      `, [elevator_fee, elevator_power, general_power, fund_ro, intercom, manager_fee, total_amount, charge.id]);
    }

    res.json({ message: `Преизчислени ${unpaidRes.rowCount} неплатени такси.` });
  } catch (error) {
    console.error('Грешка при преизчисляване:', error);
    res.status(500).json({ error: 'Грешка при преизчисляване' });
  }
});
export default router;