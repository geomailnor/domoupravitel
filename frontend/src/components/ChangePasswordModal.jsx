import { useRef, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api.js';
import oko1 from '../assets/oko1.png';
import oko2 from '../assets/oko2.png';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import './ChangePasswordModal.css';

export default function ChangePasswordModal({ onClose }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const firstInputRef = useRef(null);
  const modalRef = useRef(null);

  // Фокус при отваряне
  useFocusTrap(modalRef, true, firstInputRef);

  // ESC за затваряне
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Провери само празни полета (за да не пращаме излишни заявки)
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error('Попълнете всички полета');
      return;
    }

    setSaving(true);

    try {
      await api.post('/auth/change-password', {
        oldPassword,
        newPassword,
        confirmPassword,    // ← пращаме го, за да го провери сървъра
      });

      toast.success('Паролата е сменена успешно');
      onClose();
    } catch (err) {
      const message = err.response?.data?.error || 'Грешка при смяна на паролата';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content change-password-modal" ref={modalRef}>
        <div className="modal-header">
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <h2>Смяна на парола</h2>
          <p className="modal-subtitle">Въведете старата и новата си парола</p>

          <form onSubmit={handleSubmit} className="password-form">
            <div className="form-row">
              <label htmlFor="old-password">Стара парола:</label>
              <div className="password-field">
                <input
                  id="old-password"
                  ref={firstInputRef}
                  type={showPassword ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Скрий паролите' : 'Покажи паролите'}
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
              <button
                type="button"
                className="cancel-btn"
                onClick={onClose}
              >
                Отказ
              </button>
              <button
                type="submit"
                className="save-btn"
                disabled={saving}
              >
                {saving ? 'Запазване...' : 'Запази'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}