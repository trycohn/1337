import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import '../components/Home.css';

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await axios.post('/api/users/forgot-password', {
        email
      });
      
      setMessage(response.data.message);
      setEmail(''); // Очищаем поле email
    } catch (err) {
      setError(err.response?.data?.message || 'Произошла ошибка при отправке запроса');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-form-container">
          <form onSubmit={handleSubmit} className="auth-form visible">
            <h2>Восстановление пароля</h2>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
              Введите адрес электронной почты, связанный с вашим аккаунтом, и мы отправим вам ссылку для восстановления пароля.
            </p>
            
            <div className="form-group">
              <input
                type="email"
                placeholder="Электронная почта"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            
            <button 
              type="submit" 
              className="auth-button" 
              disabled={loading}
            >
              {loading ? 'Отправка...' : 'Отправить ссылку'}
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
              <strong>Письмо отправлено!</strong><br />
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage; 