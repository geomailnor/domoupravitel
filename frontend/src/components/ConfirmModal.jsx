import { useRef, useEffect } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import './ConfirmModal.css';

export default function ConfirmModal({
  title,
  message,
  confirmText = 'Да',
  cancelText = 'Отказ',
  confirmColor = 'danger',   // 'danger' | 'primary' | 'success'
  onConfirm,
  onCancel,
}) {
  const modalRef = useRef(null);
  useFocusTrap(modalRef, true);

  // ESC за отказ
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

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

  return (
    <div className="confirm-overlay">
      <div className="confirm-modal" ref={modalRef}>
        <button
          type="button"
          className="confirm-close"
          onClick={onCancel}
          title="Затвори"
        >
          ×
        </button>

        <div className="confirm-icon">
          {confirmColor === 'danger' ? '⚠️' : confirmColor === 'success' ? '✓' : '❓'}
        </div>
        ...

        <h3 className="confirm-title">{title}</h3>

        <p className="confirm-message">{message}</p>

        <div className="confirm-actions">
          <button
            type="button"
            className="confirm-btn confirm-cancel"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`confirm-btn confirm-${confirmColor}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}