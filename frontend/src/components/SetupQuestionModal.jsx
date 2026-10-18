import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api.js';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import './SetupQuestionModal.css';

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

export default function SetupQuestionModal({ onComplete }) {
  // 1. Избираме първия въпрос по подразбиране
  const [question, setQuestion] = useState(COMMON_QUESTIONS[0]);
  // 2. Слагаме примерен отговор, за да е по-ясно
  const [answer, setAnswer] = useState('bobi');
  const [saving, setSaving] = useState(false);

  const modalRef = useRef(null);
  const answerInputRef = useRef(null); // реф, за да маркираме текста

  useFocusTrap(modalRef, true);

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

  // 3. Автоматично маркиране на примерния текст при отваряне
  useEffect(() => {
    if (answerInputRef.current) {
      answerInputRef.current.focus();
      answerInputRef.current.select(); // маркира целия текст, за да се презапише лесно
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!answer || answer.trim().length < 2) {
      toast.error('Отговорът трябва да е поне 2 символа');
      return;
    }
    setSaving(true);
    try {
      await api.post('/auth/set-security-question', {
        question,
        answer: answer.trim(),
      });
      toast.success('Таен въпрос е зададен!');
      onComplete();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Грешка');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content setup-question-modal" ref={modalRef}>
        <div className="modal-body">
          <h2>Задайте таен въпрос</h2>
          <p className="modal-subtitle">
            Това е задължително. Ще ви трябва при забравена парола.
          </p>

          <form onSubmit={handleSubmit} className="setup-question-form">
            <div className="form-row">
              <label htmlFor="setup-question">Изберете въпрос:</label>
              <select
                id="setup-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              >
                {COMMON_QUESTIONS.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <label htmlFor="setup-answer">Отговор:</label>
              <input
                id="setup-answer"
                ref={answerInputRef}
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                required
                minLength={2}
                maxLength={200}
                placeholder="Вашият отговор"
              />
            </div>

            <p className="setup-note">
              ⚠️ Запомнете отговора! Ще ви трябва при забравена парола.
            </p>

            <div className="modal-actions">
              <button type="submit" className="save-btn" disabled={saving}>
                {saving ? 'Запазване...' : 'Запази и продължи'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}