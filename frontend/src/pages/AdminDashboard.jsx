import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api.js';
import { useAuth } from '../useAuth.js';
import Spinner from '../components/Spinner.jsx';
import ChargeDetailsModal from '../components/ChargeDetailsModal.jsx';
import { monthLabel } from '../components/i18n/translate.js';
import BulkPaymentModal from '../components/BulkPaymentModal.jsx';
import ProfileModal from '../components/ProfileModal.jsx';
import HelpModal from '../components/HelpModal.jsx';
import SetupQuestionModal from '../components/SetupQuestionModal.jsx';
import PrintMonthlyReport from '../components/PrintMonthlyReport.jsx';
import SettingsModal from '../components/SettingsModal.jsx';
import './Dashboard.css';
import './AdminDashboard.css';

// Компонент за инлайн редактиране на поле
const EditableCell = ({ value, onSave, type = 'text', disabled = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  // Ако стойността се промени отвън, я обновяваме
  if (!isEditing && localValue !== value) {
    setLocalValue(value);
  }

  const handleBlur = () => {
    setIsEditing(false);
    if (localValue !== value) {
      onSave(localValue);
    }
  };

  if (disabled) {
    return <span style={{ color: '#bdc3c7' }}>{value}</span>;
  }

  if (!isEditing) {
    return (
      <span
        onClick={() => setIsEditing(true)}
        className="inline-edit-trigger"
        title="Кликнете за редакция"
      >
        {value || '—'}
      </span>
    );
  }

  return (
    <input
      type={type}
      value={localValue}
      onChange={(e) => {
        const val = type === 'number' ? e.target.value.replace(/\D/g, '') : e.target.value;
        setLocalValue(val);
      }}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.target.blur();
        if (e.key === 'Escape') {
          setLocalValue(value);
          setIsEditing(false);
        }
      }}
      onFocus={(e) => e.target.select()}
      // ⭐ Добавяме changed, ако локалната стойност е различна от оригиналната
      className={`editable-input ${localValue !== value ? 'changed' : ''}`}
      autoFocus
    />
  );
};

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [floorFilter, setFloorFilter] = useState('');
  const [selectedCharge, setSelectedCharge] = useState(null);
  const [startMonth, setStartMonth] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const todayMonth = new Date().toISOString().slice(0, 7);
  const isPastMonth = currentMonth < todayMonth;
  const isBeforeStartMonth = startMonth ? currentMonth < startMonth : false;
  const [showSetupQuestion, setShowSetupQuestion] = useState(
    () => localStorage.getItem('domoupravitel_needs_question') === 'true'
  );

  // Зареждане на таксите за текущия месец
  useEffect(() => {
    const loadCharges = async () => {
      try {
        setLoading(true);
        // 1. Вземаме таксите
        const chargesRes = await api.get(`/charges?month=${currentMonth}`);

        // 2. Вземаме апартаментите (за да намерим ID-то по номер)
        const apartmentsRes = await api.get('/apartments');

        // 3. Свързваме ги: за всяка такса добавяме ap_id
        const apartmentsMap = {};
        apartmentsRes.data.forEach(apt => {
          apartmentsMap[apt.number] = apt.id;
        });

        const chargesWithApId = chargesRes.data.map(charge => ({
          ...charge,
          ap_id: apartmentsMap[charge.ap_number] || null
        }));

        setCharges(chargesWithApId);
      } catch (err) {
        const message = err.response?.data?.error || 'Грешка при зареждане';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    loadCharges();
  }, [currentMonth]);

  // Зареждане на start_month
  useEffect(() => {
    const loadStartMonth = async () => {
      try {
        const response = await api.get('/settings');
        setStartMonth(response.data.start_month || '');
      } catch {
        console.error('Грешка при зареждане на start_month');
      }
    };
    loadStartMonth();
  }, []);

  const handleLogout = () => {
    logout();
    toast.success('Излязохте успешно');
    navigate('/login');
  };

  // Инлайн запазване на промяна
  const handleInlineSave = async (chargeId, field, newValue) => {
    const oldCharges = [...charges];
    setCharges((prev) =>
      prev.map((c) => (c.charge_id === chargeId ? { ...c, [field]: newValue } : c))
    );

    try {
      const payload = {};
      if (field === 'residents_count') payload.residents_count = newValue;
      if (field === 'elevator_payers_count') payload.elevator_payers_count = newValue;
      if (field === 'owner_name') payload.owner_name = newValue; // <-- Ново

      const res = await api.put(`/charges/${chargeId}`, payload);

      setCharges((prev) =>
        prev.map((c) => (c.charge_id === chargeId ? { ...c, ...res.data } : c))
      );
      toast.success('Запазено', { duration: 1000 });
    } catch {
      setCharges(oldCharges);
      toast.error('Грешка при запазване');
    }
  };
  const toggleStatus = async (chargeId, currentStatus) => {
    const newStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';

    // Оптимистично обновяване
    const oldCharges = [...charges];
    setCharges((prev) =>
      prev.map((c) => (c.charge_id === chargeId ? { ...c, status: newStatus } : c))
    );

    try {
      await api.put(`/charges/${chargeId}`, { status: newStatus });
    } catch {
      setCharges(oldCharges);
      toast.error('Грешка при промяна на статуса');
    }
  };
  const filteredCharges = charges.filter((charge) => {
    if (floorFilter && charge.floor !== parseInt(floorFilter, 10)) {
      return false;
    }
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;

    if (/^\d+$/.test(term)) {
      return charge.ap_number === parseInt(term, 10);
    }
    const nameMatch = (charge.owner_name || '').toLowerCase().includes(term);
    return nameMatch;
  });

  const clearFilters = () => {
    setSearchTerm('');
    setFloorFilter('');
  };
  const calculateTotals = () => {
    return filteredCharges.reduce((acc, charge) => ({
      elevator_fee: acc.elevator_fee + Number(charge.elevator_fee || 0),
      elevator_power: acc.elevator_power + Number(charge.elevator_power || 0),
      general_power: acc.general_power + Number(charge.general_power || 0),
      fund_ro: acc.fund_ro + Number(charge.fund_ro || 0),
      intercom: acc.intercom + Number(charge.intercom || 0),
      manager_fee: acc.manager_fee + Number(charge.manager_fee || 0),
      total_amount: acc.total_amount + Number(charge.total_amount || 0),
    }), {
      elevator_fee: 0, elevator_power: 0, general_power: 0,
      fund_ro: 0, intercom: 0, manager_fee: 0, total_amount: 0
    });
  };
  const calculatePaidTotals = () => {
    return filteredCharges
      .filter(c => c.status === 'paid')
      .reduce((acc, charge) => ({
        total_amount: acc.total_amount + Number(charge.total_amount || 0),
      }), { total_amount: 0 });
  };
  return (
    <div className="dashboard admin-dashboard">
      <header>
        <h1>Панел на домоуправителя</h1>
        <div>
          <span className='hello-admin'>Здравей, {user?.username}!</span>
          <button className="help-btn" onClick={() => setShowHelp(true)} title="Помощ">
            Помощ
          </button>
          <button className="change-username-btn" onClick={() => setShowProfile(true)} title="Профил">
            Профил
          </button>
          <button onClick={handleLogout} title="Изход от системата">
            Изход
          </button>
        </div>
      </header>

      <main>
        <div className='main-header'>
          <h2>Апартаменти</h2>
          {startMonth && (
            <div className="start-month-info">
              <span className="full-text">Следим от: <strong>{monthLabel(startMonth)}</strong></span>
              <span className="short-text">от <strong>{monthLabel(startMonth)}</strong></span>
            </div>
          )}
          <input
            type="month"
            value={currentMonth}
            onChange={(e) => setCurrentMonth(e.target.value)}
            className="month-selector-input"
          />
          <button
            type="button"
            className="report-btn"
            // onClick={() => setShowMonthlyReport(true)}
            title="Месечен отчет"
          >
            📊<span className="btn-text"> Месечен отчет</span>
          </button>
        </div>

        <div className="filters-row">
          <input
            type="text"
            placeholder="Търсене по номер или име..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />

          <select
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
            className="floor-select"
          >
            <option value="">Всички етажи</option>
            {Array.from({ length: 15 }, (_, i) => i + 1).map((f) => (
              <option key={f} value={f}>Етаж {f}</option>
            ))}
          </select>
          {(floorFilter || searchTerm) && (
            <button type="button" onClick={clearFilters} className="clear-filters-btn on-mobile-btn">
              Изчисти филтрите
            </button>
          )}
          <button
            type="button"
            // onClick={() => setShowBulkModal(true)}
            className="bulk-btn"
            title="Бързо въвеждане на плащания"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="#f39c12">
              <path d="M7 2h9l-2 7h5l-9 13h-1l1.5-9H5l3-11z" />
            </svg>
            Бързо въвеждане
          </button>
        </div>

        {!loading && searchTerm && filteredCharges.length === 0 && (
          <div className="no-results">Няма намерени апартаменти</div>
        )}

        {loading ? (
          <Spinner />
        ) : (
          <div className="table-wrapper">
            <table className="apartments-table">
              <thead>
                <tr>
                  <th>Ет.</th>
                  <th>Ап.№</th>
                  <th>Собственик</th>
                  <th>Бр.<br />жив.</th>
                  <th>Плащ.<br />асанс.</th>
                  <th className={!isBeforeStartMonth ? "clickable-header" : ""} onClick={!isBeforeStartMonth ? () => setShowSettings(true) : undefined} title={!isBeforeStartMonth ? "Кликнете за промяна" : ""}>Асанс.<br />такса</th>
                  <th className={!isBeforeStartMonth ? "clickable-header" : ""} onClick={!isBeforeStartMonth ? () => setShowSettings(true) : undefined} title={!isBeforeStartMonth ? "Кликнете за промяна" : ""}>Асанс.<br />ток</th>
                  <th className={!isBeforeStartMonth ? "clickable-header" : ""} onClick={!isBeforeStartMonth ? () => setShowSettings(true) : undefined} title={!isBeforeStartMonth ? "Кликнете за промяна" : ""}>Общ<br />ток</th>
                  <th className={!isBeforeStartMonth ? "clickable-header" : ""} onClick={!isBeforeStartMonth ? () => setShowSettings(true) : undefined} title={!isBeforeStartMonth ? "Кликнете за промяна" : ""}>Фонд<br />Р.О.</th>
                  <th className={!isBeforeStartMonth ? "clickable-header" : ""} onClick={!isBeforeStartMonth ? () => setShowSettings(true) : undefined} title={!isBeforeStartMonth ? "Кликнете за промяна" : ""}>Дом.<br />сис.</th>
                  <th className={!isBeforeStartMonth ? "clickable-header" : ""} onClick={!isBeforeStartMonth ? () => setShowSettings(true) : undefined} title={!isBeforeStartMonth ? "Кликнете за промяна" : ""}>Хоно-<br />рар</th>
                  <th>Всичко</th>
                  <th>Статус</th>
                  <th>Още</th>
                </tr>
              </thead>
              <tbody>
                {filteredCharges.map((charge) => (
                  <tr key={charge.charge_id}>
                    <td>{charge.floor}</td>
                    <td><strong>{charge.ap_number}</strong></td>
                    <td title={charge.owner_name || ''}>
                      {charge.is_vacant ? (
                        <em style={{ color: '#7f8c8d' }}>СВОБОДЕН</em>
                      ) : (
                        <EditableCell
                          value={charge.owner_name || ''}
                          onSave={(val) => handleInlineSave(charge.charge_id, 'owner_name', val)}
                        />
                      )}
                    </td>

                    <td className="text-center">
                      <EditableCell
                        value={charge.residents_count}
                        onSave={(val) => handleInlineSave(charge.charge_id, 'residents_count', val)}
                        disabled={charge.is_vacant || isPastMonth}
                      />
                    </td>

                    <td className="text-center">
                      <EditableCell
                        value={charge.elevator_payers_count}
                        onSave={(val) => handleInlineSave(charge.charge_id, 'elevator_payers_count', val)}
                        disabled={charge.is_vacant || isPastMonth}
                      />
                    </td>

                    <td className="text-right">{Number(charge.elevator_fee).toFixed(2)}</td>
                    <td className="text-right">{Number(charge.elevator_power).toFixed(2)}</td>
                    <td className="text-right">{Number(charge.general_power).toFixed(2)}</td>
                    <td className="text-right">{Number(charge.fund_ro).toFixed(2)}</td>
                    <td className="text-right">{Number(charge.intercom).toFixed(2)}</td>
                    <td className="text-right">{Number(charge.manager_fee).toFixed(2)}</td>
                    <td className="text-right font-bold">{Number(charge.total_amount).toFixed(2)}</td>

                    <td className="text-center">
                      <button
                        className={`status-btn ${charge.status === 'paid' ? 'paid' : 'unpaid'}`}
                        onClick={() => toggleStatus(charge.charge_id, charge.status)}
                      >
                        {charge.status === 'paid' ? 'Плат.' : 'Непл.'}
                      </button>
                    </td>

                    <td className="text-center">
                      <button
                        className="details-btn"
                        onClick={() => {
                          setSelectedCharge(charge);
                        }}
                        title="Виж парола и история"
                      >
                        Подр.
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="totals-row">
                  <td colSpan="5" className="totals-label">Общо (за плащане):</td>
                  <td className="text-right font-bold">{calculateTotals().elevator_fee.toFixed(2)}</td>
                  <td className="text-right font-bold">{calculateTotals().elevator_power.toFixed(2)}</td>
                  <td className="text-right font-bold">{calculateTotals().general_power.toFixed(2)}</td>
                  <td className="text-right font-bold">{calculateTotals().fund_ro.toFixed(2)}</td>
                  <td className="text-right font-bold">{calculateTotals().intercom.toFixed(2)}</td>
                  <td className="text-right font-bold">{calculateTotals().manager_fee.toFixed(2)}</td>
                  <td className="text-right font-bold">{calculateTotals().total_amount.toFixed(2)}</td>
                  <td colSpan="2"></td>
                </tr>
                <tr className="totals-row revenue-row">
                  <td colSpan="11" className="revenue-label">Приход за блока (без хонорар):</td>
                  <td className="text-right font-bold revenue-amount">
                    {(calculateTotals().total_amount - calculateTotals().manager_fee).toFixed(2)}
                  </td>
                  <td colSpan="2"></td>
                </tr>
                <tr className="totals-row paid-row">
                  <td colSpan="11" className="paid-label">Реално платено:</td>
                  <td className="text-right font-bold paid-amount">
                    {calculatePaidTotals().total_amount.toFixed(2)}
                  </td>
                  <td colSpan="2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {selectedCharge && (
          <ChargeDetailsModal
            apartment={selectedCharge}
            onClose={() => setSelectedCharge(null)}
            onUpdate={async () => {
              // Презареждаме charges
              const res = await api.get(`/charges?month=${currentMonth}`);
              const apartmentsRes = await api.get('/apartments');
              const apartmentsMap = {};
              apartmentsRes.data.forEach(apt => { apartmentsMap[apt.number] = apt.id; });

              const updatedCharges = res.data.map(charge => ({
                ...charge,
                ap_id: apartmentsMap[charge.ap_number] || null
              }));

              setCharges(updatedCharges);

              // ⭐ Обновяваме и selectedCharge с новите данни
              const updatedSelected = updatedCharges.find(c => c.charge_id === selectedCharge.charge_id);
              if (updatedSelected) setSelectedCharge(updatedSelected);
            }}
          />
        )}
        {showBulkModal && <BulkPaymentModal onClose={() => setShowBulkModal(false)} />}
        {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
        {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
        {showSetupQuestion && (
          <SetupQuestionModal
            onComplete={() => {
              localStorage.removeItem('domoupravitel_needs_question');
              setShowSetupQuestion(false);
            }}
          />
        )}
        {showMonthlyReport && (
          <PrintMonthlyReport month={currentMonth} onClose={() => setShowMonthlyReport(false)} />
        )}
        {showSettings && (
          <SettingsModal
            onClose={() => setShowSettings(false)}
            onSave={() => {
              // Презареждаме данните след запазване
              api.get(`/charges?month=${currentMonth}`).then(res => setCharges(res.data));
            }}
          />
        )}
      </main>
    </div>
  );
}