import { useRef, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api.js';
import { useAuth } from '../useAuth.js';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
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
  'Име на първия ми домашен любимец',
];

export default function ProfileModal({ onClose }) {
  const { user, token, login } = useAuth();
  const modalRef = useRef(null);
  const [activeTab, setActiveTab] = useState('username');

  // Username
  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [savingUsername, setSavingUsername] = useState(false);

  // Password
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Security question
  const [question, setQuestion] = useState(COMMON_QUESTIONS[0]);
  const [customQuestion, setCustomQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [savingQuestion, setSavingQuestion] = useState(false);

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
      toast.error('Новото потребителско име трябва да е различно от текущото');
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

    const finalQuestion = useCustom ? customQuestion.trim() : question;

    if (!finalQuestion || finalQuestion.length < 5) {
      toast.error('Въпросът трябва да е поне 5 символа');
      return;
    }

    if (!answer || answer.trim().length < 2) {
      toast.error('Отговорът трябва да е поне 2 символа');
      return;
    }

    setSavingQuestion(true);
    try {
      await api.post('/auth/set-security-question', {
        question: finalQuestion,
        answer: answer.trim(),
      });
      toast.success('Въпросът е запазен');
      setAnswer('');
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
              Потребителско име
            </button>
            <button
              className={`profile-tab ${activeTab === 'password' ? 'active' : ''}`}
              onClick={() => setActiveTab('password')}
            >
              Парола
            </button>
            <button
              className={`profile-tab ${activeTab === 'question' ? 'active' : ''}`}
              onClick={() => setActiveTab('question')}
            >
              Таен въпрос
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
              <div className="form-row">
                <label>
                  <input
                    type="checkbox"
                    checked={useCustom}
                    onChange={(e) => setUseCustom(e.target.checked)}
                  />
                  {' '}Собствен въпрос
                </label>
              </div>

              {useCustom ? (
                <div className="form-row">
                  <label htmlFor="custom-question">Въпрос:</label>
                  <input
                    id="custom-question"
                    type="text"
                    value={customQuestion}
                    onChange={(e) => setCustomQuestion(e.target.value)}
                    required
                    minLength={5}
                    maxLength={200}
                    placeholder="Напр. Как се казва първата ми котка?"
                  />
                </div>
              ) : (
                <div className="form-row">
                  <label htmlFor="question-select">Въпрос:</label>
                  <select
                    id="question-select"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                  >
                    {COMMON_QUESTIONS.map((q) => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-row">
                <label htmlFor="answer">Отговор:</label>
                <input
                  id="answer"
                  type="text"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  required
                  minLength={2}
                  maxLength={200}
                  placeholder="Вашият отговор"
                />
              </div>

              <p className="security-note">
                ⚠️ Запомнете отговора! Ще ви трябва при забравена парола.
              </p>

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
        </div>
      </div>
    </div>
  );
}