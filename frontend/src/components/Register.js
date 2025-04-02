import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Home.css';

function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/users/register', {
        username,
        email,
        password,
      });
      console.log('Регистрация успешна:', response.data);

      // Сохранение токена и авторизация
      localStorage.setItem('token', response.data.token);
      
      setSuccessMessage('Вы успешно зарегистрировались!');
      setError(null);

      // Задержка 2 секунды перед перенаправлением
      setTimeout(() => {
        setSuccessMessage(null);
        navigate('/');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Ошибка регистрации'); // Изменено с .error на .message
      setSuccessMessage(null);
      console.error('Ошибка регистрации:', err);
    }
  };

  return (
    <section className="register">
      <h2>Регистрация</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Имя пользователя"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Электронная почта"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Зарегистрироваться</button>
      </form>
      {error && <p className="error">{error}</p>}
      {successMessage && <div className="success-popup">{successMessage}</div>}
    </section>
  );
}

export default Register;