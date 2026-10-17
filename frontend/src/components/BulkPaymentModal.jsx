import { useRef, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api.js';
import Spinner from './Spinner.jsx';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import './BulkPaymentModal.css';

const getCurrentMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export default function BulkPaymentModal({ onClose }) {
  const [apartments, setApartments] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState('list');   // 'list' или 'grid'
  const modalRef = useRef(null);

  useFocusTrap(modalRef, true);
  const [formData, setFormData] = useState({
    month: getCurrentMonth(),
    amount: '7.00',
    type: 'monthly',
  });

  // Зареждане на апартаментите
  useEffect(() => {
    const loadApartments = async () => {
      try {
        const response = await api.get('/apartments');
        setApartments(response.data);

        // Всички маркирани по подразбиране
        const initialSelected = {};
        response.data.forEach(apt => {
          initialSelected[apt.id] = true;
        });
        setSelected(initialSelected);
      } catch (err) {
        const message = err.response?.data?.error || 'Грешка при зареждане';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    loadApartments();
  }, []);

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

  const toggleApartment = (id) => {
    setSelected(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const toggleAll = (value) => {
    const newSelected = {};
    apartments.forEach(apt => {
      newSelected[apt.id] = value;
    });
    setSelected(newSelected);
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const allSelected = selectedCount === apartments.length && apartments.length > 0;

  const handleSave = async () => {
    if (selectedCount === 0) {
      toast.error('Не сте избрали нито един апартамент');
      return;
    }

    if (!formData.month) {
      toast.error('Изберете месец');
      return;
    }

    const amountNum = parseFloat(formData.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Въведете валидна сума');
      return;
    }

    setSaving(true);

    try {
      // Строим масива от плащания
      const payments = apartments
        .filter(apt => selected[apt.id])
        .map(apt => ({
          apartment_number: apt.number,
          month: formData.month,
          amount: amountNum,
          type: formData.type,
          status: 'paid',
        }));

      const response = await api.post('/payments/bulk', { payments });

      const { created } = response.data;

      toast.success(
        created === 1 ? 'Създадено 1 плащане' : `Създадени ${created} плащания`
      );
      // Затвори модала
      onClose();

    } catch (err) {
      const message = err.response?.data?.error || 'Грешка при запазване';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };
  const apartmentsByFloor = apartments.reduce((acc, apt) => {
    if (!acc[apt.floor]) acc[apt.floor] = [];
    acc[apt.floor].push(apt);
    return acc;
  }, {});
  return (
    <div className="modal-overlay">
      <div className="modal-content bulk-modal" ref={modalRef}>
        <div className="modal-header">
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <h2>⚡ Бързо въвеждане на плащания</h2>
          <p className="modal-subtitle">
            Изберете месец, сума и махнете чекчетата на неплатилите
          </p>

          <div className="bulk-form">
            <div className="form-row">
              <label htmlFor="bulk-month">Месец:</label>
              <input
                id="bulk-month"
                type="month"
                value={formData.month}
                onChange={(e) => setFormData({ ...formData, month: e.target.value })}
              />
            </div>

            <div className="form-row">
              <label htmlFor="bulk-amount">Сума (€):</label>
              <input
                id="bulk-amount"
                type="text"
                inputMode="decimal"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                onFocus={(e) => e.target.select()}
                onBlur={(e) => {
                  const num = parseFloat(e.target.value);
                  if (!isNaN(num)) {
                    setFormData({ ...formData, amount: num.toFixed(2) });
                  }
                }}
              />
            </div>

            <div className="form-row">
              <label htmlFor="bulk-type">Вид:</label>
              <select
                id="bulk-type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="monthly">Месечна такса</option>
                <option value="other">Друго</option>
              </select>
            </div>
          </div>

          <div className="bulk-actions-row">
            <button
              type="button"
              className="bulk-action-btn"
              onClick={() => toggleAll(!allSelected)}
              disabled={loading}
            >
              {allSelected ? 'Изчисти всички' : 'Маркирай всички'}
            </button>
            <button
              type="button"
              className="bulk-action-btn bulk-view-toggle"
              onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
              disabled={loading}
            >
              {viewMode === 'list' ? 'По етажи' : 'По списък'}
            </button>
            <span className="bulk-count-inline">
              Избрани: <strong>{selectedCount}</strong> от {apartments.length}
            </span>
          </div>

          {loading ? (
            <Spinner size="small" />
          ) : viewMode === 'list' ? (
            <div className="bulk-list">
              {apartments.map(apt => (
                <label
                  key={apt.id}
                  className={`bulk-item ${selected[apt.id] ? 'bulk-item-selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={!!selected[apt.id]}
                    onChange={() => toggleApartment(apt.id)}
                  />
                  <span className="bulk-item-number">Ап. {apt.number}</span>
                  <span className="bulk-item-owner">{apt.owner_name || '—'}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="bulk-grid">
              {Object.entries(apartmentsByFloor)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(([floor, apts]) => (
                  <div key={floor} className="bulk-floor-row">
                    <span className="bulk-floor-label">Етаж {floor}:</span>
                    <div className="bulk-floor-apts">
                      {apts
                        .sort((a, b) => a.number - b.number)
                        .map(apt => (
                          <label
                            key={apt.id}
                            className={`bulk-floor-item ${selected[apt.id] ? 'bulk-floor-item-selected' : ''}`}
                            title={apt.owner_name || `Апартамент ${apt.number}`}
                          >
                            <input
                              type="checkbox"
                              checked={!!selected[apt.id]}
                              onChange={() => toggleApartment(apt.id)}
                            />
                            <span>ап.{apt.number}</span>
                          </label>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="cancel-btn"
              onClick={onClose}
            >
              Отказ
            </button>
            <button
              type="button"
              className="save-btn"
              onClick={handleSave}
              disabled={saving || selectedCount === 0}
            >
              {saving ? (
                <>
                  <span className="spinner-button"></span>
                  <span>Запазване... ({selectedCount})</span>
                </>
              ) : (
                `Запази ${selectedCount} плащания`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}