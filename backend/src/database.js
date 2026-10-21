// backend/src/database.js
import pool from './db.js';

async function createTables() {
  try {
    // Таблица "block_params" – финансови параметри на блока
    await pool.query(`
      CREATE TABLE IF NOT EXISTS block_params (
        name  VARCHAR(50) PRIMARY KEY,
        value VARCHAR(100) NOT NULL
      );
    `);
    console.log('✅ Таблица "block_params" е налична');

    // Таблица "apartments" – апартаментите в блока
    await pool.query(`
      CREATE TABLE IF NOT EXISTS apartments (
        id                    SERIAL PRIMARY KEY,
        number                INTEGER UNIQUE NOT NULL,
        floor                 INTEGER NOT NULL,
        residents             INTEGER DEFAULT 0,
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
    console.log('✅ Таблица "apartments" е налична');

    // Таблица "payments" – плащания от апартаментите
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
    console.log('✅ Таблица "payments" е налична');
    // Таблица "expenses" – разходи на блока
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
    console.log('✅ Таблица "expenses" е налична');

    // Таблица "admins" – администраторът
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
    console.log('✅ Таблица "admins" е налична');

    // Индекси
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_apartment ON payments(ap_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_month ON payments(month);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);`);

    // Уникален индекс (без 'other')
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_unique 
        ON payments (ap_id, month, type)
        WHERE type != 'other';
    `);

    console.log('✅ Индексите са налични');
  } catch (error) {
    console.error('❌ Грешка при създаване на таблиците:', error.message);
    throw error;
  }
}

export default createTables;