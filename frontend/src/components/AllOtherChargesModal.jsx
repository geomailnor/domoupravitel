import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../api.js';
import Spinner from './Spinner.jsx';
import { monthLabel } from './i18n/translate.js';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import { useScrollLock } from '../hooks/useScrollLock.js';
import ConfirmModal from './ConfirmModal.jsx';
import '../pages/Dashboard.css';
import './ChargeDetailsModal.css';
import './AllOtherChargesModal.css';

export default function AllOtherChargesModal({ currentMonth, onClose }) {
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterStatus, setFilterStatus] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const [selectedCharges, setSelectedCharges] = useState({});
  const [statusConfirm, setStatusConfirm] = useState(null);

  const modalRef = useRef(null);

  useFocusTrap(modalRef, !loading);
  useScrollLock();

  useEffect(() => {
    const loadCharges = async () => {
      try {
        setLoading(true);
        const url = filterMonth
          ? `/payments?type=other&month=${filterMonth}`
          : `/payments?type=other`;
        const res = await api.get(url);
        setCharges(res.data);
      } catch {
        toast.error('Грешка при зареждане на таксите');
      } finally {
        setLoading(false);
      }
    };
    loadCharges();
  }, [filterMonth]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await api.get('/settings');
        setStartMonth(res.data.start_month || '');
      } catch {
        // игнорираме
      }
    };
    loadSettings();
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

  const toggleStatus = (id, currentStatus) => {
    if (currentStatus === 'paid') {
      setStatusConfirm({ id, currentStatus });
    } else {
      performToggleStatus(id, currentStatus);
    }
  };

  const performToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
    try {
      await api.put(`/payments/${id}`, { status: newStatus });
      toast.success(newStatus === 'paid' ? 'Маркирано като платено' : 'Маркирано като неплатено', { duration: 1000 });

      const url = filterMonth
        ? `/payments?type=other&month=${filterMonth}`
        : `/payments?type=other`;
      const res = await api.get(url);
      setCharges(res.data);
    } catch {
      toast.error('Грешка при промяна на статуса');
    }
  };

  const markSelectedAsPaid = async () => {
    const ids = Object.keys(selectedCharges).filter(id => selectedCharges[id]);
    if (ids.length === 0) {
      toast.error('Не сте избрали такси');
      return;
    }

    try {
      for (const id of ids) {
        await api.put(`/payments/${id}`, { status: 'paid' });
      }
      toast.success(`Маркирани ${ids.length} такси като платени`);
      setSelectedCharges({});

      const url = filterMonth
        ? `/payments?type=other&month=${filterMonth}`
        : `/payments?type=other`;
      const res = await api.get(url);
      setCharges(res.data);
    } catch {
      toast.error('Грешка при маркиране');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content all-other-modal-content" ref={modalRef}>
        <div className="modal-header">
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <h2 className="all-other-title">
            {filterMonth
              ? `Допълнителни такси за ${monthLabel(filterMonth)}`
              : 'Всички допълнителни такси'}
            {filterStatus === 'paid' && ' (платени)'}
            {filterStatus === 'unpaid' && ' (неплатени)'}
          </h2>

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
                    <th>
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            const newSelected = {};
                            filteredCharges.forEach(c => {
                              if (c.status === 'unpaid') newSelected[c.id] = true;
                            });
                            setSelectedCharges(newSelected);
                          } else {
                            setSelectedCharges({});
                          }
                        }}
                        title="Маркирай всички"
                      />
                    </th>
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
                      <td>
                        <input
                          type="checkbox"
                          checked={!!selectedCharges[c.id]}
                          disabled={c.status === 'paid'}
                          onChange={(e) => {
                            setSelectedCharges(prev => ({
                              ...prev,
                              [c.id]: e.target.checked
                            }));
                          }}
                        />
                      </td>
                      <td>{c.apartment_number}</td>
                      <td title={c.owner_name || ''}>{c.owner_name || '—'}</td>
                      <td title={monthLabel(c.month)}>{monthLabel(c.month)}</td>
                      <td className="text-right" title={`${parseFloat(c.amount).toFixed(2)} €`}>{parseFloat(c.amount).toFixed(2)} €</td>
                      <td title={c.description || ''}>{c.description || '—'}</td>
                      <td>
                        <button
                          className={`status-btn ${c.status === 'paid' ? 'paid' : 'unpaid'}`}
                          onClick={() => toggleStatus(c.id, c.status)}
                          title={c.status === 'paid' ? 'Маркирай като неплатено' : 'Маркирай като платено'}
                        >
                          {c.status === 'paid' ? 'Плат.' : 'Непл.'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="modal-actions">
            <button className="close-btn" onClick={onClose}>Затвори</button>
            <button
              className="save-btn"
              onClick={markSelectedAsPaid}
              disabled={Object.keys(selectedCharges).filter(id => selectedCharges[id]).length === 0}
            >
              Маркирай избраните като платени
            </button>
          </div>
          {statusConfirm && (
            <ConfirmModal
              title="Връщане на статус"
              message="Сигурни ли сте, че искате да маркирате тази такса като НЕПЛАТЕНО?"
              confirmText="Да, върни"
              cancelText="Отказ"
              confirmColor="danger"
              onConfirm={() => {
                performToggleStatus(statusConfirm.id, statusConfirm.currentStatus);
                setStatusConfirm(null);
              }}
              onCancel={() => setStatusConfirm(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}