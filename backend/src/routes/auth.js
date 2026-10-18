// backend/src/routes/auth.js
import express from 'express';
import pool from '../db.js';
import { generatePassword } from '../utils/passwords.js';
import { signToken, requireAuth, requireAdmin } from '../jwt.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { role, username, password } = req.body;

  // 1. Проверка за задължителни полета
  if (!role || !username || !password) {
    return res.status(400).json({ error: 'Липсват role, username или password' });
  }

  try {
    // 2. Логин за АДМИН
    if (role === 'admin') {
      const result = await pool.query(
        'SELECT * FROM admins WHERE username = $1',
        [username]
      );
      const admin = result.rows[0];

      if (!admin) {
        return res.status(401).json({ error: 'Грешно потребителско име или парола' });
      }

      if (password !== admin.password) {
        return res.status(401).json({ error: 'Грешно потребителско име или парола' });
      }

      const token = signToken({
        role: 'admin',
        id: admin.id,
        username: admin.username
      });

      return res.json({
        token,
        role: 'admin',
        user: {
          id: admin.id,
          username: admin.username,
          role: 'admin'
        },
        has_security_question: !!admin.security_question
      });
    }

    // 3. Логин за ЖИЛЕЦ
    if (role === 'resident') {
      const number = parseInt(username, 10);
      if (!number || number < 1 || number > 90) {
        return res.status(401).json({ error: 'Невалиден номер на апартамент' });
      }

      const result = await pool.query(
        'SELECT * FROM apartments WHERE number = $1',
        [number]
      );
      const apartment = result.rows[0];

      if (!apartment) {
        return res.status(401).json({ error: 'Грешно потребителско име или парола' });
      }

      if (password !== apartment.password) {
        return res.status(401).json({ error: 'Грешно потребителско име или парола' });
      }

      const token = signToken({
        role: 'resident',
        id: apartment.id,
        number: apartment.number
      });

      return res.json({
        token,
        role: 'resident',
        user: {
          id: apartment.id,
          number: apartment.number,
          floor: apartment.floor,
          owner_name: apartment.owner_name,
          role: 'resident'
        },
        must_change_password: apartment.must_change_password
      });
    }

    // 4. Непозната роля
    return res.status(400).json({ error: 'Невалидна роля' });

  } catch (error) {
    console.error('Login грешка:', error);
    return res.status(500).json({ error: 'Сървърна грешка' });
  }
});

// GET /api/auth/me – връща информация за логнатия потребител
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/change-password – смяна на парола на логнатия
router.post('/change-password', requireAuth, async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;

  // 1. Проверка за задължителни полета
  if (!oldPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({
      error: 'Липсват задължителни полета'
    });
  }

  try {
    // 2. Намери потребителя в базата (според ролята)
    const table = req.user.role === 'admin' ? 'admins' : 'apartments';
    const userResult = await pool.query(
      `SELECT id, password FROM ${table} WHERE id = $1`,
      [req.user.id]
    );

    const user = userResult.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'Потребителят не е намерен' });
    }

    // 3. ПРОВЕРИ СТАРАТА ПАРОЛА ПРЕДИ ВСИЧКО ДРУГО
    if (oldPassword !== user.password) {
      return res.status(400).json({ error: 'Грешна стара парола' });
    }

    // 4. Провери дали новата и потвърждението съвпадат
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Новите пароли не съвпадат' });
    }

    // 5. Валидация на новата парола
    if (newPassword.length < 4) {
      return res.status(400).json({
        error: 'Новата парола трябва да е поне 4 символа'
      });
    }

    // 6. Провери новата да е различна от старата
    if (oldPassword === newPassword) {
      return res.status(400).json({
        error: 'Новата парола трябва да е различна от старата'
      });
    }

    // 7. Обнови според ролята
    if (req.user.role === 'admin') {
      await pool.query(
        'UPDATE admins SET password = $1 WHERE id = $2',
        [newPassword, req.user.id]
      );
    } else {
      await pool.query(
        `UPDATE apartments
         SET password = $1,
             password_changed_at = $2,
             must_change_password = FALSE
         WHERE id = $3`,
        [newPassword, new Date(), req.user.id]
      );
    }

    res.json({ message: 'Паролата е сменена успешно' });

  } catch (error) {
    console.error('Грешка при смяна на парола:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});

// POST /api/auth/reset-password/:number – админът нулира парола на жилец
router.post('/reset-password/:number', requireAuth, requireAdmin, async (req, res) => {
  const number = parseInt(req.params.number, 10);

  if (!number || number < 1 || number > 90) {
    return res.status(400).json({
      error: 'Невалиден номер на апартамент (1-90)'
    });
  }

  try {
    // Провери дали апартаментът съществува
    const aptResult = await pool.query(
      'SELECT id FROM apartments WHERE number = $1',
      [number]
    );

    if (!aptResult.rows[0]) {
      return res.status(404).json({ error: 'Такъв апартамент не е намерен' });
    }

    const newPassword = generatePassword();

    await pool.query(
      `UPDATE apartments SET password = $1,
       password_changed_at = NULL,
       must_change_password = TRUE WHERE number = $2`,
      [newPassword, number]
    );

    res.json({
      message: `Паролата на ап. ${number} е нулирана`,
      apartment_number: number,
      new_password: newPassword
    });

  } catch (error) {
    console.error('Грешка при нулиране на парола:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});
// POST /api/auth/change-username – смяна на потребителско име (само админ)
router.post('/change-username', requireAuth, requireAdmin, async (req, res) => {
  const { newUsername } = req.body;

  if (!newUsername || newUsername.trim().length < 3) {
    return res.status(400).json({
      error: 'Потребителското име трябва да е поне 3 символа'
    });
  }

  const trimmed = newUsername.trim();

  // Провери дали е същото като текущото
  const current = await pool.query(
    'SELECT username FROM admins WHERE id = $1',
    [req.user.id]
  );

  if (current.rows[0]?.username === trimmed) {
    return res.status(400).json({
      error: 'Новото потребителско име трябва да е различно от текущото'
    });
  }

  try {
    // Провери дали вече съществува друг админ с това име
    const existing = await pool.query(
      'SELECT id FROM admins WHERE username = $1 AND id != $2',
      [trimmed, req.user.id]
    );

    if (existing.rows[0]) {
      return res.status(400).json({
        error: 'Това потребителско име вече е заето'
      });
    }

    // Обнови
    await pool.query(
      'UPDATE admins SET username = $1 WHERE id = $2',
      [trimmed, req.user.id]
    );

    res.json({
      message: 'Потребителското име е сменено',
      username: trimmed
    });

  } catch (error) {
    console.error('Грешка при смяна на потребителско име:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});
// POST /api/auth/set-security-question – задаване/смяна на въпрос и отговор (само админ)
router.post('/set-security-question', requireAuth, requireAdmin, async (req, res) => {
  const { question, answer } = req.body;

  if (!question || !answer || question.trim().length < 5 || answer.trim().length < 2) {
    return res.status(400).json({
      error: 'Въпросът трябва да е поне 5 символа, отговорът – поне 2'
    });
  }

  try {
    await pool.query(
      'UPDATE admins SET security_question = $1, security_answer = $2 WHERE id = $3',
      [question.trim(), answer.trim(), req.user.id]
    );

    res.json({ message: 'Въпросът за сигурност е запазен' });
  } catch (error) {
    console.error('Грешка при запазване на въпрос:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});

// POST /api/auth/get-security-question – връща въпроса по username (публичен)
router.post('/get-security-question', async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Липсва потребителско име' });
  }

  try {
    const result = await pool.query(
      'SELECT security_question FROM admins WHERE username = $1',
      [username.trim()]
    );

    const admin = result.rows[0];

    if (!admin) {
      return res.status(404).json({ error: 'Няма такъв администратор' });
    }

    if (!admin.security_question) {
      return res.status(400).json({
        error: 'Този акаунт няма зададен таен въпрос. Свържете се с администратора.'
      });
    }

    res.json({ question: admin.security_question });
  } catch (error) {
    console.error('Грешка при вземане на въпрос:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});

// POST /api/auth/reset-with-answer – проверява отговора и връща старата парола (публичен)
router.post('/reset-with-answer', async (req, res) => {
  const { username, answer } = req.body;

  if (!username || !answer) {
    return res.status(400).json({ error: 'Липсват потребителско име или отговор' });
  }

  try {
    const result = await pool.query(
      'SELECT password, security_answer FROM admins WHERE username = $1',
      [username.trim()]
    );

    const admin = result.rows[0];

    if (!admin) {
      return res.status(404).json({ error: 'Няма такъв администратор' });
    }

    if (!admin.security_answer) {
      return res.status(400).json({
        error: 'Този акаунт няма зададен таен въпрос'
      });
    }

    if (admin.security_answer.toLowerCase() !== answer.trim().toLowerCase()) {
      return res.status(401).json({ error: 'Грешен отговор' });
    }

    res.json({
      message: 'Отговорът е верен',
      password: admin.password
    });
  } catch (error) {
    console.error('Грешка при възстановяване:', error);
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});
router.get('/my-security-question', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT security_question, security_answer FROM admins WHERE id = $1',
      [req.user.id]
    );
    res.json({
      question: result.rows[0]?.security_question || null,
      answer: result.rows[0]?.security_answer || null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Сървърна грешка' });
  }
});
export default router;