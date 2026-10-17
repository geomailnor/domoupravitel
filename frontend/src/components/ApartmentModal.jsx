import { useRef, useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../api.js';
import Spinner from './Spinner.jsx';
import { statusLabel, typeLabel, monthLabel } from './i18n/translate.js';
import oko1 from '../assets/oko1.png';
import oko2 from '../assets/oko2.png';
import ConfirmModal from './ConfirmModal.jsx';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import PrintReceipt from './PrintReceipt.jsx';
import '../pages/Dashboard.css';
import './ApartmentModal.css';

function getMonthsBetween(fromMonth, toMonth) {
  const months = [];
  let [year, month] = fromMonth.split('-').map(Number);
  const [toYear, toMonthNum] = toMonth.split('-').map(Number);

  while (year < toYear || (year === toYear && month <= toMonthNum)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return months;
}
function monthsAgo(monthStr) {
  // monthStr е 'YYYY-MM'
  const [year, month] = monthStr.split('-').map(Number);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  return (currentYear - year) * 12 + (currentMonth - month);
}
export default function ApartmentModal({ apartment, onClose, onUpdate }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('view');
  const [editingPayment, setEditingPayment] = useState(null);
  const [startMonth, setStartMonth] = useState('');
  const [monthlyFee, setMonthlyFee] = useState(7);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [printReceipt, setPrintReceipt] = useState(false);
  const [editData, setEditData] = useState({
    owner_name: apartment?.owner_name || '',
    phone: apartment?.phone || '',
    notes: apartment?.notes || '',
  });
  const [savingField, setSavingField] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const modalRef = useRef(null);
  const scrollPosRef = useRef(0);

  useFocusTrap(modalRef, !showResetConfirm && !deleteConfirm && !printReceipt);

  // Текущ месец във формат 'YYYY-MM'
  const getCurrentMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };
  const getEmptyFormData = () => ({
    isMultiMonth: false,
    from_month: getCurrentMonth(),
    to_month: '',
    amount: '7.00',
    type: 'monthly',
    status: 'paid',
    description: '',
  });
  const [formData, setFormData] = useState(getEmptyFormData);
  useEffect(() => {
    if (apartment) {
      // eslint-disable-next-line
      setEditData({
        owner_name: apartment.owner_name || '',
        phone: apartment.phone || '',
        notes: apartment.notes || '',
      });
    }
  }, [apartment]);
  // Зареждане на плащанията
  const loadPayments = useCallback(async () => {
    if (!apartment) return;

    try {
      const response = await api.get(
        `/payments?apartment_number=${apartment.number}`
      );
      setPayments(response.data);
    } catch (err) {
      const message = err.response?.data?.error || 'Грешка при зареждане';
      toast.error(message, { id: 'load-payments-error' });
    } finally {
      setLoading(false);
    }
  }, [apartment]);

  const handleEditPayment = (payment) => {
    setEditingPayment(payment);
    setFormData({
      isMultiMonth: false,
      from_month: payment.month,
      to_month: '',
      amount: payment.amount,
      type: payment.type,
      status: payment.status,
      description: payment.description || '',
    });
    scrollPosRef.current = modalRef.current?.scrollTop || 0;
    setMode('add');
  };
  const handleSaveField = async (field) => {
    if (!apartment) return;

    // Ако стойността не се е променила → нищо не правим
    const currentValue = editData[field] || '';
    const originalValue = apartment[field] || '';

    if (currentValue === originalValue) {
      return;
    }

    setSavingField(field);

    try {
      // PUT иска всичките полета – пращаме и трите
      await api.put(`/apartments/${apartment.number}`, {
        owner_name: editData.owner_name || null,
        phone: editData.phone || null,
        notes: editData.notes || null,
      });

      // Вземи обновения апартамент
      const response = await api.get(`/apartments/${apartment.number}`);

      toast.success('Записано', { duration: 1000 });

      // Уведоми родителя
      if (onUpdate) {
        onUpdate(response.data);
      }
    } catch (err) {
      const message = err.response?.data?.error || 'Грешка при запис';
      toast.error(message);
    } finally {
      setSavingField(null);
    }
  };
  const hasChanged = (field) => {
    const current = editData[field] || '';
    const original = apartment?.[field] || '';
    return current !== original;
  };
  const handleResetPassword = () => {
    setShowResetConfirm(true);
  };

  const performResetPassword = async () => {
    if (!apartment) return;

    setShowResetConfirm(false);
    setResetting(true);

    try {
      const response = await api.post(`/auth/reset-password/${apartment.number}`);

      setNewPassword(response.data.new_password);
      setShowResetModal(true);
      setShowPassword(true);

      toast.success('Паролата е нулирана');

      if (onUpdate) {
        const aptResponse = await api.get(`/apartments/${apartment.number}`);
        onUpdate(aptResponse.data);
      }
    } catch (err) {
      const message = err.response?.data?.error || 'Грешка при нулиране';
      toast.error(message);
    } finally {
      setResetting(false);
    }
  };
  const handleDeletePayment = (payment) => {
    setDeleteConfirm(payment);
  };

  const performDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await api.delete(`/payments/${deleteConfirm.id}`);
      toast.success('Плащането е изтрито');
      setDeleteConfirm(null);
      setLoading(true);
      loadPayments();
    } catch (err) {
      const message = err.response?.data?.error || 'Грешка при изтриване';
      toast.error(message);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line
    loadPayments();
  }, [loadPayments]);
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await api.get('/settings');
        setStartMonth(response.data.start_month || '');
        setMonthlyFee(response.data.monthly_fee || 7);
        setSettingsLoaded(true);
      } catch (err) {
        console.error('Грешка при зареждане на настройки', err);
      }
    };
    loadSettings();
  }, []);
  // ESC за затваряне
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        // Ако има отворен ConfirmModal → не затваряй ApartmentModal
        if (showResetConfirm || deleteConfirm) return;
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, showResetConfirm, deleteConfirm]);

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
  // Запомняне
  useEffect(() => {
    const target = scrollPosRef.current;
    if (!target) return;
    if (!modalRef.current) return;
    modalRef.current.scrollTop = target;
  }, [mode, loading]);

  if (!apartment) return null;

  if (printReceipt) {
    return (
      <PrintReceipt
        apartment={apartment}
        month={getCurrentMonth()}
        amount={monthlyFee.toFixed(2)}
        onClose={() => setPrintReceipt(false)}
      />
    );
  }

  const getMonthsCount = () => {
    if (!formData.isMultiMonth || !formData.to_month) return 1;
    if (formData.to_month < formData.from_month) return 0;   // невалиден диапазон
    const months = getMonthsBetween(formData.from_month, formData.to_month);
    return months.length;
  };
  const getUnpaidStats = () => {
    const empty = {
      unpaidCount: 0, unpaidDue: 0,
      partialCount: 0, partialDue: 0,
      otherCount: 0, otherDue: 0,
      totalDue: 0,
    };

    if (!startMonth) return empty;

    const now = new Date();
    let currentYear = now.getFullYear();
    let currentMonth = now.getMonth() + 1 - 1;

    if (currentMonth === 0) {
      currentMonth = 12;
      currentYear -= 1;
    }

    // Генерирай всички дължими месеци (start_month → предишен)
    const dueMonths = [];
    let [year, month] = startMonth.split('-').map(Number);

    while (year < currentYear || (year === currentYear && month <= currentMonth)) {
      dueMonths.push(`${year}-${String(month).padStart(2, '0')}`);
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }

    // Месеци с paid или partial → не са напълно неплатени
    const paidOrPartialSet = new Set(
      payments
        .filter(p => p.type === 'monthly' && (p.status === 'paid' || p.status === 'partial'))
        .map(p => p.month)
    );

    // 1. Неплатени месечни
    const unpaidMonths = dueMonths.filter(m => !paidOrPartialSet.has(m));
    const unpaidCount = unpaidMonths.length;
    const unpaidDue = unpaidCount * monthlyFee;

    // 2. Частично неплатени месечни
    const partialMonthly = payments.filter(
      p => p.type === 'monthly' && p.status === 'partial'
    );
    const partialPaidSum = partialMonthly.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const partialCount = partialMonthly.length;
    const partialDue = partialCount * monthlyFee - partialPaidSum;

    // 3. Неплатени други разходи
    const unpaidOther = payments.filter(
      p => p.type === 'other' && p.status === 'unpaid'
    );
    const otherCount = unpaidOther.length;
    const otherDue = unpaidOther.reduce((sum, p) => sum + parseFloat(p.amount), 0);

    // 4. Общо
    const totalDue = unpaidDue + partialDue + otherDue;

    return {
      unpaidCount, unpaidDue,
      partialCount, partialDue,
      otherCount, otherDue,
      totalDue,
    };
  };
  const getTotalAmount = () => {
    const count = getMonthsCount();
    const amount = parseFloat(formData.amount) || 0;
    return (count * amount).toFixed(2);
  };

  const handleSave = async () => {
    // 1. Валидация
    if (!formData.from_month) {
      toast.error('Моля, изберете месец');
      return;
    }
    // Проверка: to_month не може да е преди from_month
    if (formData.isMultiMonth && formData.to_month && formData.to_month < formData.from_month) {
      toast.error('Крайният месец не може да е преди началния');
      return;
    }
    // Ако статусът не е 'unpaid', сумата трябва да е > 0
    if (formData.status !== 'unpaid' && (!formData.amount || parseFloat(formData.amount) <= 0)) {
      toast.error('Моля, въведете валидна сума');
      return;
    }
    if (formData.isMultiMonth && !formData.to_month) {
      toast.error('Моля, изберете краен месец');
      return;
    }
    // ⭐ АКО РЕДАКТИРАМЕ – различен път
    if (editingPayment) {
      try {
        await api.put(`/payments/${editingPayment.id}`, {
          month: formData.from_month,
          amount: formData.status === 'unpaid' ? 0 : parseFloat(formData.amount),
          type: formData.type,
          status: formData.status,
          description: formData.description || null,
        });

        toast.success('Плащането е обновено');
        setMode('view');
        setEditingPayment(null);
        setLoading(true);
        loadPayments();

        // Нулиране на формата
        setFormData(getEmptyFormData());

      } catch (err) {
        const message = err.response?.data?.error || 'Грешка при обновяване';
        toast.error(message);
      }
      return;
    }
    // 2. Определяне на месеците
    const months = formData.isMultiMonth && formData.to_month
      ? getMonthsBetween(formData.from_month, formData.to_month)
      : [formData.from_month];

    if (months.length === 0) {
      toast.error('Невалиден диапазон от месеци');
      return;
    }

    // 3. Изпращане на заявките
    setSaving(true);
    try {
      const response = await api.post('/payments/bulk', {
        payments: months.map((month) => ({
          apartment_number: apartment.number,
          month,
          amount: formData.status === 'unpaid' ? 0 : parseFloat(formData.amount),
          type: formData.type,
          status: formData.status,
          description: formData.description || null,
        })),
      });

      const { created } = response.data;

      // 4. Успех
      toast.success(
        created === 1 ? 'Плащането е добавено' : `Добавени ${created} плащания`
      );

      // 5. Връщане към view mode
      scrollPosRef.current = modalRef.current?.scrollTop || 0;
      setMode('view');

      // 6. Презареждане на плащанията
      setLoading(true);
      loadPayments();

      // 7. Нулиране на формата
      setFormData(getEmptyFormData());

    } catch (err) {
      const message = err.response?.data?.error || 'Грешка при запазване';
      toast.error(message);
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" ref={modalRef}>
        <div className='modal-header'>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className='modal-body'>
          {mode === 'view' ? (
            <>
              <h2>Апартамент {apartment.number}</h2>
              <p className="modal-subtitle">Етаж {apartment.floor}</p>

              <div className="apartment-info">
                {/* Собственик + Парола на един ред */}
                <div className="info-row info-row-double">
                  <div className="info-cell">
                    <span className="info-label">Собственик:</span>
                    <div className="editable-wrapper">
                      <input
                        type="text"
                        className={`editable-input ${hasChanged('owner_name') ? 'changed' : ''}`}
                        value={editData.owner_name}
                        onChange={(e) => setEditData({ ...editData, owner_name: e.target.value })}
                        onFocus={(e) => e.target.select()}
                        onBlur={() => handleSaveField('owner_name')}
                        placeholder="(няма име)"
                      />
                      {savingField === 'owner_name' && (
                        <span className="saving-indicator">...</span>
                      )}
                    </div>
                  </div>
                  <div className="info-cell">
                    <span className="info-label">Парола:</span>
                    <span className="password-row">
                      <input
                        type="text"
                        className="password-value-input"
                        value={showPassword ? apartment.password : '••••••••'}
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
                        title="Нулирай паролата на нова случайна"
                      >
                        🔄
                      </button>
                    </span>
                  </div>
                </div>

                {/* Телефон */}
                <div className="info-row">
                  <span className="info-label">Телефон:</span>
                  <div className="editable-wrapper">
                    <input
                      type="text"
                      className={`editable-input ${hasChanged('phone') ? 'changed' : ''}`}
                      value={editData.phone}
                      onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                      onFocus={(e) => e.target.select()}
                      onBlur={() => handleSaveField('phone')}
                      placeholder="(няма телефон)"
                    />
                    {savingField === 'phone' && (
                      <span className="saving-indicator">...</span>
                    )}
                  </div>
                </div>

                {/* Бележки */}
                <div className="info-row">
                  <span className="info-label">Бележки:</span>
                  <div className="editable-wrapper">
                    <input
                      type="text"
                      className={`editable-input ${hasChanged('notes') ? 'changed' : ''}`}
                      value={editData.notes}
                      onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                      onFocus={(e) => e.target.select()}
                      onBlur={() => handleSaveField('notes')}
                      placeholder="(няма бележки)"
                    />
                    {savingField === 'notes' && (
                      <span className="saving-indicator">...</span>
                    )}
                  </div>
                </div>
              </div>

              <h3 className="modal-section-title">Плащания</h3>

              {!loading && settingsLoaded && (() => {
                const stats = getUnpaidStats();
                const hasDebt = stats.totalDue > 0;

                return (
                  <div className={`stat-unpaid-card ${!hasDebt ? 'stat-unpaid-ok'
                    : stats.unpaidCount + stats.partialCount + stats.otherCount <= 2 ? 'stat-unpaid-warning'
                      : 'stat-unpaid-danger'
                    }`}>
                    {!hasDebt ? (
                      <div className="stat-unpaid-label">Всичко е платено ✓</div>
                    ) : (
                      <div className="debt-summary">
                        {stats.unpaidCount > 0 && (
                          <div className="debt-row">
                            <span className="debt-label">
                              {stats.unpaidCount} {stats.unpaidCount === 1 ? 'неплатен месец' : 'неплатени месеца'}
                            </span>
                            <span className="debt-amount">{stats.unpaidDue.toFixed(2)} €</span>
                          </div>
                        )}

                        {stats.partialCount > 0 && (
                          <div className="debt-row">
                            <span className="debt-label">
                              {stats.partialCount} {stats.partialCount === 1 ? 'частично неплатен месец' : 'частично неплатени месеца'}
                            </span>
                            <span className="debt-amount">{stats.partialDue.toFixed(2)} €</span>
                          </div>
                        )}

                        {stats.otherCount > 0 && (
                          <div className="debt-row">
                            <span className="debt-label">
                              {stats.otherCount} {stats.otherCount === 1 ? 'неплатен доп. разход' : 'неплатени доп. разходи'}
                            </span>
                            <span className="debt-amount">{stats.otherDue.toFixed(2)} €</span>
                          </div>
                        )}

                        <div className="debt-total-row">
                          <span>Общо дължимо:</span>
                          <span className="debt-total-amount">{stats.totalDue.toFixed(2)} €</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="payments-area">
                {loading ? (
                  <Spinner size="small" />
                ) : payments.length === 0 ? (
                  <p className="no-payments">Няма записани плащания</p>
                ) : (
                  <table className="payments-table">
                    <thead>
                      <tr>
                        <th>Месец</th>
                        <th>Сума</th>
                        <th>Вид</th>
                        <th>Статус</th>
                        <th>Описание</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => {
                        const monthsDiff = monthsAgo(p.month);

                        return (
                          <tr key={p.id}>
                            <td>{monthLabel(p.month)}</td>
                            <td className={(p.status === 'paid' || p.status === 'partial') ? 'amount-cell' : 'amount-empty'}>
                              {(p.status === 'paid' || p.status === 'partial') ? `${p.amount} €` : '—'}
                            </td>
                            <td>{typeLabel(p.type)}</td>
                            <td className={`status-${p.status} ${monthsDiff === 0 ? 'status-current' : ''}`}>
                              {statusLabel(p.status)}
                            </td>
                            <td className="description-cell" title={p.description || ''}>{p.description}</td>
                            <td className="actions-cell">
                              <button
                                type="button"
                                className="edit-row-btn"
                                onClick={() => handleEditPayment(p)}
                                title="Редактиране на плащане"
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                className="delete-row-btn"
                                onClick={() => handleDeletePayment(p)}
                                title="Изтриване на плащане"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="modal-actions">
                <button className="close-btn" onClick={onClose}>Затвори</button>
                <button
                  className="print-btn"
                  onClick={() => setPrintReceipt(true)}
                  title="Разпечатай разписка за текущия месец"
                >
                  🖨️ Разписка
                </button>
                <button
                  className="add-payment-btn"
                  onClick={() => setMode('add')}
                >
                  + Добави плащане
                </button>
              </div>
              {showResetModal && (
                <div className="reset-password-overlay">
                  <div className="reset-password-modal">
                    <h3>Паролата е нулирана</h3>
                    <p className="reset-password-info">
                      Новата парола на ап. {apartment.number}:
                    </p>
                    <div className="reset-password-value">
                      {newPassword}
                    </div>
                    <p className="reset-password-note">
                      Запишете я и я предайте на живущия. Той може да си я смени.
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
              {showResetConfirm && (
                <ConfirmModal
                  title="Нулиране на парола"
                  message={`Ще премахнем старата и ще генерираме нова парола.\nАп. ${apartment.number} ще може да влиза с новата парола.`} confirmText="Да, нулирай"
                  cancelText="Отказ"
                  confirmColor="danger"
                  onConfirm={performResetPassword}
                  onCancel={() => setShowResetConfirm(false)}
                />
              )}
              {deleteConfirm && (
                <ConfirmModal
                  title="Изтриване на плащане"
                  message={`Потвърдете изтриване на плащане за ${monthLabel(deleteConfirm.month)}.\n\nТова действие е необратимо!`}
                  confirmText="Да, изтрий"
                  cancelText="Отказ"
                  confirmColor="danger"
                  onConfirm={performDelete}
                  onCancel={() => setDeleteConfirm(null)}
                />
              )}
              {printReceipt && (
                <PrintReceipt
                  apartment={apartment}
                  month={getCurrentMonth()}
                  onClose={() => setPrintReceipt(false)}
                />
              )}
            </>
          ) : (
            <>
              <h2>{editingPayment ? 'Редакция на плащане' : 'Ново плащане'}</h2>
              <p className="modal-subtitle">Апартамент {apartment.number}</p>

              <div className="payment-form">
                <div className="form-row">
                  <label>{formData.isMultiMonth ? 'От месец:' : 'Месец:'}</label>
                  <div className="month-year-selects">
                    <select
                      value={formData.from_month.split('-')[1] || ''}
                      onChange={(e) => {
                        const year = formData.from_month.split('-')[0] || new Date().getFullYear().toString();
                        const newFromMonth = `${year}-${e.target.value}`;

                        // Ако е многомесечно и to_month е преди новия from_month → изравни ги
                        let newToMonth = formData.to_month;
                        if (formData.isMultiMonth && newToMonth && newToMonth < newFromMonth) {
                          newToMonth = newFromMonth;
                        }

                        setFormData({
                          ...formData,
                          from_month: newFromMonth,
                          to_month: newToMonth
                        });
                      }}
                      required
                    >
                      <option value="">Месец</option>
                      <option value="01">Януари</option>
                      <option value="02">Февруари</option>
                      <option value="03">Март</option>
                      <option value="04">Април</option>
                      <option value="05">Май</option>
                      <option value="06">Юни</option>
                      <option value="07">Юли</option>
                      <option value="08">Август</option>
                      <option value="09">Септември</option>
                      <option value="10">Октомври</option>
                      <option value="11">Ноември</option>
                      <option value="12">Декември</option>
                    </select>
                    <select
                      value={formData.from_month.split('-')[0] || ''}
                      onChange={(e) => {
                        const month = formData.from_month.split('-')[1] || '01';
                        const newFromMonth = `${e.target.value}-${month}`;

                        let newToMonth = formData.to_month;
                        if (formData.isMultiMonth && newToMonth && newToMonth < newFromMonth) {
                          newToMonth = newFromMonth;
                        }

                        setFormData({
                          ...formData,
                          from_month: newFromMonth,
                          to_month: newToMonth
                        });
                      }}
                      required
                    >
                      <option value="">Година</option>
                      {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() + i).map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {!editingPayment && (
                  <div className="form-row form-checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={formData.isMultiMonth}
                        onChange={(e) => setFormData({
                          ...formData,
                          isMultiMonth: e.target.checked,
                          to_month: e.target.checked ? (formData.to_month || formData.from_month) : ''
                        })}
                      />
                      Плащане за няколко месеца
                    </label>
                  </div>
                )}

                {formData.isMultiMonth && (
                  <div className="form-row">
                    <label>До месец:</label>
                    <div className="month-year-selects">
                      <select
                        value={formData.to_month.split('-')[1] || ''}
                        onChange={(e) => {
                          const year = formData.to_month.split('-')[0] || new Date().getFullYear().toString();
                          setFormData({ ...formData, to_month: `${year}-${e.target.value}` });
                        }}
                      >
                        <option value="">Месец</option>
                        <option value="01">Януари</option>
                        <option value="02">Февруари</option>
                        <option value="03">Март</option>
                        <option value="04">Април</option>
                        <option value="05">Май</option>
                        <option value="06">Юни</option>
                        <option value="07">Юли</option>
                        <option value="08">Август</option>
                        <option value="09">Септември</option>
                        <option value="10">Октомври</option>
                        <option value="11">Ноември</option>
                        <option value="12">Декември</option>
                      </select>
                      <select
                        value={formData.to_month.split('-')[0] || ''}
                        onChange={(e) => {
                          const month = formData.to_month.split('-')[1] || '01';
                          setFormData({ ...formData, to_month: `${e.target.value}-${month}` });
                        }}
                      >
                        <option value="">Година</option>
                        {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() + i).map((year) => {
                          const fromYear = formData.from_month ? parseInt(formData.from_month.split('-')[0], 10) : null;
                          const isDisabled = fromYear && year < fromYear;

                          return (
                            <option
                              key={year}
                              value={year}
                              disabled={isDisabled}
                            >
                              {year}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                )}

                {formData.status !== 'unpaid' && (
                  <div className="form-row">
                    <label htmlFor="amount">Сума на месец (€):</label>
                    <input
                      id="amount"
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
                      required
                    />
                  </div>
                )}
                {formData.isMultiMonth && formData.to_month && getMonthsCount() > 0 && (
                  <div className="form-row total-amount">
                    <span>
                      Общо: <strong>{getTotalAmount()} €</strong> за {getMonthsCount()}{' '}
                      {getMonthsCount() === 1 ? 'месец' : 'месеца'}
                    </span>
                  </div>
                )}

                <div className="form-row">
                  <label htmlFor="type">Вид:</label>
                  <select
                    id="type"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  >
                    <option value="monthly">Месечна такса</option>
                    <option value="other">Друго</option>
                  </select>
                </div>

                <div className="form-row">
                  <label htmlFor="status">Статус:</label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="paid">Платено</option>
                    {(!editingPayment || editingPayment.status === 'unpaid') && (
                      <option value="unpaid">Неплатено</option>
                    )}
                    <option value="partial">Частично</option>
                  </select>
                </div>

                <div className="form-row">
                  <label htmlFor="description">Описание (по избор):</label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => {
                    setMode('view');
                    setEditingPayment(null);
                    // Нулиране на формата
                    setFormData(getEmptyFormData());
                  }}
                >
                  Отказ
                </button>
                <button
                  type="button"
                  className="save-btn"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {editingPayment ? 'Запази промените' : 'Запази'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}