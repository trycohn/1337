import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import PasswordStrengthIndicator from '../components/PasswordStrengthIndicator';
import '../styles/components/Auth.css';

function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  
  // 🆕 СОСТОЯНИЕ ДЛЯ ТУЛТИПОВ
  const [tooltips, setTooltips] = useState({
    login: { show: false, message: '', type: 'error' },
    register: { show: false, message: '', type: 'error' }
  });
  
  // 🆕 СОСТОЯНИЕ ДЛЯ МОДАЛЬНОГО ПРИВЕТСТВЕННОГО ОКНА
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [welcomeData, setWelcomeData] = useState({ username: '', email: '' });
  
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // 🆕 ФУНКЦИЯ ДЛЯ ПОКАЗА ТУЛТИПА
  const showTooltip = (form, message, type = 'error') => {
    setTooltips(prev => ({
      ...prev,
      [form]: { show: true, message, type }
    }));
    
    // Автоматическое скрытие через 5 секунд
    setTimeout(() => {
      setTooltips(prev => ({
        ...prev,
        [form]: { show: false, message: '', type: 'error' }
      }));
    }, 5000);
  };

  // 🆕 ФУНКЦИЯ ДЛЯ СКРЫТИЯ ТУЛТИПА
  const hideTooltip = (form) => {
    setTooltips(prev => ({
      ...prev,
      [form]: { show: false, message: '', type: 'error' }
    }));
  };

  // Проверяем URL-параметр register при загрузке компонента
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('register') === 'true') {
      setIsLogin(false);
    }
  }, [location]);

  // Проверяем токен при перенаправлении от Steam
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const token = searchParams.get('token');
    
    if (token) {
      login(token);
      showTooltip('login', 'Вы успешно вошли через Steam!', 'success');
      window.history.replaceState({}, document.title, '/login');
      setTimeout(() => {
        navigate('/');
      }, 1500);
    }
    
    const errorMessage = searchParams.get('message');
    if (errorMessage) {
      showTooltip('login', decodeURIComponent(errorMessage), 'error');
      window.history.replaceState({}, document.title, '/login');
    }
  }, [location, navigate, login]);

  // Очистка ошибок при изменении полей
  const clearFieldError = (fieldName) => {
    if (validationErrors[fieldName]) {
      setValidationErrors(prev => ({
        ...prev,
        [fieldName]: ''
      }));
    }
    // 🆕 Скрываем тултипы при изменении полей
    if (tooltips.login.show || tooltips.register.show) {
      hideTooltip('login');
      hideTooltip('register');
    }
  };

  // Валидация email
  const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  // Продвинутая валидация пароля
  const validatePassword = (password) => {
    const errors = [];
    
    if (password.length < 8) {
      errors.push('Пароль должен содержать минимум 8 символов');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Пароль должен содержать заглавные буквы');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Пароль должен содержать строчные буквы');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Пароль должен содержать цифры');
    }
    
    if (/\s/.test(password)) {
      errors.push('Пароль не должен содержать пробелы');
    }
    
    return errors;
  };

  // Валидация формы регистрации
  const validateRegistrationForm = () => {
    const errors = {};
    
    // Проверка имени пользователя
    if (!username.trim()) {
      errors.username = 'Имя пользователя обязательно';
    } else if (username.length < 3) {
      errors.username = 'Имя пользователя должно содержать минимум 3 символа';
    } else if (username.length > 20) {
      errors.username = 'Имя пользователя не должно превышать 20 символов';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      errors.username = 'Имя пользователя может содержать только буквы, цифры, _ и -';
    }
    
    // Проверка email
    if (!email.trim()) {
      errors.email = 'Email обязателен';
    } else if (!validateEmail(email)) {
      errors.email = 'Введите корректный email адрес';
    }
    
    // Проверка пароля
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      errors.password = passwordErrors[0];
    }
    
    // Проверка подтверждения пароля
    if (!confirmPassword) {
      errors.confirmPassword = 'Подтвердите пароль';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Пароли не совпадают';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await axios.post('/api/users/login', {
        email,
        password,
      });
      
      await login(response.data.token);
      showTooltip('login', 'Вы успешно вошли в систему!', 'success');
      
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Ошибка входа';
      showTooltip('login', errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    hideTooltip('register'); // Очищаем предыдущие тултипы
    
    if (!validateRegistrationForm()) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post('/api/users/register', {
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      
      // 🆕 ПОКАЗЫВАЕМ МОДАЛЬНОЕ ПРИВЕТСТВЕННОЕ ОКНО
      if (response.data.token) {
        await login(response.data.token);
        setWelcomeData({ 
          username: username.trim(), 
          email: email.trim().toLowerCase() 
        });
        setShowWelcomeModal(true);
      } else {
        showTooltip('register', `Аккаунт успешно создан! На email ${email} отправлено приветственное письмо.`, 'success');
      }
      
      // Очищаем форму
      setUsername('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setValidationErrors({});
      
      // 🆕 ПЕРЕХОД НА ГЛАВНУЮ СТРАНИЦУ ПОСЛЕ ЗАКРЫТИЯ МОДАЛЬНОГО ОКНА
      if (response.data.token) {
        setTimeout(() => {
          setShowWelcomeModal(false);
          navigate('/');
        }, 4000); // 4 секунды для чтения сообщения
      } else {
        setTimeout(() => {
          navigate('/');
        }, 2000);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Ошибка регистрации';
      showTooltip('register', errorMessage, 'error');
      
      // Обработка специфических ошибок сервера
      if (err.response?.data?.field) {
        setValidationErrors(prev => ({
          ...prev,
          [err.response.data.field]: errorMessage
        }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSteamLogin = () => {
    const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
    window.location.href = `${baseUrl}/api/users/steam`;
  };

  const handleFaceitLogin = () => {
    const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
    window.location.href = `${baseUrl}/api/users/faceit-login`;
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-tabs">
          <button
            className={`auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() => setIsLogin(true)}
          >
            Вход
          </button>
          <button
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => setIsLogin(false)}
          >
            Регистрация
          </button>
        </div>
        
        <div className="auth-form-container">
          <form 
            onSubmit={handleLogin} 
            className={`auth-form ${isLogin ? 'visible' : 'hidden'}`}
          >
            <h2>Вход в аккаунт</h2>
            <div className="form-group">
              <input
                type="email"
                placeholder="Электронная почта"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <input
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="forgot-password">
              <a href="/forgot-password">
                Забыли пароль?
              </a>
            </div>
            <div className="auth-button-container">
              <button 
                type="submit" 
                className={`auth-button ${isLoading ? 'loading' : ''}`}
                disabled={isLoading}
              >
                {isLoading ? 'Вход...' : 'Войти'}
              </button>
              
              {/* 🆕 ТУЛТИП ДЛЯ ВХОДА */}
              {tooltips.login.show && (
                <div className={`auth-tooltip ${tooltips.login.type}`}>
                  <div className="tooltip-content">
                    <span className="tooltip-icon">
                      {tooltips.login.type === 'success' ? '✅' : '❌'}
                    </span>
                    <span className="tooltip-message">{tooltips.login.message}</span>
                    <button 
                      className="tooltip-close"
                      onClick={() => hideTooltip('login')}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="tooltip-arrow"></div>
                </div>
              )}
            </div>
            
            <div className="auth-divider">
              <span className="auth-divider-text">или</span>
            </div>
            
            <div className="social-login-buttons">
              <button 
                type="button" 
                className="steam-button"
                onClick={handleSteamLogin}
              >
                Войти через Steam
              </button>
              <button 
                type="button" 
                className="faceit-button"
                onClick={handleFaceitLogin}
              >
                Войти через FACEIT
              </button>
            </div>
          </form>
          
          <form 
            onSubmit={handleRegister} 
            className={`auth-form ${!isLogin ? 'visible' : 'hidden'}`}
          >
            <h2>Регистрация</h2>
            <div className="form-group">
              <input
                type="text"
                placeholder="Имя пользователя"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  clearFieldError('username');
                }}
                className={validationErrors.username ? 'error' : ''}
                maxLength="20"
                required
              />
              {validationErrors.username && (
                <div className="field-error">{validationErrors.username}</div>
              )}
            </div>
            <div className="form-group">
              <input
                type="email"
                placeholder="Электронная почта"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError('email');
                }}
                className={validationErrors.email ? 'error' : ''}
                required
              />
              {validationErrors.email && (
                <div className="field-error">{validationErrors.email}</div>
              )}
            </div>
            <div className="form-group">
              <input
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearFieldError('password');
                }}
                className={validationErrors.password ? 'error' : ''}
                required
              />
              {validationErrors.password && (
                <div className="field-error">{validationErrors.password}</div>
              )}
              
              {/* Индикатор силы пароля */}
              {password && (
                <PasswordStrengthIndicator 
                  password={password}
                  confirmPassword={confirmPassword}
                />
              )}
            </div>
            <div className="form-group">
              <input
                type="password"
                placeholder="Подтвердите пароль"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  clearFieldError('confirmPassword');
                }}
                className={validationErrors.confirmPassword ? 'error' : ''}
                required
              />
              {validationErrors.confirmPassword && (
                <div className="field-error">{validationErrors.confirmPassword}</div>
              )}
            </div>
            <div className="auth-button-container">
              <button 
                type="submit" 
                className={`auth-button ${isLoading ? 'loading' : ''}`}
                disabled={isLoading}
              >
                {isLoading ? 'Создание аккаунта...' : 'Зарегистрироваться'}
              </button>
              
              {/* 🆕 ТУЛТИП ДЛЯ РЕГИСТРАЦИИ */}
              {tooltips.register.show && (
                <div className={`auth-tooltip ${tooltips.register.type}`}>
                  <div className="tooltip-content">
                    <span className="tooltip-icon">
                      {tooltips.register.type === 'success' ? '✅' : '❌'}
                    </span>
                    <span className="tooltip-message">{tooltips.register.message}</span>
                    <button 
                      className="tooltip-close"
                      onClick={() => hideTooltip('register')}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="tooltip-arrow"></div>
                </div>
              )}
            </div>
            
            <div className="auth-divider">
              <span className="auth-divider-text">или</span>
            </div>
            
            <div className="social-login-buttons">
              <button 
                type="button" 
                className="steam-button"
                onClick={handleSteamLogin}
              >
                Войти через Steam
              </button>
              <button 
                type="button" 
                className="faceit-button"
                onClick={handleFaceitLogin}
              >
                Войти через FACEIT
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {/* 🆕 МОДАЛЬНОЕ ПРИВЕТСТВЕННОЕ ОКНО */}
      {showWelcomeModal && (
        <div className="welcome-modal-overlay">
          <div className="welcome-modal">
            <div className="welcome-modal-header">
              <div className="welcome-icon">🎉</div>
              <h2>Добро пожаловать!</h2>
            </div>
            <div className="welcome-modal-content">
              <h3>Привет, {welcomeData.username}!</h3>
              <p>Ваш аккаунт успешно создан и вы автоматически авторизованы.</p>
              <p>Приветственное письмо отправлено на <strong>{welcomeData.email}</strong></p>
              <div className="welcome-features">
                <div className="feature-item">
                  <span className="feature-icon">🏆</span>
                  <span>Участвуйте в турнирах</span>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">👥</span>
                  <span>Находите команду</span>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">📊</span>
                  <span>Отслеживайте статистику</span>
                </div>
              </div>
            </div>
            <div className="welcome-modal-footer">
              <button 
                className="welcome-close-btn"
                onClick={() => {
                  setShowWelcomeModal(false);
                  navigate('/');
                }}
              >
                Начать пользоваться! 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuthPage; 