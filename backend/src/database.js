// backend/src/database.js
import pool from './db.js';

async function createTables() {
  try {
    // 1. block_params
    await pool.query(`
      CREATE TABLE IF NOT EXISTS block_params (
        name  VARCHAR(50) PRIMARY KEY,
        value VARCHAR(100) NOT NULL
      );
    `);

    // 2. apartments (с новите колони)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS apartments (
        id                    SERIAL PRIMARY KEY,
        number                INTEGER UNIQUE NOT NULL,
        floor                 INTEGER NOT NULL,
        residents             INTEGER DEFAULT 1,
        is_vacant             BOOLEAN DEFAULT FALSE,
        default_pays_elevator BOOLEAN DEFAULT TRUE,
        owner_name            VARCHAR(100),
        phone                 VARCHAR(20),
        email                 VARCHAR(100),
        notes                 VARCHAR(300),
        password              VARCHAR(50) NOT NULL,
        password_changed_at   TIMESTAMPTZ,
        must_change_password  BOOLEAN DEFAULT TRUE,
        created_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. monthly_charges (нова таблица)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS monthly_charges (
        id                    SERIAL PRIMARY KEY,
        ap_id                 INTEGER NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
        month                 CHAR(7) NOT NULL,
        residents_count       INTEGER NOT NULL DEFAULT 1,
        elevator_payers_count INTEGER NOT NULL DEFAULT 0,
        elevator_fee          NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        elevator_power        NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        general_power         NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        fund_ro               NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        intercom              NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        manager_fee           NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        total_amount          NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        status                VARCHAR(15) NOT NULL DEFAULT 'unpaid',
        paid_at               TIMESTAMPTZ,
        created_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ap_id, month)
      );
    `);

    // 4. payments (остава за 'other' разходи)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id            SERIAL PRIMARY KEY,
        ap_id         INTEGER NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
        month         CHAR(7) NOT NULL,
        amount        NUMERIC(10,2) NOT NULL,
        type          VARCHAR(30) NOT NULL,
        description   VARCHAR(300),
        status        VARCHAR(15) NOT NULL DEFAULT 'unpaid',
        confirmed_at  TIMESTAMPTZ,
        created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. expenses
    await pool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id            SERIAL PRIMARY KEY,
        date          DATE NOT NULL,
        amount        NUMERIC(10,2) NOT NULL,
        type          VARCHAR(30) NOT NULL,
        description   VARCHAR(300),
        created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. admins
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id            SERIAL PRIMARY KEY,
        username      VARCHAR(50) UNIQUE NOT NULL,
        password      VARCHAR(50) NOT NULL,
        apartment_id  INTEGER REFERENCES apartments(id),
        security_question  VARCHAR(200),
        security_answer    VARCHAR(200),
        created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Индекси
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_apartment ON payments(ap_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_month ON payments(month);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_monthly_charges_month ON monthly_charges(month);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_monthly_charges_ap ON monthly_charges(ap_id);`);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_unique 
        ON payments (ap_id, month, type)
        WHERE type != 'other';
    `);

    // Начални стойности за новите цени (ако липсват)
    await pool.query(`
      INSERT INTO block_params (name, value) VALUES 
      ('elevator_fee_rate', '1.13'),
      ('elevator_power_rate', '0.82'),
      ('general_power_rate', '0.65'),
      ('fund_ro_rate', '3.00'),
      ('intercom_rate', '1.00'),
      ('manager_fee_rate', '3.00')
      ON CONFLICT (name) DO NOTHING;
    `);

    // По подразбиране 1 и 2 етаж не плащат асансьор (само ако имат TRUE, го правим FALSE)
    await pool.query(`
      UPDATE apartments 
      SET default_pays_elevator = FALSE 
      WHERE floor IN (1, 2) AND default_pays_elevator = TRUE;
    `);

    console.log('✅ Всички таблици и индекси са налични');
  } catch (error) {
    console.error('❌ Грешка при създаване на таблиците:', error.message);
    throw error;
  }
}

export default createTables;