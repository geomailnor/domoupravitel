import { useRef, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api.js';
import Spinner from './Spinner.jsx';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import { useScrollLock } from '../hooks/useScrollLock.js';
import './BulkPaymentModal.css';

const getCurrentMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export default function BulkPaymentModal({ onClose, onUpdate }) {
  const [apartments, setApartments] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState('list');   // 'list' или 'grid'
  const modalRef = useRef(null);
  const [activeTab, setActiveTab] = useState('monthly'); // 'monthly' или 'other'

  // Данни за втория таб (други разходи)
  const [otherData, setOtherData] = useState({
    month: getCurrentMonth(),
    amount: '',
    description: '',
    status: 'unpaid',
  });
  useFocusTrap(modalRef, true);
  useScrollLock();

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
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 750) {
        setViewMode('list');   // принудително минаваме в списък
      }
    };

    handleResize();   // проверка при първоначално зареждане
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);
  // ESC за затваряне
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

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

  const apartmentsByFloor = apartments.reduce((acc, apt) => {
    if (!acc[apt.floor]) acc[apt.floor] = [];
    acc[apt.floor].push(apt);
    return acc;
  }, {});
  const handleSaveMonthly = async () => {
    if (selectedCount === 0) {
      toast.error('Не сте избрали нито един апартамент');
      return;
    }

    setSaving(true);
    try {
      const apartmentNumbers = apartments
        .filter(apt => selected[apt.id])
        .map(apt => apt.number);

      // Изпращаме към новия endpoint (ще го добавим в backend-а)
      await api.post('/charges/bulk-mark-paid', {
        apartment_numbers: apartmentNumbers,
        month: getCurrentMonth(), // или избрания месец, ако има поле
      });

      toast.success(`Маркирани ${apartmentNumbers.length} апартамента като платени`);
      if (onUpdate) onUpdate();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Грешка при запазване');
    } finally {
      setSaving(false);
    }
  };
  const handleSaveOther = async () => {
    if (selectedCount === 0) {
      toast.error('Не сте избрали нито един апартамент');
      return;
    }
    const num = parseFloat(otherData.amount);
    if (isNaN(num) || num <= 0) {
      toast.error('Въведете валидна сума');
      return;
    }
    if (!otherData.description.trim()) {
      toast.error('Въведете описание');
      return;
    }

    setSaving(true);
    try {
      const apartmentNumbers = apartments
        .filter(apt => selected[apt.id])
        .map(apt => apt.number);

      // Изпращаме една заявка за всички (или цикъл)
      // За сега използваме цикъл с POST /payments
      for (const apNumber of apartmentNumbers) {
        await api.post('/payments', {
          apartment_number: apNumber,
          month: otherData.month,
          amount: parseFloat(otherData.amount),
          type: 'other',
          description: otherData.description.trim(),
          status: otherData.status,
        });
      }

      toast.success(`Добавен разход за ${apartmentNumbers.length} апартамента`);
      if (onUpdate) onUpdate();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Грешка при запазване');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="modal-overlay">
      <div className="modal-content bulk-modal" ref={modalRef}>
        <div className="modal-header">
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <h2>⚡ Бързо въвеждане</h2>

          <div className="profile-tabs">
            <button
              className={`profile-tab ${activeTab === 'monthly' ? 'active' : ''}`}
              onClick={() => setActiveTab('monthly')}
            >
              Месечни такси
            </button>
            <button
              className={`profile-tab ${activeTab === 'other' ? 'active' : ''}`}
              onClick={() => setActiveTab('other')}
            >
              Други разходи
            </button>
          </div>

          {activeTab === 'monthly' ? (
            <p className="modal-subtitle">
              Маркирайте апартаментите, които са платили, и натиснете „Запази като платено“.
            </p>
          ) : (
            <div className="bulk-form">
              <div className="form-row-half">
                <div className="form-row">
                  <label>Месец:</label>
                  <input
                    type="month"
                    value={otherData.month}
                    onChange={(e) => setOtherData({ ...otherData, month: e.target.value })}
                  />
                </div>
                <div className="form-row">
                  <label>Сума (€):</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={otherData.amount}
                    onChange={(e) => {
                      let val = e.target.value.replace(/[^0-9.]/g, '');
                      const parts = val.split('.');
                      if (parts.length > 2) {
                        val = parts[0] + '.' + parts.slice(1).join('');
                      }
                      if (val === '.') val = '';
                      setOtherData({ ...otherData, amount: val });
                    }}
                    onBlur={(e) => {
                      const num = parseFloat(e.target.value);
                      if (!isNaN(num)) {
                        setOtherData({ ...otherData, amount: num.toFixed(2) });
                      } else {
                        setOtherData({ ...otherData, amount: '' });
                      }
                    }}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="form-row-half">
                <div className="form-row form-row-description">
                  <label>Описание:</label>
                  <input
                    type="text"
                    value={otherData.description}
                    onChange={(e) => setOtherData({ ...otherData, description: e.target.value })}
                    placeholder="Напр. Ремонт на асансьор"
                  />
                </div>
                <div className="form-row form-row-status">
                  <label>Статус:</label>
                  <select
                    value={otherData.status}
                    onChange={(e) => setOtherData({ ...otherData, status: e.target.value })}
                  >
                    <option value="unpaid">Неплатено</option>
                    <option value="paid">Платено</option>
                  </select>
                </div>
              </div>
            </div>
          )}

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
              onClick={activeTab === 'monthly' ? handleSaveMonthly : handleSaveOther}
              disabled={saving || selectedCount === 0}
            >
              {saving ? (
                <>
                  <span className="spinner-button"></span>
                  <span>Запазване... ({selectedCount})</span>
                </>
              ) : activeTab === 'monthly' ? (
                `Запази ${selectedCount} като платени`
              ) : (
                `Добави разход за ${selectedCount} ап.`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}