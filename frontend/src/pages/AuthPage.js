import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import '../components/Home.css';

function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth(); // Получаем функцию login из AuthContext

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
      // Используем функцию login из AuthContext вместо прямого сохранения в localStorage
      login(token);
      setSuccessMessage('Вы успешно вошли через Steam!');
      
      // Очищаем URL от параметров
      window.history.replaceState({}, document.title, '/login');
      
      // Перенаправляем на главную страницу
      setTimeout(() => {
        navigate('/');
      }, 1500);
    }
    
    // Проверяем, есть ли сообщение об ошибке
    const errorMessage = searchParams.get('message');
    if (errorMessage) {
      setError(decodeURIComponent(errorMessage));
      window.history.replaceState({}, document.title, '/login');
    }
  }, [location, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/users/login', {
        email,
        password,
      });
      
      // Используем функцию login из AuthContext вместо прямого сохранения в localStorage
      await login(response.data.token);
      setSuccessMessage('Вы успешно вошли в систему!');
      setError(null);
      
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Ошибка входа');
      setSuccessMessage(null);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/users/register', {
        username,
        email,
        password,
      });
      
      // Используем функцию login из AuthContext вместо прямого сохранения в localStorage
      await login(response.data.token);
      setSuccessMessage('Вы успешно зарегистрировались!');
      setError(null);
      
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Ошибка регистрации');
      setSuccessMessage(null);
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
            <div className="forgot-password-link">
              <a href="/forgot-password" style={{ color: '#666', fontSize: '14px', textDecoration: 'none' }}>
                Забыли пароль?
              </a>
            </div>
            <button type="submit" className="auth-button">Войти</button>
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
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
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
            <button type="submit" className="auth-button">Зарегистрироваться</button>
          </form>
          
          {error && <p className="error-message">{error}</p>}
          {successMessage && <div className="success-message">{successMessage}</div>}
        </div>
      </div>
    </div>
  );
}

export default AuthPage; 