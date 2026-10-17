import { useRef, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api.js';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import './ForgotPasswordModal.css';

export default function ForgotPasswordModal({ onClose }) {
  const [step, setStep] = useState(1);   // 1 = username, 2 = answer, 3 = password
  const [username, setUsername] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const modalRef = useRef(null);
  const firstInputRef = useRef(null);

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

  // Фокус при смяна на стъпка
  useEffect(() => {
    firstInputRef.current?.focus();
  }, [step]);

  const handleSubmitUsername = async (e) => {
    e.preventDefault();

    if (!username.trim()) {
      toast.error('Въведете потребителско име');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/get-security-question', {
        username: username.trim(),
      });
      setQuestion(response.data.question);
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Грешка');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswer = async (e) => {
    e.preventDefault();

    if (!answer.trim()) {
      toast.error('Въведете отговор');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/reset-with-answer', {
        username: username.trim(),
        answer: answer.trim(),
      });
      setPassword(response.data.password);
      setStep(3);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Грешка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content forgot-password-modal" ref={modalRef}>
        <div className="modal-header">
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <h2>Забравена парола</h2>

          {step === 1 && (
            <>
              <p className="modal-subtitle">Въведете потребителското си име</p>
              <form onSubmit={handleSubmitUsername} className="forgot-form">
                <div className="form-row">
                  <label htmlFor="forgot-username">Потребителско име:</label>
                  <input
                    id="forgot-username"
                    ref={firstInputRef}
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="cancel-btn" onClick={onClose}>
                    Отказ
                  </button>
                  <button type="submit" className="save-btn" disabled={loading}>
                    {loading ? 'Зареждане...' : 'Продължи'}
                  </button>
                </div>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <p className="modal-subtitle">Отговорете на въпроса</p>
              <form onSubmit={handleSubmitAnswer} className="forgot-form">
                <div className="form-row">
                  <label>Въпрос:</label>
                  <p className="security-question-display">{question}</p>
                </div>
                <div className="form-row">
                  <label htmlFor="forgot-answer">Отговор:</label>
                  <input
                    id="forgot-answer"
                    ref={firstInputRef}
                    type="text"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    required
                  />
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => { setStep(1); setAnswer(''); }}
                  >
                    Назад
                  </button>
                  <button type="submit" className="save-btn" disabled={loading}>
                    {loading ? 'Проверка...' : 'Провери'}
                  </button>
                </div>
              </form>
            </>
          )}

          {step === 3 && (
            <>
              <p className="modal-subtitle">Вашата парола е:</p>
              <div className="password-display">
                {password}
              </div>
              <p className="password-note">
                ⚠️ Запомнете си паролата! Можете да я смените от Профил → Парола.
              </p>
              <div className="modal-actions">
                <button type="button" className="save-btn" onClick={onClose}>
                  Разбрах
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}