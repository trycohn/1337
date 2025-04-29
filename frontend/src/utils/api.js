import axios from 'axios';

// Определяем базовый URL для API
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// Создаем экземпляр axios с настройками по умолчанию
const api = axios.create({
    baseURL: API_URL,
    timeout: 30000, // 30 секунд таймаут
    headers: {
        'Content-Type': 'application/json',
    }
});

// Добавляем перехватчик запросов для добавления токена авторизации
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Добавляем перехватчик ответов для обработки ошибок
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Обработка ошибок авторизации (401)
        if (error.response && error.response.status === 401) {
            // Можно добавить логику для перенаправления на страницу входа
            console.error('Ошибка авторизации:', error);
        }
        
        return Promise.reject(error);
    }
);

export default api; 