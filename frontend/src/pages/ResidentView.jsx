import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api.js';
import { useAuth } from '../useAuth.js';
import Spinner from '../components/Spinner.jsx';
import { monthLabel } from '../components/i18n/translate.js';
import ChangePasswordModal from '../components/ChangePasswordModal.jsx';
import { fillMissingMonths } from '../utils/monthUtils.js';
import './Dashboard.css';
import './ResidentView.css';

export default function ResidentView() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [history, setHistory] = useState({ monthly: [], other: [] });
  const [loading, setLoading] = useState(true);
  const [startMonth, setStartMonth] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Зареждане на историята и
  // Зареждане на start_month
  useEffect(() => {
    const loadData = async () => {
      try {
        const [historyRes, settingsRes] = await Promise.all([
          api.get('/charges/history/me'),
          api.get('/settings')
        ]);
        const startM = settingsRes.data.start_month;
        setStartMonth(startM);
        const filledMonthly = fillMissingMonths(historyRes.data.monthly, startM);
        setHistory({ monthly: filledMonthly, other: historyRes.data.other });
      } catch {
        toast.error('Грешка при зареждане');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Изчисляване на дълга
  const unpaidStats = useMemo(() => {
    // Месечни такси: неплатени
    const unpaidMonthly = history.monthly.filter(m => m.status === 'unpaid');
    const unpaidCount = unpaidMonthly.length;
    const unpaidDue = unpaidMonthly.reduce((sum, m) => sum + m.total_amount, 0);

    // Други разходи: неплатени
    const unpaidOther = history.other.filter(o => o.status === 'unpaid');
    const otherCount = unpaidOther.length;
    const otherDue = unpaidOther.reduce((sum, o) => sum + o.amount, 0);

    const totalDue = unpaidDue + otherDue;

    return {
      unpaidCount, unpaidDue,
      otherCount, otherDue,
      totalDue,
    };
  }, [history]);

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
            Смяна на парола
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

        {/* Карта с дълга */}
        {!loading && (
          <div className={`stat-unpaid-card ${unpaidStats.totalDue === 0 ? 'stat-unpaid-ok'
            : unpaidStats.unpaidCount + unpaidStats.otherCount <= 2 ? 'stat-unpaid-warning'
              : 'stat-unpaid-danger'
            }`}>
            {unpaidStats.totalDue === 0 ? (
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
        )}

        {loading ? (
          <Spinner />
        ) : (
          <>
            {/* Месечни такси */}
            <h3 className="modal-section-title">Месечни такси</h3>
            {history.monthly.length === 0 ? (
              <p className="no-payments">Няма записани месечни такси</p>
            ) : (
              <div className="table-wrapper">
                <table className="resident-payments-table">
                  <thead>
                    <tr>
                      <th>Месец</th>
                      <th>Асанс.<br />такса</th>
                      <th>Асанс.<br />ток</th>
                      <th>Общ<br />ток</th>
                      <th>Фонд<br />Р.О.</th>
                      <th>Дом.<br />сис.</th>
                      <th>Хоно-<br />рар</th>
                      <th>Всич-<br />ко</th>
                      <th>Ста-<br />тус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.monthly
                      .filter(m => {
                        const now = new Date();
                        const currentYear = now.getFullYear();
                        const currentMonthNum = now.getMonth() + 1;
                        let endYear = currentYear;
                        let endMonthNum = currentMonthNum + 3;
                        if (endMonthNum > 12) {
                          endMonthNum -= 12;
                          endYear += 1;
                        }
                        const endMonth = `${endYear}-${String(endMonthNum).padStart(2, '0')}`;
                        return m.month <= endMonth;
                      })
                      .sort((a, b) => a.month.localeCompare(b.month))
                      .map((m) => (
                        <tr key={m.id}>
                          <td>{monthLabel(m.month)}</td>
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

            {/* Други разходи */}
            <h3 className="modal-section-title" style={{ marginTop: '2rem' }}>Други разходи</h3>
            {history.other.length === 0 ? (
              <p className="no-payments">Няма други разходи</p>
            ) : (
              <div className="table-wrapper">
                <table className="resident-payments-table other-table">
                  <thead>
                    <tr>
                      <th>Месец</th>
                      <th>Сума</th>
                      <th>Описание</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.other
                      .slice()
                      .sort((a, b) => a.month.localeCompare(b.month))
                      .map((o) => (
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
              </div>
            )}
          </>
        )}

        {showChangePassword && (
          <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
        )}
      </main>
    </div>
  );
}