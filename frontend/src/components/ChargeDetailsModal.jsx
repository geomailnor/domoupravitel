import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../api.js';
import Spinner from './Spinner.jsx';
import { monthLabel, monthNameOnly } from './i18n/translate.js';
import oko1 from '../assets/oko1.png';
import oko2 from '../assets/oko2.png';
import ConfirmModal from './ConfirmModal.jsx';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import '../pages/Dashboard.css';
import './ChargeDetailsModal.css';

export default function ChargeDetailsModal({ apartment, onClose, onUpdate }) {
  const [history, setHistory] = useState({ monthly: [], other: [] });
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [apartmentData, setApartmentData] = useState(null);
  const modalRef = useRef(null);

  useFocusTrap(modalRef, !showResetConfirm);

  const fillMissingMonths = (monthlyData, startMonth) => {
    if (!startMonth || monthlyData.length === 0) return monthlyData;

    const result = [...monthlyData];
    const [startYear, startMonthNum] = startMonth.split('-').map(Number);
    const [endYear, endMonthNum] = monthlyData[0].month.split('-').map(Number);

    let currentYear = startYear;
    let currentMonth = startMonthNum;

    while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonthNum)) {
      const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      if (!result.find(m => m.month === monthStr)) {
        result.push({
          id: `empty-${monthStr}`,
          month: monthStr,
          elevator_fee: 0,
          elevator_power: 0,
          general_power: 0,
          fund_ro: 0,
          intercom: 0,
          manager_fee: 0,
          total_amount: 0,
          status: 'unpaid',
          is_empty: true,
        });
      }
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
    }

    return result.sort((a, b) => b.month.localeCompare(a.month));
  };
  // Зареждане на данните и историята
  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. Вземаме настройките (за start_month)
        const settingsRes = await api.get('/settings');
        const startM = settingsRes.data.start_month;
        // 2. Вземаме данните за апартамента
        const aptRes = await api.get(`/apartments/${apartment.ap_number}`);
        setApartmentData(aptRes.data);
        // 3. Вземаме историята
        const res = await api.get(`/charges/history/${aptRes.data.id}`);
        // 4. Допълваме липсващите месеци
        const filledMonthly = fillMissingMonths(res.data.monthly, startM);

        setHistory({ monthly: filledMonthly, other: res.data.other });
      } catch {
        toast.error('Грешка при зареждане на данните');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [apartment.ap_number]);

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

  const handleResetPassword = () => {
    setShowResetConfirm(true);
  };

  const performResetPassword = async () => {
    setShowResetConfirm(false);
    setResetting(true);

    try {
      const response = await api.post(`/auth/reset-password/${apartment.ap_number}`);
      setNewPassword(response.data.new_password);

      // ⭐ Обновяваме apartmentData с новата парола
      setApartmentData(prev => ({ ...prev, password: response.data.new_password }));

      setShowResetModal(true);
      setShowPassword(true);
      toast.success('Паролата е нулирана');
      if (onUpdate) onUpdate();
    } catch {
      toast.error('Грешка при нулиране');
    } finally {
      setResetting(false);
    }
  };
  const hasChanged = (field) => {
    const current = apartmentData?.[field] || '';
    const original = apartment?.[field] || '';
    return current !== original;
  };
  return (
    <div className="modal-overlay">
      <div className="modal-content" ref={modalRef} style={{ maxWidth: '800px' }}>
        <div className="modal-header">
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <h2>Апартамент {apartment.ap_number || apartment.number}</h2>
          <p className="modal-subtitle">Етаж {apartment.floor}</p>

          {/* Информация */}
          {apartmentData && (
            <div className="apartment-info">
              <div className="info-row info-row-double">
                <div className="info-cell">
                  <span className="info-label">Собственик:</span>
                  <input
                    type="text"
                    className={`editable-input ${hasChanged('owner_name') ? 'changed' : ''}`}
                    value={apartmentData.owner_name || ''}
                    onChange={(e) => setApartmentData({ ...apartmentData, owner_name: e.target.value })}
                    onBlur={async () => {
                      if (!hasChanged('owner_name')) return;
                      try {
                        await api.put(`/apartments/${apartment.ap_number}`, {
                          owner_name: apartmentData.owner_name,
                          phone: apartmentData.phone,
                          notes: apartmentData.notes,
                        });
                        toast.success('Запазено', { duration: 1000 });
                        if (onUpdate) onUpdate();
                      } catch {
                        toast.error('Грешка при запазване');
                      }
                    }}
                    placeholder="(няма име)"
                  />
                </div>
                <div className="info-cell">
                  <span className="info-label">Парола:</span>
                  <span className="password-row">
                    <input
                      type="text"
                      className="password-value-input"
                      value={showPassword ? (apartmentData.password || '') : '••••••••'}
                      readOnly
                      tabIndex={-1}
                    />
                    <button
                      type="button"
                      className="toggle-password-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? 'Скрий паролата' : 'Покажи паролата'}
                    >
                      <img src={showPassword ? oko1 : oko2} alt="" />
                    </button>
                    <button
                      type="button"
                      className="reset-password-btn"
                      onClick={handleResetPassword}
                      disabled={resetting}
                      title="Нулирай паролата"
                    >
                      🔄
                    </button>
                  </span>
                </div>
              </div>
              <div className="info-row">
                <span className="info-label">Телефон:</span>
                <input
                  type="text"
                  className={`editable-input ${hasChanged('phone') ? 'changed' : ''}`}
                  value={apartmentData.phone || ''}
                  onChange={(e) => setApartmentData({ ...apartmentData, phone: e.target.value })}
                  onBlur={async () => {
                    if (!hasChanged('phone')) return;
                    try {
                      await api.put(`/apartments/${apartment.ap_number}`, {
                        owner_name: apartmentData.owner_name,
                        phone: apartmentData.phone,
                        notes: apartmentData.notes,
                      });
                      toast.success('Запазено', { duration: 1000 });
                      if (onUpdate) onUpdate();
                    } catch {
                      toast.error('Грешка при запазване');
                    }
                  }}
                  placeholder="(няма телефон)"
                />
              </div>
              <div className="info-row">
                <span className="info-label">Бележки:</span>
                <input
                  type="text"
                  className={`editable-input ${hasChanged('notes') ? 'changed' : ''}`}
                  value={apartmentData.notes || ''}
                  onChange={(e) => setApartmentData({ ...apartmentData, notes: e.target.value })}
                  onBlur={async () => {
                    if (!hasChanged('notes')) return;
                    try {
                      await api.put(`/apartments/${apartment.ap_number}`, {
                        owner_name: apartmentData.owner_name,
                        phone: apartmentData.phone,
                        notes: apartmentData.notes,
                      });
                      toast.success('Запазено', { duration: 1000 });
                      if (onUpdate) onUpdate();
                    } catch {
                      toast.error('Грешка при запазване');
                    }
                  }}
                  placeholder="(няма бележки)"
                />
              </div>
            </div>
          )}

          {/* История на месечните такси */}
          <h3 className="modal-section-title">
            История на месечните такси
            {history.monthly.length > 0 && ` за ${history.monthly[0].month.split('-')[0]}`}
          </h3>
          {loading ? (
            <Spinner size="small" />
          ) : history.monthly.length === 0 ? (
            <p className="no-payments">Няма записани месечни такси</p>
          ) : (
            <div className="table-wrapper">
              <table className="payments-table">
                <thead>
                  <tr>
                    <th>Месец</th>
                    <th>Асанс.<br />такса</th>
                    <th>Асанс.<br />ток</th>
                    <th>Общ<br />ток</th>
                    <th>Фонд<br />Р.О.</th>
                    <th>Дом.<br />сис.</th>
                    <th>Хоно-<br />рар</th>
                    <th>Всичко</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {history.monthly.map((m) => (
                    <tr key={m.id}>
                      <td>{monthNameOnly(m.month)}</td>
                      <td className="text-right">{m.elevator_fee.toFixed(2)}</td>
                      <td className="text-right">{m.elevator_power.toFixed(2)}</td>
                      <td className="text-right">{m.general_power.toFixed(2)}</td>
                      <td className="text-right">{m.fund_ro.toFixed(2)}</td>
                      <td className="text-right">{m.intercom.toFixed(2)}</td>
                      <td className="text-right">{m.manager_fee.toFixed(2)}</td>
                      <td className="text-right font-bold">{m.total_amount.toFixed(2)}</td>
                      <td className={`status-${m.status}`}>
                        {m.status === 'paid' ? 'Плат.' : 'Непл.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Други разходи (ако има) */}
          {history.other.length > 0 && (
            <>
              <h3 className="modal-section-title">Други разходи</h3>
              <table className="payments-table">
                <thead>
                  <tr>
                    <th>Месец</th>
                    <th>Сума</th>
                    <th>Описание</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {history.other.map((o) => (
                    <tr key={o.id}>
                      <td>{monthLabel(o.month)}</td>
                      <td>{o.amount.toFixed(2)} €</td>
                      <td>{o.description || '—'}</td>
                      <td className={`status-${o.status}`}>
                        {o.status === 'paid' ? 'Плат.' : 'Непл.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="modal-actions">
            <button className="close-btn" onClick={onClose}>Затвори</button>
          </div>

          {/* Модал за нова парола */}
          {showResetModal && (
            <div className="reset-password-overlay">
              <div className="reset-password-modal">
                <h3>Паролата е нулирана</h3>
                <p className="reset-password-info">
                  Новата парола на ап. {apartment.ap_number || apartment.number}:
                </p>
                <div className="reset-password-value">{newPassword}</div>
                <p className="reset-password-note">
                  Запишете я и я предайте на живущия.
                </p>
                <div className="reset-password-actions">
                  <button
                    type="button"
                    className="save-btn"
                    onClick={() => setShowResetModal(false)}
                  >
                    Разбрах
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Потвърждение за нулиране */}
          {showResetConfirm && (
            <ConfirmModal
              title="Нулиране на парола"
              message={`Ще генерираме нова парола за ап. ${apartment.ap_number || apartment.number}.`}
              confirmText="Да, нулирай"
              cancelText="Отказ"
              confirmColor="danger"
              onConfirm={performResetPassword}
              onCancel={() => setShowResetConfirm(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}