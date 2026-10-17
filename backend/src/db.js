// backend/src/db.js
import pg from 'pg';

// ⚠️ ВАЖНО: Казваме на pg да връща DATE (OID 1082) като низ,
// за да не преобразува през часова зона и да не губи ден
pg.types.setTypeParser(1082, (val) => val);

const { Pool } = pg;
/*
Изваждаме Pool от pg пакета. Pool е набор от връзки към 
базата – вместо да отваряме нова връзка при всяка заявка 
(бавно), pool-ът държи няколко готови връзки и ги преизползва.
*/

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
}); //Създаваме pool с твоя connection string. ssl: { rejectUnauthorized: false } е задължително за Neon

// Лог при първо свързване
pool.on('connect', () => {
  console.log('✅ Свързан към базата');
});

// Лог при грешка
pool.on('error', (err) => {
  console.error('❌ Грешка в базата:', err.message);
});

export default pool;