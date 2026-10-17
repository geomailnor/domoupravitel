// backend/src/seed-demo.js
import 'dotenv/config';
import pool from './db.js';

// Списък с 80 български имена
const NAMES = [
  'Иван Вазов', 'Пепеляшка', 'Джон Атанасов', 'Елена Петрова',
  'Димитър Димов', 'Сандокан', 'Блага Димитрова', 'Никола Вапцаров',
  'Пенка Христова', 'Васил Найденов', 'Радка Николова', 'Лили Иванова',
  'Йорданка Христова', 'Емил Димитров', 'Цветанка Георгиева', 'Борис Трифонов',
  'Лидия Павлова', 'Крали Марко', 'Здравка Иванова', 'Хитър Петър',
  'Мими Иванова', 'Петър Стоянов', 'Ваня Димитрова', 'Христо Кидиков',
  'Снежанка', 'Али Баба', 'Радка Петрова', 'Слави Трифонов',
  'Дафина Иванова', 'Настрадин Ходжа', 'Шехерезада', 'Синбад Мореплавателя',
  'Арабела', 'Трифон Иванов', 'Бонка Маринова', 'Янко Тодоров',
  'Магдалена Колева', 'Тодорка Георгиева', 'Ненко Трифонов', 'Гана Павлова',
  'Валентин Вълчев', 'Симеон Велики', 'Фантомас', 'Красимира Петрова',
  'Дончо Донев', 'Милена Димитрова', 'Илия Николов', 'Тотка Тодорова',
  'Мадона', 'Росица Кирилова', 'Ангел Трифонов', 'Марийка Иванова',
  'Дън Сяо Пин', 'Стефка Христова', 'Вълчо Димитров', 'Иванка Ангелова',
  'Никола Йорданов', 'Ирина Флорин', 'Любо Пенев', 'Русана Костадинова',
  'Стоил Георгиева', 'Недялка Трифонова', 'Иван Павлов', 'Калина Вълчева',
  'Борис Иванов', 'Златка Петрова', 'Георги Стоянов', 'Милка Георгиева',
  'Иван Грозни', 'Невена Коканова', 'Петър Велики', 'Нефертити',
  'Петър Петров', 'Евдокия Трифонова', 'Васил Вълчев', 'Стоянка Димитрова',
  'Крум Страшни', 'Аспарух',
];

const NOTES = [
  'Плаща редовно',
  'Собственикът е в чужбина',
  'Плаща на всеки 3 месеца',
  'Има куче',
  'Обитава се от наематели',
  'Празен апартамент',
  'Собственикът е болен',
  'Обича да коментира',
  'Плаща със закъснение',
  'Собственикът е възрастен',
];

