import { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import readmeContent from '../assets/README.md?raw';
import './HelpModal.css';

export default function HelpModal({ onClose }) {
  const modalRef = useRef(null);

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

  return (
    <div className="modal-overlay">
      <div className="modal-content help-modal" ref={modalRef}>
        <div className="modal-header">
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="help-content">
            <ReactMarkdown
              components={{
                h1: ({ children }) => {
                  const id = String(children).toLowerCase().replace(/\s+/g, '-').replace(/[^\wа-яА-Я-]/g, '');
                  return <h1 id={id}>{children}</h1>;
                },
                h2: ({ children }) => {
                  const id = String(children).toLowerCase().replace(/\s+/g, '-').replace(/[^\wа-яА-Я-]/g, '');
                  return <h2 id={id}>{children}</h2>;
                },
                h3: ({ children }) => {
                  const id = String(children).toLowerCase().replace(/\s+/g, '-').replace(/[^\wа-яА-Я-]/g, '');
                  return <h3 id={id}>{children}</h3>;
                },
              }}
            >
              {readmeContent}
            </ReactMarkdown>
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Затвори
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}