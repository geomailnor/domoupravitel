import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api.js';
import { useAuth } from '../useAuth.js';
import Spinner from '../components/Spinner.jsx';
import { statusLabel, typeLabel, monthLabel } from '../components/i18n/translate.js';
import ChangePasswordModal from '../components/ChangePasswordModal.jsx';
import './Dashboard.css';
import './ResidentView.css';

export default function ResidentView() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startMonth, setStartMonth] = useState('');
  const [monthlyFee, setMonthlyFee] = useState(7);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Зареждане на плащанията
  useEffect(() => {
    const loadPayments = async () => {
      try {
        const response = await api.get('/payments/me');
        setPayments(response.data);
      } catch (err) {
        const message = err.response?.data?.error || 'Грешка при зареждане';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    loadPayments();
  }, []);

  // Зареждане на start_month
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

  // Изчисляване на неплатени месеци
  const unpaidStats = useMemo(() => {
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

    const paidOrPartialSet = new Set(
      payments
        .filter(p => p.type === 'monthly' && (p.status === 'paid' || p.status === 'partial'))
        .map(p => p.month)
    );

    const unpaidMonths = dueMonths.filter(m => !paidOrPartialSet.has(m));
    const unpaidCount = unpaidMonths.length;
    const unpaidDue = unpaidCount * monthlyFee;

    const partialMonthly = payments.filter(
      p => p.type === 'monthly' && p.status === 'partial' && p.month >= startMonth
    );
    const partialPaidSum = partialMonthly.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const partialCount = partialMonthly.length;
    const partialDue = partialCount * monthlyFee - partialPaidSum;

    // 3. Неплатени други разходи (само от startMonth нататък)
    const unpaidOther = payments.filter(
      p => p.type === 'other' && p.status === 'unpaid' && p.month >= startMonth
    );
    const otherCount = unpaidOther.length;
    const otherDue = unpaidOther.reduce((sum, p) => sum + parseFloat(p.amount), 0);

    const totalDue = unpaidDue + partialDue + otherDue;

    return {
      unpaidCount, unpaidDue,
      partialCount, partialDue,
      otherCount, otherDue,
      totalDue,
    };
  }, [startMonth, payments, monthlyFee]);

  const handleLogout = () => {
    logout();
    toast.success('Излязохте успешно');
    navigate('/login');
  };

  return (
    <div className="dashboard resident-dashboard">
      <header>
        <h1>Апартамент {user?.number}</h1>
        <div>
          {user?.owner_name && <span>{user.owner_name}</span>}
          <button
            className="change-password-btn"
            onClick={() => setShowChangePassword(true)}
            title="Сменете паролата"
          >
            Смени парола
          </button>
          <button onClick={handleLogout} title="Излизане от системата">Изход</button>
        </div>
      </header>

      <main>
        <div className="main-header">
          <h2>Моите плащания</h2>
          {startMonth && (
            <div className="start-month-info">
              Следим от: <strong>{monthLabel(startMonth)}</strong>
            </div>
          )}
        </div>

        {!loading && settingsLoaded && (() => {
          const hasDebt = unpaidStats.totalDue > 0;

          return (
            <div className={`stat-unpaid-card ${!hasDebt ? 'stat-unpaid-ok'
              : unpaidStats.unpaidCount + unpaidStats.partialCount + unpaidStats.otherCount <= 2 ? 'stat-unpaid-warning'
                : 'stat-unpaid-danger'
              }`}>
              {!hasDebt ? (
                <div className="stat-unpaid-label">Всичко е платено ✓</div>
              ) : (
                <div className="debt-summary">
                  {unpaidStats.unpaidCount > 0 && (
                    <div className="debt-row">
                      <span className="debt-label">
                        {unpaidStats.unpaidCount} {unpaidStats.unpaidCount === 1 ? 'неплатен месец' : 'неплатени месеца'}
                      </span>
                      <span className="debt-amount">{unpaidStats.unpaidDue.toFixed(2)} €</span>
                    </div>
                  )}

                  {unpaidStats.partialCount > 0 && (
                    <div className="debt-row">
                      <span className="debt-label">
                        {unpaidStats.partialCount} {unpaidStats.partialCount === 1 ? 'частично неплатен месец' : 'частично неплатени месеца'}
                      </span>
                      <span className="debt-amount">{unpaidStats.partialDue.toFixed(2)} €</span>
                    </div>
                  )}

                  {unpaidStats.otherCount > 0 && (
                    <div className="debt-row">
                      <span className="debt-label">
                        {unpaidStats.otherCount} {unpaidStats.otherCount === 1 ? 'неплатен доп. разход' : 'неплатени доп. разходи'}
                      </span>
                      <span className="debt-amount">{unpaidStats.otherDue.toFixed(2)} €</span>
                    </div>
                  )}

                  <div className="debt-total-row">
                    <span>Общо дължимо:</span>
                    <span className="debt-total-amount">{unpaidStats.totalDue.toFixed(2)} €</span>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {loading ? (
          <Spinner />
        ) : payments.length === 0 ? (
          <p className="no-payments">Няма записани плащания</p>
        ) : (
          <div className="table-wrapper">
            <table className="resident-payments-table">
              <thead>
                <tr>
                  <th>Месец</th>
                  <th>Сума</th>
                  <th>Вид</th>
                  <th>Статус</th>
                  <th>Описание</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{monthLabel(p.month)}</td>
                    <td className={p.status === 'unpaid' ? 'amount-empty' : 'amount-cell'}>
                      {p.status === 'unpaid' ? '—' : `${p.amount} €`}
                    </td>
                    <td>{typeLabel(p.type)}</td>
                    <td className={`status-${p.status}`}>
                      {statusLabel(p.status)}
                    </td>
                    <td className="description-cell" title={p.description || ''}>
                      {p.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {showChangePassword && (
          <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
        )}
      </main>
    </div>
  );
}