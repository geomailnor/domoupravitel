import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api.js';
import Spinner from './Spinner.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import { useRef } from 'react';
import { useScrollLock } from '../hooks/useScrollLock.js';
import '../pages/Dashboard.css';
import './ExpensesModal.css';

export default function ExpensesModal({ onClose }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [openingBalanceK1, setOpeningBalanceK1] = useState('0.00');
  const [openingBalanceK2, setOpeningBalanceK2] = useState('0.00');
  const [isEditingK1, setIsEditingK1] = useState(false);
  const [isEditingK2, setIsEditingK2] = useState(false);
  const [originalK1, setOriginalK1] = useState('0.00');
  const [originalK2, setOriginalK2] = useState('0.00');
  const [changedK1, setChangedK1] = useState(false);
  const [changedK2, setChangedK2] = useState(false);
  const [showBalances, setShowBalances] = useState(false);
  const modalRef = useRef(null);

  useFocusTrap(modalRef, !deleteConfirm);
  useScrollLock();
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    description: '',
    cash_box: 'K1',
    category: 'other',
  });

  // Зареждане на разходите
  useEffect(() => {
    const loadData = async () => {
      try {
        const [expensesRes, settingsRes] = await Promise.all([
          api.get('/expenses'),
          api.get('/settings')
        ]);
        setExpenses(expensesRes.data);

        const k1 = parseFloat(settingsRes.data.opening_balance_k1 || '0.00').toFixed(2);
        const k2 = parseFloat(settingsRes.data.opening_balance_k2 || '0.00').toFixed(2);
        setOpeningBalanceK1(k1);
        setOpeningBalanceK2(k2);
        setOriginalK1(k1);
        setOriginalK2(k2);
      } catch {
        toast.error('Грешка при зареждане на разходите');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSave = async () => {
    const selectedDate = new Date(formData.date);
    const currentYear = new Date().getFullYear();

    // Проверка за година (не по-стара от текущата)
    if (selectedDate.getFullYear() < currentYear) {
      toast.error(`Датата не може да е преди ${currentYear} година`);
      return;
    }

    // Проверка за бъдеще (не повече от 1 месец)
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 1);
    if (selectedDate > maxDate) {
      toast.error('Датата не може да е повече от 1 месец напред');
      return;
    }
    const num = parseFloat(formData.amount);
    if (isNaN(num) || num <= 0) {
      toast.error('Въведете валидна сума');
      return;
    }
    if (!formData.description.trim()) {
      toast.error('Въведете описание');
      return;
    }

    setSaving(true);
    try {
      await api.post('/expenses', {
        date: formData.date,
        amount: num,
        type: 'other',
        description: formData.description.trim(),
        cash_box: formData.cash_box,
        category: formData.category,
      });

      toast.success('Разходът е добавен');
      setShowForm(false);
      setFormData({
        date: new Date().toISOString().slice(0, 10),
        amount: '',
        description: '',
        cash_box: 'K1',
        category: 'other'
      });

      // Презареждаме
      const res = await api.get('/expenses');
      setExpenses(res.data);
    } catch {
      toast.error('Грешка при добавяне');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete(`/expenses/${deleteConfirm}`);
      toast.success('Разходът е изтрит');
      setDeleteConfirm(null);
      const res = await api.get('/expenses');
      setExpenses(res.data);
    } catch {
      toast.error('Грешка при изтриване');
    }
  };

  // Помощна функция за запазване на салдо
  const saveBalance = async (field, value, original, setOriginal, setEditing, setChanged, setBalance) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      setBalance('0.00');
      return;
    }
    const formatted = num.toFixed(2);
    setBalance(formatted);

    if (formatted === original) {
      setEditing(false);
      return;
    }

    try {
      await api.put('/settings', { [field]: formatted });
      toast.success('Салдото е запазено');
      setOriginal(formatted);
      setEditing(false);
      setChanged(false);
    } catch {
      toast.error('Грешка при запазване');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content expenses-modal-content" ref={modalRef}>
        <div className="modal-header">
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <h2 className="expenses-title">Разходи на блока</h2>

          {loading ? (
            <Spinner size="small" />
          ) : (
            <>
              {/* Бутон за показване/скриване */}
              <div className="balances-toggle-container">
                <button
                  type="button"
                  className="toggle-balances-btn"
                  onClick={() => setShowBalances(!showBalances)}
                >
                  {showBalances ? 'Скрий салдата' : 'Покажи салдата'}
                </button>
              </div>

              {/* Двата блока за салдо - показват се само ако showBalances е true */}
              {showBalances && (
                <>
                  {/* Начално салдо К1 */}
                  <div className="balance-field">
                    <div className="balance-inline-row">
                      <label>Начално салдо К1 (Поддръжка) (€):</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={openingBalanceK1}
                        disabled={!isEditingK1}
                        onChange={(e) => {
                          let val = e.target.value.replace(/[^0-9.]/g, '');
                          const parts = val.split('.');
                          if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                          if (val === '.') val = '';
                          setOpeningBalanceK1(val);
                          const num = parseFloat(val);
                          if (!isNaN(num)) setChangedK1(num.toFixed(2) !== originalK1);
                          else setChangedK1(val !== '');
                        }}
                        onBlur={() => saveBalance('opening_balance_k1', openingBalanceK1, originalK1, setOriginalK1, setIsEditingK1, setChangedK1, setOpeningBalanceK1)}
                        placeholder="0.00"
                        className={`${isEditingK1 ? 'editable-balance' : 'disabled-balance'} ${changedK1 ? 'changed-balance' : ''}`}
                      />
                      <label className="edit-checkbox-label">
                        <input type="checkbox" checked={isEditingK1} onChange={(e) => setIsEditingK1(e.target.checked)} />
                        Редактирай
                      </label>
                    </div>
                  </div>

                  {/* Начално салдо К2 */}
                  <div className="balance-field">
                    <div className="balance-inline-row">
                      <label>Начално салдо К2 (€):</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={openingBalanceK2}
                        disabled={!isEditingK2}
                        onChange={(e) => {
                          let val = e.target.value.replace(/[^0-9.]/g, '');
                          const parts = val.split('.');
                          if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                          if (val === '.') val = '';
                          setOpeningBalanceK2(val);
                          const num = parseFloat(val);
                          if (!isNaN(num)) setChangedK2(num.toFixed(2) !== originalK2);
                          else setChangedK2(val !== '');
                        }}
                        onBlur={() => saveBalance('opening_balance_k2', openingBalanceK2, originalK2, setOriginalK2, setIsEditingK2, setChangedK2, setOpeningBalanceK2)}
                        placeholder="0.00"
                        className={`${isEditingK2 ? 'editable-balance' : 'disabled-balance'} ${changedK2 ? 'changed-balance' : ''}`}
                      />
                      <label className="edit-checkbox-label">
                        <input type="checkbox" checked={isEditingK2} onChange={(e) => setIsEditingK2(e.target.checked)} />
                        Редактирай
                      </label>
                    </div>
                  </div>
                </>
              )}

              {expenses.length === 0 ? (
                <p className="no-payments">Няма записани разходи</p>
              ) : (
                <table className="payments-table other-table expenses-table">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Сума</th>
                      <th>Каса</th>
                      <th>Описание</th>
                      <th>Изтрий</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id}>
                        <td>{new Date(e.date).toLocaleDateString('bg-BG')}</td>
                        <td className="text-right expense-row">{parseFloat(e.amount).toFixed(2)} €</td>
                        <td className="text-center">{e.cash_box || 'К1'}</td>
                        <td>{e.description || '—'}</td>
                        <td className="text-center">
                          <button className="delete-other-btn" onClick={() => setDeleteConfirm(e.id)}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {!showForm ? (
                <button className="add-other-btn" onClick={() => setShowForm(true)}>
                  + Добави разход
                </button>
              ) : (
                <div className="expenses-add-form">
                  <div className="expenses-form-row">
                    <label>Дата:</label>
                    <input
                      type="date"
                      value={formData.date}
                      min={`${new Date().getFullYear()}-01-01`}
                      max={new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10)}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>
                  <div className="expenses-form-row">
                    <label>Сума (€):</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.amount}
                      onChange={(e) => {
                        let val = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = val.split('.');
                        if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                        if (val === '.') val = '';
                        setFormData({ ...formData, amount: val });
                      }}
                      onBlur={(e) => {
                        const num = parseFloat(e.target.value);
                        if (!isNaN(num)) setFormData({ ...formData, amount: num.toFixed(2) });
                        else setFormData({ ...formData, amount: '' });
                      }}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="expenses-form-row">
                    <label>Каса:</label>
                    <select
                      value={formData.cash_box}
                      onChange={(e) => {
                        const newCashBox = e.target.value;
                        const newCategory = newCashBox === 'K1' ? 'elevator_power' : 'other';
                        setFormData({ ...formData, cash_box: newCashBox, category: newCategory });
                      }}
                    >
                      <option value="K1">Каса 1 (Поддръжка)</option>
                      <option value="K2">Каса 2</option>
                    </select>
                  </div>
                  <div className="expenses-form-row">
                    <label>Категория:</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      {formData.cash_box === 'K1' ? (
                        <>
                          <option value="elevator_power">Ток асансьор</option>
                          <option value="general_power">Общ ток</option>
                          <option value="elevator_maintenance">Такса асансьор</option>
                          <option value="manager_fee">Хонорар</option>
                          <option value="intercom">Дом. сис.</option>
                          <option value="other">Друго</option>
                        </>
                      ) : (
                        <option value="other">Друго (ремонт)</option>
                      )}
                    </select>
                  </div>
                  <div className="expenses-form-row">
                    <label>Описание:</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Въведете описание"
                    />
                  </div>
                  <div className="add-other-actions">
                    <button className="cancel-btn" onClick={() => setShowForm(false)} disabled={saving}>
                      Отказ
                    </button>
                    <button className="save-btn" onClick={handleSave} disabled={saving}>
                      {saving ? 'Запазване...' : 'Запази'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="modal-actions">
            <button className="close-btn" onClick={onClose}>Затвори</button>
          </div>

          {deleteConfirm && (
            <ConfirmModal
              title="Изтриване на разход"
              message="Сигурни ли сте, че искате да изтриете този разход?"
              confirmText="Да, изтрий"
              cancelText="Отказ"
              confirmColor="danger"
              onConfirm={handleDelete}
              onCancel={() => setDeleteConfirm(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}