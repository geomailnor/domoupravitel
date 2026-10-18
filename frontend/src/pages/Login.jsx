import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../useAuth.js';
import oko1 from '../assets/oko1.png';
import oko2 from '../assets/oko2.png';
import domo from '../assets/domo.png';
import ForgotPasswordModal from '../components/ForgotPasswordModal.jsx';
import './Login.css';

export default function Login() {
  const [role, setRole] = useState(() => {
    const lastRole = localStorage.getItem('domoupravitel_last_role');
    return lastRole === 'resident' ? 'resident' : 'admin';
  });
  const [username, setUsername] = useState(() => {
    const lastRole = localStorage.getItem('domoupravitel_last_role');
    const lastUsername = localStorage.getItem('domoupravitel_last_username');

    if (lastRole === 'resident') return '';
    if (lastRole === 'admin') return lastUsername || 'admin';
    return '';
  });
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Провери дали вече има логнат потребител
    const existingToken = localStorage.getItem('domoupravitel_token');
    const existingUser = localStorage.getItem('domoupravitel_user');

    if (existingToken && existingUser) {
      try {
        const existing = JSON.parse(existingUser);
        const roleLabel = existing.role === 'admin' ? 'Домоуправител' : 'Живущ';
        setError(`Вече сте влезли като ${roleLabel}. Първо излезте от текущия акаунт.`);
        return;
      } catch {
        // Повреден JSON – изчисти и продължи
        localStorage.removeItem('domoupravitel_token');
        localStorage.removeItem('domoupravitel_user');
      }
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/login', {
        role,
        username,
        password,
      });

      const { token, user } = response.data;
      if (user.username) { localStorage.setItem('domoupravitel_last_username', user.username); }
      login(user, token, rememberMe);

      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/resident');
      }
    } catch (err) {
      const message = err.response?.data?.error || 'Грешка при вход';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='login-page'>
      <div className="login-container">
        <div className="login-logo">
          <img src={domo} alt="Домоуправител" />
        </div>
        <h2>Вход в системата</h2>

        <div className="role-tabs">
          <button
            type="button"
            className={role === 'admin' ? 'tab active' : 'tab'}
            onClick={() => {
              setRole('admin');
              const lastUsername = localStorage.getItem('domoupravitel_last_username');
              setUsername(lastUsername || 'admin');
              setError('');
              localStorage.setItem('domoupravitel_last_role', 'admin');
            }}
          >
            Домоуправител
          </button>
          <button
            type="button"
            className={role === 'resident' ? 'tab active' : 'tab'}
            onClick={() => {
              setRole('resident');
              setUsername('');
              setError('');
              localStorage.setItem('domoupravitel_last_role', 'resident');
            }}
          >
            Живущ
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="username">
              {role === 'admin' ? 'Потребителско име:' : 'Номер на апартамент:'}
            </label>
            <input
              id="username"
              name="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onFocus={() => setError('')}
              required
            />
          </div>

          <div>
            <label htmlFor="password">Парола:</label>
            <div className="password-field">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setError('')}
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Скрий паролата' : 'Покажи паролата'}
              >
                <img src={showPassword ? oko1 : oko2} alt="" />
              </button>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}
          <label className="remember-me">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Запомни ме
          </label>
          <button type="submit" disabled={loading}>
            {loading ? <span className="spinner-button"></span> : 'Влез'}
          </button>
          {role === 'admin' && (
            <button
              type="button"
              className="forgot-password-link"
              onClick={() => setShowForgotPassword(true)}
            >
              Забравена парола?
            </button>
          )}
        </form>
        {showForgotPassword && (
          <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} />
        )}
      </div>
    </div>
  );
}