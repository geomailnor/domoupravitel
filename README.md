# 🏢 Домоуправител – Техническа документация

Уеб приложение за управление на плащания и разходи в апартаментна сграда.

**Стек:** React + Vite (frontend) · Node.js + Express (backend) · PostgreSQL (Neon)

---

## 📋 Съдържание

1. [Архитектура](#архитектура)
2. [Инсталация (локално)](#инсталация-локално)
3. [Environment променливи](#environment-променливи)
4. [База данни](#база-данни)
5. [Backend API](#backend-api)
6. [Frontend структура](#frontend-структура)
7. [Seed и демо данни](#seed-и-демо-данни)
8. [Скриптове](#скриптове)
9. [Деплой](#деплой)
10. [Известни особености](#известни-особености)

---

## Архитектура

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Frontend   │─────▶│   Backend   │─────▶│  PostgreSQL │
│  (Vercel)   │      │  (Render)   │      │   (Neon)    │
└─────────────┘      └─────────────┘      └─────────────┘
   React+Vite         Express+Node          Cloud DB
```

- **Frontend** – React 18 + Vite. Хоства се на Vercel (планирано).
- **Backend** – Express 5 (ESM). Хоства се на Render (планирано).
- **База данни** – PostgreSQL в Neon (cloud).

---

## Инсталация (локално)

### Изисквания
- Node.js 18+
- npm
- PostgreSQL (или Neon акаунт)

### 1. Клонирай проекта

```bash
git clone <repo-url>
cd domoupravitel
```

### 2. Backend

```bash
cd backend
npm install
```

Създай `.env` (виж [Environment променливи](#environment-променливи)).

```bash
npm run dev
```

Сървърът слуша на `http://localhost:10000`.

### 3. Frontend

```bash
cd frontend
npm install
```

Създай `.env`:

```
VITE_API_URL=http://localhost:10000/api
```

```bash
npm run dev
```

Frontend-ът слуша на `http://localhost:5173`.

---

## Environment променливи

### `backend/.env`

```env
DATABASE_URL=postgresql://user:password@host/db?sslmode=require
JWT_SECRET=your_secret_here
PORT=10000
FRONTEND_URL=http://localhost:5173
```

- **`DATABASE_URL`** – connection string към PostgreSQL (Neon).
- **`JWT_SECRET`** – таен ключ за JWT (30 дни валидност).
- **`PORT`** – порт на сървъра.
- **`FRONTEND_URL`** – URL на frontend-а (за CORS). Може да е няколко, разделени със запетая.

### `frontend/.env`

```env
VITE_API_URL=http://localhost:10000/api
```

- **`VITE_API_URL`** – URL на backend-а. **Включва `/api`**.

**Внимание:** Всички axios заявки в кода са **без** `/api` (напр. `api.get('/payments')`), защото `baseURL` вече го съдържа.

---

## База данни

### Таблици (5)

#### `block_params`
Параметри на блока.
- `name` (VARCHAR(50) PRIMARY KEY)
- `value` (VARCHAR(100) NOT NULL)

**Записи:** `monthly_fee='7.00'`, `manager_fee='3.00'`, `start_month='YYYY-MM'`.

#### `apartments`
90 апартамента.
- `id` (SERIAL PRIMARY KEY)
- `number` (INTEGER UNIQUE, 1–90)
- `floor` (INTEGER, 1–15)
- `owner_name`, `phone`, `notes`
- `password` (VARCHAR(50) – plain text, съзнателно решение)
- `password_changed_at`, `must_change_password`, `created_at`

#### `payments`
Плащания.
- `id`, `ap_id` (FK), `month` (CHAR(7)), `amount` (NUMERIC), `type`, `description`, `status`, `confirmed_at`, `created_at`
- **Уникален индекс:** `(ap_id, month, type) WHERE type != 'other'`

#### `expenses`
Разходи (не се използва в момента, но е налична).
- `id`, `date`, `amount`, `type`, `description`, `created_at`

#### `admins`
Администратор.
- `id`, `username` (UNIQUE), `password`, `apartment_id` (FK), `security_question`, `security_answer`, `created_at`

---

## Backend API

### Auth (`/api/auth`)
- `POST /login` – вход (admin или resident)
- `GET /me` – информация за логнатия
- `POST /change-password` – смяна на парола
- `POST /change-username` – смяна на потребителско име (admin)
- `POST /reset-password/:number` – нулиране на парола на жилец (admin)
- `POST /set-security-question` – задаване на таен въпрос (admin)
- `POST /get-security-question` – връща въпроса по username (публичен)
- `POST /reset-with-answer` – проверява отговора и връща старата парола (публичен)

### Apartments (`/api/apartments`)
- `GET /` – всички (admin)
- `GET /:number` – един (admin)
- `PUT /:number` – редакция (admin)

### Payments (`/api/payments`)
- `GET /` – списък с филтри (admin)
- `GET /me` – моите плащания (resident/admin)
- `POST /` – ново плащане (admin)
- `POST /bulk` – много плащания в транзакция (admin)
- `PUT /:id` – обновяване (admin)
- `DELETE /:id` – изтриване (admin)

### Expenses (`/api/expenses`)
- CRUD (admin) – **не се използва**

### Settings (`/api/settings`)
- `GET /` – `monthly_fee`, `manager_fee`, `start_month` (с авто-корекция на `start_month` при нова година)

### Reports (`/api/reports`)
- `GET /apartment/:number` – индивидуална бележка
- `GET /monthly?month=YYYY-MM` – месечен отчет

### Health
- `GET /api/health` – тества дали сървърът работи

---

## Frontend структура

```
frontend/src/
├── main.jsx              # Входна точка
├── App.jsx               # Рутинг
├── api.js                # Axios + interceptors
├── authContext.js        # Context
├── AuthProvider.jsx      # Auth state
├── useAuth.js            # Hook
├── global.css            # Глобални стилове
├── assets/               # Лога, README за админа
├── components/
│   ├── ApartmentModal.jsx + .css
│   ├── BulkPaymentModal.jsx + .css
│   ├── ChangePasswordModal.jsx + .css
│   ├── ConfirmModal.jsx + .css
│   ├── ForgotPasswordModal.jsx + .css
│   ├── HelpModal.jsx + .css
│   ├── ProfileModal.jsx + .css
│   ├── ProtectedRoute.jsx
│   ├── Spinner.jsx + .css
│   └── i18n/
│       ├── bg.js
│       └── translate.js
├── hooks/
│   └── useFocusTrap.js
└── pages/
    ├── AdminDashboard.jsx + .css
    ├── Dashboard.css
    ├── Login.jsx + .css
    └── ResidentView.jsx + .css
```

---

## Seed и демо данни

### `seed.js` (задължителен)
Създава:
- 3 `block_params` записа.
- 90 апартамента (случайни пароли).
- 1 админ (`admin / doremisi`).

**Пуска се автоматично** при стартиране на backend-а, ако базата е празна.

### `seed-demo.js` (по избор)
Добавя:
- 80 имена на собственици.
- 540 `monthly` плащания (6 месеца × 90 апартамента, **без текущия**).
- 15 `other` плащания.
- Обновява `start_month`.

**Пуска се ръчно:**
```bash
cd backend
node src/seed-demo.js
```

---

## Скриптове

### Backend (`backend/package.json`)
```json
"scripts": {
  "start": "node src/index.js",
  "dev": "nodemon src/index.js"
}
```

### Frontend (`frontend/package.json`)
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "lint": "eslint ."
}
```

---

## Деплой

### Backend → Render

1. Създай **Web Service** в Render.
2. Свържи GitHub repo.
3. **Root Directory:** `backend`
4. **Build Command:** `npm install`
5. **Start Command:** `npm start`
6. **Environment Variables:**
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `PORT=10000`
   - `FRONTEND_URL=https://<vercel-app>.vercel.app`

**Внимание:** Render Free tier спи след 15 мин неактивност → ~1 мин cold start.

### Frontend → Vercel

1. Създай **Project** във Vercel.
2. Свържи GitHub repo.
3. **Root Directory:** `frontend`
4. **Framework Preset:** Vite
5. **Build Command:** `npm run build`
6. **Output Directory:** `dist`
7. **Environment Variables:**
   - `VITE_API_URL=https://<render-app>.onrender.com/api`

---

## Известни особености

### Дължими месеци
- От `start_month` до **предишния** месец (не текущия).
- Ако днес е 16 октомври → брои до септември.

### `start_month` – автоматична смяна
- При GET `/api/settings` – ако `start_month` е от минала година → **записва** `YYYY-01` в базата.
- Връща новия.

### `partial` плащания
- `partial` = частично платено.
- Дължимо = `7 € - платено`.
- Показва се отделно от `unpaid`.

### `other` плащания
- Тип `other` = допълнителен разход.
- Не участва в брояча на месеците.
- Добавя се към общия дълг.

### Типове в UI
- **`payments`:** само `monthly` + `other`.
- **Backend:** приема всички (`monthly`, `elevator`, `water`, `cleaning`, `door`, `intercom`, `electricity`, `other`) за съвместимост.

### Фокус в preview на печат
- Браузърът отваря **отделен прозорец** за preview.
- Нашият `useFocusTrap` **не работи** там.
- **Не е бъг** – ограничение на браузъра.

### Два таба (admin + resident)
- Не може да си логнат като двама едновременно.
- `Login.jsx` проверява дали има `domoupravitel_token` и показва грешка.
- `/login` автоматично пренасочва, ако си логнат.

### `react-hot-toast` close button
- `closeButton` prop **не съществува** във v2.6.1.
- Решение: `ToastBar` + render function + `toast.dismiss(t.id)`.
- Стил `.toast-close-btn` в `global.css`.

### Парола на админа
- `seed.js`: `ADMIN_PASSWORD = 'doremisi'`.
- Съществуващ админ → ръчно `UPDATE admins SET password = '...'`.

---

## 📞 Контакти

За въпроси – имейл geomail@abv.bg.

**Приятна работа!** 🏢