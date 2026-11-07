import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../api.js';
import Spinner from './Spinner.jsx';
import { monthLabel } from './i18n/translate.js';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import { useScrollLock } from '../hooks/useScrollLock.js';
import '../pages/Dashboard.css';
import './ChargeDetailsModal.css';
import './AllOtherChargesModal.css';

export default function AllOtherChargesModal({ onClose }) {
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const modalRef = useRef(null);

  useFocusTrap(modalRef, !loading);
  useScrollLock();

  useEffect(() => {
    const loadCharges = async () => {
      try {
        const [chargesRes, settingsRes] = await Promise.all([
          api.get('/payments?type=other'),
          api.get('/settings')
        ]);
        setCharges(chargesRes.data);
        setStartMonth(settingsRes.data.start_month || '');
      } catch {
        toast.error('Грешка при зареждане на таксите');
      } finally {
        setLoading(false);
      }
    };
    loadCharges();
  }, []);
  const filteredCharges = charges.filter(c => {
    if (filterMonth && c.month !== filterMonth) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    return true;
  });

  const generateMonths = () => {
    if (!startMonth) return [];

    const months = [];
    const monthNames = {
      '01': 'Януари', '02': 'Февруари', '03': 'Март', '04': 'Април',
      '05': 'Май', '06': 'Юни', '07': 'Юли', '08': 'Август',
      '09': 'Септември', '10': 'Октомври', '11': 'Ноември', '12': 'Декември'
    };

    let [year, month] = startMonth.split('-').map(Number);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthNum = now.getMonth() + 1;

    // Генерираме от startMonth до текущия + 12 месеца
    let endYear = currentYear;
    let endMonthNum = currentMonthNum + 12;
    if (endMonthNum > 12) {
      endMonthNum -= 12;
      endYear += 1;
    }

    while (year < endYear || (year === endYear && month <= endMonthNum)) {
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      months.push({
        value: monthStr,
        label: `${monthNames[String(month).padStart(2, '0')]} ${year}`
      });
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }
    return months;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" ref={modalRef} style={{ maxWidth: '800px' }}>
        <div className="modal-header">
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <h2 className="all-other-title">Всички допълнителни такси</h2>

          <div className="filters-row" style={{ marginBottom: '1rem' }}>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="floor-select"
            >
              <option value="">Всички месеци</option>
              {generateMonths().map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="floor-select"
            >
              <option value="">Всички статуси</option>
              <option value="paid">Платени</option>
              <option value="unpaid">Неплатени</option>
            </select>
            {(filterMonth || filterStatus) && (
              <button
                className="clear-filters-btn"
                onClick={() => { setFilterMonth(''); setFilterStatus(''); }}
              >
                Изчисти филтрите
              </button>
            )}
          </div>
          {loading ? (
            <Spinner size="small" />
          ) : filteredCharges.length === 0 ? (
            <div className="no-results">Няма намерени такси</div>
          ) : (
            <div className="table-wrapper">
              <table className="payments-table other-table all-other-table">
                <thead>
                  <tr>
                    <th>Ап. №</th>
                    <th>Собственик</th>
                    <th>Месец</th>
                    <th>Сума</th>
                    <th>Описание</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCharges.map((c) => (
                    <tr key={c.id}>
                      <td>{c.apartment_number}</td>
                      <td>{c.owner_name || '—'}</td>
                      <td>{monthLabel(c.month)}</td>
                      <td className="text-right">{parseFloat(c.amount).toFixed(2)} €</td>
                      <td>{c.description || '—'}</td>
                      <td className={`status-${c.status}`}>
                        {c.status === 'paid' ? 'Плат.' : 'Непл.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="modal-actions">
            <button className="close-btn" onClick={onClose}>Затвори</button>
          </div>
        </div>
      </div>
    </div>
  );
}