async function seedDemo() {
  console.log('🌱 Стартирам demo seed...');
  console.log('');

  try {
    // 1. Провери дали има апартаменти
    const aptResult = await pool.query('SELECT COUNT(*)::int AS count FROM apartments');
    if (aptResult.rows[0].count === 0) {
      console.error('❌ Няма апартаменти в базата. Пусни първо нормалния seed.');
      process.exit(1);
    }

    // 2. Провери дали вече има имена (за да не дублираме)
    const namedResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM apartments WHERE owner_name IS NOT NULL'
    );
    if (namedResult.rows[0].count > 0) {
      console.log('⚠️  Базата вече има имена. Пропускам добавянето.');
      console.log('   Ако искаш ново demo – изтрий таблиците и пусни отново.');
      process.exit(0);
    }

    // 3. Добави имена на 80 от 90 апартамента (разбъркано)
    console.log('👥 Добавям имена...');

    const allApartments = await pool.query(
      'SELECT id, number FROM apartments ORDER BY number'
    );
    const allApts = allApartments.rows;

    // Избери 80 случайни апартамента (10 без име)
    const shuffledApts = [...allApts].sort(() => Math.random() - 0.5);
    const apartmentsWithNames = shuffledApts.slice(0, 80);

    // Разбъркани имена
    const shuffledNames = [...NAMES].sort(() => Math.random() - 0.5);

    for (let i = 0; i < 80; i++) {
      const apt = apartmentsWithNames[i];
      const name = shuffledNames[i];

      // 50% от тях имат телефон
      const hasPhone = Math.random() < 0.5;
      const phone = hasPhone
        ? `08${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)} ${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)} ${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)}`
        : null;

      // 10% от тях имат бележки
      const hasNote = Math.random() < 0.1;
      const notes = hasNote
        ? NOTES[Math.floor(Math.random() * NOTES.length)]
        : null;

      await pool.query(
        'UPDATE apartments SET owner_name = $1, phone = $2, notes = $3 WHERE id = $4',
        [name, phone, notes, apt.id]
      );
    }
    console.log('   ✅ 80 апартамента с имена');
    console.log('   ✅ ~50% с телефон');
    console.log('   ✅ ~10% с бележки');

    // 4. Създай плащания за последните 6 месеца
    console.log('');
    console.log('💰 Създавам плащания за последните 6 месеца...');

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Последните 6 месеца
    const months = [];
    for (let i = 6; i >= 1; i--) {   // ← от 6 до 1 (без 0)
      let m = currentMonth - i;
      let y = currentYear;
      while (m <= 0) {
        m += 12;
        y--;
      }
      months.push(`${y}-${String(m).padStart(2, '0')}`);
    }

    console.log(`   Месеци: ${months.join(', ')}`);

    let totalPayments = 0;

    // За всеки апартамент и всеки месец
    for (const apt of allApts) {
      for (const month of months) {
        // Разпределение:
        // 70% платени, 20% неплатени, 10% частично
        const random = Math.random();
        let status;
        let amount = 7.00;

        if (random < 0.7) {
          status = 'paid';
        } else if (random < 0.9) {
          status = 'unpaid';
          amount = 0;
        } else {
          status = 'partial';
          amount = 4.00;
        }

        const confirmedAt = status === 'paid' ? new Date() : null;

        await pool.query(`
          INSERT INTO payments (ap_id, month, amount, type, status, confirmed_at)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [apt.id, month, amount, 'monthly', status, confirmedAt]);

        totalPayments++;
      }
    }

    console.log(`   ✅ ${totalPayments} записа (${months.length} месеца × 90 апартамента)`);

    // 5. Добави няколко допълнителни плащания (асансьор, вода)
    console.log('');
    console.log('🔧 Добавям допълнителни плащания...');

    // Допълнителни плащания от тип 'other' (за различни апартаменти)
    const extraDescriptions = [
      'Ремонт на асансьор',
      'Доплащане вода',
      'Чистачка',
      'Ремонт на входна врата',
      'Подмяна на домофон',
      'Ремонт на покрив',
    ];
    let extraCount = 0;

    for (const apt of allApts.slice(0, 15)) {
      const amount = Math.floor(Math.random() * 30) + 5;   // 5–35 €
      const description = extraDescriptions[Math.floor(Math.random() * extraDescriptions.length)];

      await pool.query(`
    INSERT INTO payments (ap_id, month, amount, type, status, confirmed_at, description)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [
        apt.id,
        months[months.length - 1],   // последния от диапазона (предишен месец)
        amount,
        'other',
        'paid',
        new Date(),
        description
      ]);

      extraCount++;
    }
    console.log(`   ✅ ${extraCount} допълнителни плащания (тип 'other')`);


    // 6.1 Обнови start_month да съвпада с началото на demo-то
    await pool.query(`
      UPDATE block_params SET value = $1 WHERE name = 'start_month'
    `, [months[0]]);
    console.log(`   ✅ start_month обновен на ${months[0]}`);

    // 7. Обобщение
    console.log('');
    console.log('🌱 Demo seed завършен!');
    console.log('');
    console.log('📊 Обобщение:');
    console.log(`   • 80 апартамента с имена`);
    console.log(`   • 10 апартамента без имена`);
    console.log(`   • ${totalPayments} плащания за ${months.length} месеца`);
    console.log(`   • ${extraCount} допълнителни плащания`);
    console.log('');
    console.log('💡 Сега можеш да разгледаш системата с реални данни.');
    console.log('');

  } catch (error) {
    console.error('❌ Грешка:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedDemo();