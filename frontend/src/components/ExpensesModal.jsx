import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api.js';
import Spinner from './Spinner.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import { useRef } from 'react';
import { useScrollLock } from '../hooks/useScrollLock.js';
import '../pages/Dashboard.css';
// import './ChargeDetailsModal.css'; // за да ползваме общите стилове
import './ExpensesModal.css';

export default function ExpensesModal({ onClose }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [openingBalance, setOpeningBalance] = useState('0.00');
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [originalBalance, setOriginalBalance] = useState('0.00');
  const [balanceChanged, setBalanceChanged] = useState(false);
  const modalRef = useRef(null);

  useFocusTrap(modalRef, !deleteConfirm);
  useScrollLock();
  console.log('originalBalance:', originalBalance)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    description: '',
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
        setOpeningBalance(settingsRes.data.opening_balance || '0.00');
        setOriginalBalance(parseFloat(settingsRes.data.opening_balance || '0.00').toFixed(2));
      } catch {
        toast.error('Грешка при зареждане на разходите');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSave = async () => {
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
        type: 'other', // или какъвто тип искаш
        description: formData.description.trim(),
      });

      toast.success('Разходът е добавен');
      setShowForm(false);
      setFormData({ date: new Date().toISOString().slice(0, 10), amount: '', description: '' });

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
              {/* Поле за начално салдо */}
              <div className="balance-field">
                <div className="balance-inline-row">
                  <label>Начално салдо от предходната година (€):</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={openingBalance}
                    disabled={!isEditingBalance}
                    onChange={(e) => {
                      let val = e.target.value.replace(/[^0-9.]/g, '');
                      const parts = val.split('.');
                      if (parts.length > 2) {
                        val = parts[0] + '.' + parts.slice(1).join('');
                      }
                      if (val === '.') val = '';
                      setOpeningBalance(val);
                      setBalanceChanged(true); // <-- отбелязваме, че има промяна
                    }}
                    onBlur={async (e) => {
                      const num = parseFloat(e.target.value);
                      if (isNaN(num)) {
                        setOpeningBalance('0.00');
                        return;
                      }
                      const formatted = num.toFixed(2);

                      if (formatted === originalBalance) {
                        setIsEditingBalance(false);
                        return;
                      }

                      setOpeningBalance(formatted);
                      try {
                        await api.put('/settings', { opening_balance: formatted });
                        toast.success('Началното салдо е запазено');
                        setOriginalBalance(formatted);
                        setIsEditingBalance(false);
                        setBalanceChanged(false);
                      } catch {
                        toast.error('Грешка при запазване');
                      }
                    }}
                    placeholder="0.00"
                    className={`${isEditingBalance ? 'editable-balance' : 'disabled-balance'} ${balanceChanged ? 'changed-balance' : ''}`} />
                  <label className="edit-checkbox-label">
                    <input
                      type="checkbox"
                      checked={isEditingBalance}
                      onChange={(e) => setIsEditingBalance(e.target.checked)}
                    />
                    Редактирай
                  </label>
                </div>
              </div>
              {expenses.length === 0 ? (
                <p className="no-payments">Няма записани разходи</p>
              ) : (
                <table className="payments-table other-table expenses-table">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Сума</th>
                      <th>Описание</th>
                      <th>Изтрий</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id}>
                        <td>{new Date(e.date).toLocaleDateString('bg-BG')}</td>
                        <td className="text-right expense-row">{parseFloat(e.amount).toFixed(2)} €</td>
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
                <div className="add-other-form">
                  <div className="expenses-form-row">
                    <label>Дата:</label>
                    <input
                      type="date"
                      value={formData.date}
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
                        if (parts.length > 2) {
                          val = parts[0] + '.' + parts.slice(1).join('');
                        }
                        if (val === '.') val = '';
                        setFormData({ ...formData, amount: val });
                      }}
                      onBlur={(e) => {
                        const num = parseFloat(e.target.value);
                        if (!isNaN(num)) {
                          setFormData({ ...formData, amount: num.toFixed(2) });
                        } else {
                          setFormData({ ...formData, amount: '' });
                        }
                      }}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="expenses-form-row">
                    <label>Описание:</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Напр. Ремонт на асансьор"
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