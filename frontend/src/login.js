// src/components/Login.js
import api from '../axios'; // Импортируем настроенный axios

const loginUser = async (credentials) => {
  try {
    const response = await api.post('/users/login', credentials); // Запрос к /users/login
    console.log('Login response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Login error:', error.response ? error.response.data : error.message);
    throw error;
  }
};

export default loginUser;