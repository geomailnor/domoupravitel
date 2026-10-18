import { useRef, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api.js';
import { useAuth } from '../useAuth.js';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import Spinner from './Spinner.jsx';
import oko1 from '../assets/oko1.png';
import oko2 from '../assets/oko2.png';
import './ProfileModal.css';

const COMMON_QUESTIONS = [
  'Име на първото ми домашно животно',
  'Любим актьор',
  'Любим певец',
  'Име на първия ми учител',
  'Любим град',
  'Любимо ястие',
  'Име на най-добрия ми приятел от детството',
  'Марка на първата ми кола',
  'Любим футболен отбор',
];

export default function ProfileModal({ onClose }) {
  const { user, token, login } = useAuth();
  const modalRef = useRef(null);
  const [activeTab, setActiveTab] = useState('username');
  const [apartments, setApartments] = useState([]);
  const [loadingApartments, setLoadingApartments] = useState(true);
  const [searchPasswords, setSearchPasswords] = useState('');
  const [showPasswords, setShowPasswords] = useState(true);

  // Username
  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [savingUsername, setSavingUsername] = useState(false);

  // Password
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Security question
  const [answer, setAnswer] = useState('');
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState(null);
  const [selectedNewQuestion, setSelectedNewQuestion] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(null);

  const [showPassword, setShowPassword] = useState(false);

  useFocusTrap(modalRef, true);

  // ESC
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    const loadQuestion = async () => {
      try {
        const res = await api.get('/auth/my-security-question');
        setCurrentQuestion(res.data.question);
        setCurrentAnswer(res.data.answer);

        if (res.data.answer) {
          setAnswer(res.data.answer);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadQuestion();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get('/apartments');
        setApartments(response.data);
      } catch (err) {
        console.error('Грешка при зареждане:', err);
      } finally {
        setLoadingApartments(false);
      }
    };
    load();
  }, []);
  // Блокиране на скрола
  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  const handleSaveUsername = async (e) => {
    e.preventDefault();

    if (!newUsername || newUsername.trim().length < 3) {
      toast.error('Потребителското име трябва да е поне 3 символа');
      return;
    }

    if (newUsername.trim() === user?.username) {
      toast('Няма промени за запазване', { icon: 'ℹ️', duration: 1200 });
      onClose();
      return;
    }

    setSavingUsername(true);
    try {
      const response = await api.post('/auth/change-username', {
        newUsername: newUsername.trim(),
      });
      toast.success('Потребителското име е сменено');
      localStorage.setItem('domoupravitel_last_username', response.data.username);
      login({ ...user, username: response.data.username }, token);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Грешка');
    } finally {
      setSavingUsername(false);
    }
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();

    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error('Попълнете всички полета');
      return;
    }

    setSavingPassword(true);
    try {
      await api.post('/auth/change-password', {
        oldPassword,
        newPassword,
        confirmPassword,
      });
      toast.success('Паролата е сменена');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Грешка');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSaveQuestion = async (e) => {
    e.preventDefault();

    // 1. Определяме кой въпрос да ползваме (новия, ако е избран, или стария)
    const finalQuestion = selectedNewQuestion || currentQuestion;

    // 2. Отговорът е това, което е в полето в момента
    const finalAnswer = answer;

    // 3. Проверки
    if (!finalQuestion) {
      toast.error('Трябва да изберете въпрос');
      return;
    }
    if (!finalAnswer || !finalAnswer.trim()) {
      toast.error('Трябва да въведете отговор');
      return;
    }

    // 4. Ако нищо не е променено -> просто затваряме
    if (finalQuestion === currentQuestion && finalAnswer === currentAnswer) {
      onClose();
      return;
    }

    // 5. Записваме
    setSavingQuestion(true);
    try {
      await api.post('/auth/set-security-question', {
        question: finalQuestion,
        answer: finalAnswer.trim(),
      });
      toast.success('Въпросът/отговорът е запазен');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Грешка');
    } finally {
      setSavingQuestion(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content profile-modal" ref={modalRef}>
        <div className="modal-header">
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <h2>Профил</h2>
          <p className="modal-subtitle">Управление на вашия акаунт</p>

          <div className="profile-tabs">
            <button
              className={`profile-tab ${activeTab === 'username' ? 'active' : ''}`}
              onClick={() => setActiveTab('username')}
            >
              Логин име
            </button>
            <button
              className={`profile-tab ${activeTab === 'password' ? 'active' : ''}`}
              onClick={() => setActiveTab('password')}
            >
              Смяна парола
            </button>
            <button
              className={`profile-tab ${activeTab === 'question' ? 'active' : ''}`}
              onClick={() => setActiveTab('question')}
            >
              Таен въпрос
            </button>
            <button
              className={`profile-tab ${activeTab === 'passwords' ? 'active' : ''}`}
              onClick={() => setActiveTab('passwords')}
            >
              Виж паролите
            </button>
          </div>

          {activeTab === 'username' && (
            <form onSubmit={handleSaveUsername} className="profile-form">
              <div className="form-row">
                <label htmlFor="new-username">Ново потребителско име:</label>
                <input
                  id="new-username"
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                  minLength={3}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={onClose}>
                  Затвори
                </button>
                <button type="submit" className="save-btn" disabled={savingUsername}>
                  {savingUsername ? 'Запазване...' : 'Запази'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handleSavePassword} className="profile-form">
              <div className="form-row">
                <label htmlFor="old-password">Стара парола:</label>
                <div className="password-field">
                  <input
                    id="old-password"
                    type={showPassword ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Скрий' : 'Покажи'}
                  >
                    <img src={showPassword ? oko1 : oko2} alt="" />
                  </button>
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="new-password">Нова парола:</label>
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="form-row">
                <label htmlFor="confirm-password">Потвърди новата парола:</label>
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={onClose}>
                  Затвори
                </button>
                <button type="submit" className="save-btn" disabled={savingPassword}>
                  {savingPassword ? 'Запазване...' : 'Запази'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'question' && (
            <form onSubmit={handleSaveQuestion} className="profile-form">

              {/* Показваме САМО текущия въпрос (без отговора) */}
              {currentQuestion && (
                <div className="current-question-info">
                  <p>Текущ въпрос: <strong>{currentQuestion}</strong></p>
                </div>
              )}

              {/* Падащо меню - празно по подразбиране */}
              <div className="form-row">
                <label htmlFor="question-select">Смени въпроса (по избор):</label>
                <select
                  id="question-select"
                  value={selectedNewQuestion}
                  onChange={(e) => setSelectedNewQuestion(e.target.value)}
                >
                  <option value="">-- Изберете нов въпрос --</option>
                  {COMMON_QUESTIONS.map((q) => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </div>

              {/* Полето за отговор - вече съдържа текущия отговор */}
              <div className="form-row">
                <label htmlFor="answer">Отговор:</label>
                <input
                  id="answer"
                  type="text"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={onClose}>
                  Затвори
                </button>
                <button type="submit" className="save-btn" disabled={savingQuestion}>
                  {savingQuestion ? 'Запазване...' : 'Запази'}
                </button>
              </div>
            </form>
          )}
          {activeTab === 'passwords' && (
            <div className="passwords-tab">
              <div className="passwords-controls">
                <input
                  type="text"
                  placeholder="Търсене по номер или име..."
                  value={searchPasswords}
                  onChange={(e) => setSearchPasswords(e.target.value)}
                  className="passwords-search"
                />
                {searchPasswords && (
                  <button
                    type="button"
                    onClick={() => setSearchPasswords('')}
                    className="clear-filters-btn"
                  >
                    Изчисти
                  </button>
                )}
                <button
                  type="button"
                  className="toggle-passwords-btn"
                  onClick={() => setShowPasswords(!showPasswords)}
                >
                  {showPasswords ? '👁️ Скрий' : '👁️ Покажи'}
                </button>
              </div>

              {loadingApartments ? (
                <Spinner size="small" />
              ) : (
                <div className="passwords-table-wrapper">
                  <table className="passwords-table">
                    <thead>
                      <tr>
                        <th>Ап.№</th>
                        <th>Етаж</th>
                        <th>Собственик</th>
                        <th>Парола</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apartments
                        .filter(apt => {
                          if (!searchPasswords.trim()) return true;
                          const term = searchPasswords.toLowerCase().trim();
                          return String(apt.number).includes(term) ||
                            (apt.owner_name || '').toLowerCase().includes(term);
                        })
                        .map(apt => (
                          <tr key={apt.id}>
                            <td><strong>{apt.number}</strong></td>
                            <td>{apt.floor}</td>
                            <td>{apt.owner_name || '—'}</td>
                            <td className="password-cell">
                              {showPasswords ? apt.password : '••••••••'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}