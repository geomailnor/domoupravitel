// backend/src/index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import createTables from './database.js';
import seed from './seed.js';
import authRoutes from './routes/auth.js';
import apartmentsRoutes from './routes/apartments.js';
import paymentsRoutes from './routes/payments.js';
import expensesRoutes from './routes/expenses.js';
import settingsRoutes from './routes/settings.js';
import reportsRoutes from './routes/reports.js';

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL?.split(',') || 'http://localhost:5173'
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/apartments', apartmentsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reports', reportsRoutes);

// Тестов endpoint
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Сървърът работи' });
});

// Стартиране
const PORT = process.env.PORT || 10000;

async function start() {
  try {
    console.log('🚀 Стартирам сървъра...');

    // Създаваме таблиците (ако не съществуват)
    await createTables();

    // Seed (ако базата е празна)
    await seed();

    // Слушаме на порт
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Сървърът слуша на порт ${PORT}`);
      console.log(`   Тествай: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Грешка при стартиране:', error.message);
    process.exit(1);
  }
}

start();