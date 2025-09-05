import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import '../styles/components/Auth.css';

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

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return (
    <div className="auth-page">
      <main className="card-authpage card-wide-authpage">
        <section className="section-authpage">
          <h1 className="title-authpage title-upper-authpage">Восстановление пароля</h1>
          <p className="sub-authpage">Введите адрес электронной почты, связанный с вашим аккаунтом. Мы отправим ссылку для восстановления пароля.</p>

          <form onSubmit={handleSubmit}>
            <div className="field-authpage">
              <label htmlFor="email">Электронная почта</label>
              <input
                id="email"
                className="input-authpage"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="actions-authpage">
              <button type="submit" className="btn-authpage btn-primary-authpage" disabled={loading || !isValid}>
                {loading ? 'Отправка...' : 'Отправить ссылку'}
              </button>
              <Link className="back-authpage" to="/login">← Вернуться к входу</Link>
              {(message || error) && (
                <div id="msg" className={`note-authpage ${error ? 'error' : ''}`} style={{ display: 'block' }}>
                  {error ? error : (message || 'Ссылка для восстановления отправлена, проверьте почту.')}
                </div>
              )}
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

export default ForgotPasswordPage; 