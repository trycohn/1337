import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import '../components/Home.css';

function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState('');
  const [isValidToken, setIsValidToken] = useState(null);
  
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Извлекаем токен из URL
    const searchParams = new URLSearchParams(location.search);
    const urlToken = searchParams.get('token');
    
    if (!urlToken) {
      setError('Отсутствует токен восстановления пароля');
      setIsValidToken(false);
      return;
    }
    
    setToken(urlToken);
    setIsValidToken(true);
  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    
    if (password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }
    
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await axios.post('/api/users/reset-password', {
        token,
        password,
        confirmPassword
      });
      
      setMessage(response.data.message);
      
      // Перенаправляем на страницу входа через 3 секунды
      setTimeout(() => {
        navigate('/login');
      }, 3000);
      
    } catch (err) {
      setError(err.response?.data?.message || 'Произошла ошибка при изменении пароля');
    } finally {
      setLoading(false);
    }
  };

  if (isValidToken === false) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-form-container">
            <div className="auth-form visible">
              <h2>Ошибка</h2>
              <p className="error-message">
                {error || 'Недействительная ссылка для восстановления пароля'}
              </p>
              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <Link to="/forgot-password" style={{ color: '#666', fontSize: '14px', textDecoration: 'none' }}>
                  Запросить новую ссылку
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isValidToken === null) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-form-container">
            <div className="auth-form visible">
              <h2>Загрузка...</h2>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-form-container">
          <form onSubmit={handleSubmit} className="auth-form visible">
            <h2>Установка нового пароля</h2>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
              Введите новый пароль для вашего аккаунта.
            </p>
            
            <div className="form-group">
              <input
                type="password"
                placeholder="Новый пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
            </div>
            
            <div className="form-group">
              <input
                type="password"
                placeholder="Подтвердите новый пароль"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
            </div>
            
            <button 
              type="submit" 
              className="auth-button" 
              disabled={loading}
            >
              {loading ? 'Изменение...' : 'Изменить пароль'}
            </button>
            
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Link to="/login" style={{ color: '#666', fontSize: '14px', textDecoration: 'none' }}>
                ← Вернуться к входу
              </Link>
            </div>
          </form>
          
          {error && <p className="error-message">{error}</p>}
          {message && (
            <div className="success-message">
              <strong>Пароль изменен!</strong><br />
              {message}<br />
              <small>Перенаправление на страницу входа через 3 секунды...</small>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordPage; 