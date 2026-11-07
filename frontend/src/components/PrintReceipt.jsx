import { monthLabel } from './i18n/translate.js';
import { useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import './PrintReceipt.css';

export default function PrintReceipt({ apartment, month, amount, onClose }) {
  const currentYear = new Date().getFullYear();
  const modalRef = useRef(null);
  useFocusTrap(modalRef, true);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="print-overlay" ref={modalRef}>
      <div className="print-controls">
        <button className="btn-print" onClick={handlePrint}>
          🖨️ Разпечатай
        </button>
        <button className="btn-close" onClick={onClose}>
          ✕ Затвори
        </button>
      </div>

      <div className="print-area">
        <div className="receipt">
          <h2 className="receipt-title">РАЗПИСКА</h2>
          <p className="receipt-subtitle">за платена месечна такса</p>
          <p className="receipt-block">блок "Зора"</p>

          <div className="receipt-info">
            <div className='et-ap-wrapper'>
              <p><em>Етаж:</em> <strong>{apartment.floor}</strong></p>
              <p><em>Апартамент:</em> <strong>{apartment.ap_number || apartment.number}</strong></p>
            </div>

            <p><em>Собственик:</em> <strong>{apartment.owner_name || '—'}</strong></p>
          </div>

          <div className="receipt-details">
            <p><em>За месец:</em> <strong>{monthLabel(month)}</strong></p>
            <p><em>Сума:</em> <strong>{amount ? `${amount} €` : <span className="amount-line"></span>}</strong></p>
          </div>

          <p className="receipt-date">Дата: <span className="line-underline"></span>.<span className="line-underline"></span>. {currentYear} г.</p>

          <div className="receipt-signatures">
            <div>
              <p>Домоуправител:</p>
              <p className="signature-line"></p>
            </div>
            <div>
              <p>Живущ:</p>
              <p className="signature-line"></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}