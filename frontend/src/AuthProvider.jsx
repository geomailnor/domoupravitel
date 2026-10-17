import { useState } from 'react';
import { AuthContext } from './authContext.js';

const TOKEN_KEY = 'domoupravitel_token';
const USER_KEY = 'domoupravitel_user';

function getInitialState() {
  // Провери в localStorage (запомнен)
  let savedToken = localStorage.getItem(TOKEN_KEY);
  let savedUser = localStorage.getItem(USER_KEY);

  // Ако няма – провери в sessionStorage (незапомнен)
  if (!savedToken || !savedUser) {
    savedToken = sessionStorage.getItem(TOKEN_KEY);
    savedUser = sessionStorage.getItem(USER_KEY);
  }

  if (savedToken && savedUser) {
    try {
      return { token: savedToken, user: JSON.parse(savedUser) };
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
    }
  }

  return { token: null, user: null };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getInitialState().user);
  const [token, setToken] = useState(() => getInitialState().token);

  const login = (userData, tokenValue, remember = true) => {
    setUser(userData);
    setToken(tokenValue);

    const storage = remember ? localStorage : sessionStorage;
    const otherStorage = remember ? sessionStorage : localStorage;

    // Изчисти другия storage, за да няма конфликт
    otherStorage.removeItem(TOKEN_KEY);
    otherStorage.removeItem(USER_KEY);

    storage.setItem(TOKEN_KEY, tokenValue);
    storage.setItem(USER_KEY, JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}