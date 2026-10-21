// backend/src/seed.js
import pool from './db.js';
import { generatePassword } from './utils/passwords.js';

async function seed() {
  // Провери дали вече има данни
  const result = await pool.query('SELECT COUNT(*)::int AS count FROM admins');

  if (result.rows[0].count > 0) {
    console.log('ℹ️  Базата вече има данни – пропускам seed');
    return;
  }

  console.log('🌱 Празна база – стартирам seed...');

  // 1. Настройки в block_params
  const now = new Date();
  // const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonth = '2026-01';
  await pool.query(`
  INSERT INTO block_params (name, value) VALUES
    ('monthly_fee', '7.00'),
    ('manager_fee', '3.00'),
    ('start_month', $1)
  ON CONFLICT (name) DO NOTHING;
  `, [currentMonth]);
  console.log(`✅ block_params: 3 параметъра (start_month: ${currentMonth})`);

  // 2. 90 апартамента
  let inserted = 0;

  for (let number = 1; number <= 90; number++) {
    const floor = Math.ceil(number / 6);
    const password = generatePassword();

    const result = await pool.query(`
    INSERT INTO apartments (number, floor, password, must_change_password)
    VALUES ($1, $2, $3, TRUE)
    ON CONFLICT (number) DO NOTHING;
  `, [number, floor, password]);

    if (result.rowCount > 0) inserted++;
  }

  console.log(`✅ apartments: ${inserted} нови апартамента (общо 90, случайни пароли)`);

  // 3. Админ
  const ADMIN_PASSWORD = 'doremisi';
  await pool.query(`
  INSERT INTO admins (username, password, apartment_id)
  VALUES ('admin', $1, (SELECT id FROM apartments WHERE number = 70))
  ON CONFLICT (username) DO NOTHING;
  `, [ADMIN_PASSWORD]);
  console.log('✅ admins: 1 админ (admin / ап. 70)');
  console.log('');
  console.log(`🔑 ПАРОЛА НА АДМИНА: ${ADMIN_PASSWORD}`);
  console.log('   Препоръчително: сменете я след първия вход.');
  console.log('');
}

export default seed;