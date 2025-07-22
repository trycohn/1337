import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import api from '../utils/api';

const AuthContext = createContext({
  user: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
  updateUser: () => {},
  loading: false
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Защита от частых запросов к /api/users/me
  const lastCheckTime = useRef(0);
  const CHECK_COOLDOWN = 5000; // 5 секунд между проверками

  // Проверяем аутентификацию при загрузке
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      // Защита от частых запросов
      const now = Date.now();
      if (now - lastCheckTime.current < CHECK_COOLDOWN) {
        console.log('🛡️ [AuthContext] Пропускаем проверку - слишком частый вызов');
        setLoading(false);
        return;
      }
      
      try {
        lastCheckTime.current = now;
        console.log('🔐 [AuthContext] Проверяем авторизацию...');
        const response = await api.get('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ [AuthContext] Пользователь авторизован:', response.data.username);
        setUser(response.data);
      } catch (error) {
        console.error('❌ [AuthContext] Ошибка аутентификации:', error);
        localStorage.removeItem('token');
        setUser(null);
      }
      setLoading(false);
    };

    checkAuth();

    // Слушатель изменений localStorage для синхронизации между вкладками
    const handleStorageChange = (event) => {
      if (event.key === 'token') {
        if (event.newValue) {
          // Токен добавлен/изменен - проверяем авторизацию
          checkAuth();
        } else {
          // Токен удален - выходим
          setUser(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Функция входа
  const login = async (token, userData) => {
    localStorage.setItem('token', token);
    if (userData) {
      console.log('✅ [AuthContext] Вход выполнен с данными пользователя:', userData.username);
      setUser(userData);
    } else {
      try {
        const response = await api.get('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ [AuthContext] Вход выполнен, получены данные пользователя:', response.data.username);
        setUser(response.data);
      } catch (error) {
        console.error('❌ [AuthContext] Ошибка получения данных пользователя:', error);
      }
    }
  };

  // Функция выхода
  const logout = () => {
    console.log('🚪 [AuthContext] Выход из системы');
    localStorage.removeItem('token');
    setUser(null);
  };

  // Функция обновления данных пользователя
  const updateUser = (updatedData) => {
    setUser(prevUser => prevUser ? { ...prevUser, ...updatedData } : null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        updateUser,
        loading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export default AuthContext; 