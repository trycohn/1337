// src/components/Login.js
import api from '../axios';
import { useNavigate } from 'react-router-dom';

function Login() {
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    const { email, password } = event.target.elements;

    try {
      const response = await api.post('/api/users/login', {
        email: email.value,
        password: password.value,
      });
      localStorage.setItem('token', response.data.token);
      console.log('🔍 Вход успешен:', response.data);
      navigate('/');
    } catch (error) {
      console.error('❌ Ошибка входа:', error.response ? error.response.data : error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" name="email" placeholder="Электронная почта" required />
      <input type="password" name="password" placeholder="Пароль" required />
      <button type="submit">Войти</button>
    </form>
  );
}

export default Login;