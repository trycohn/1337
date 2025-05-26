import axios from 'axios';

// Получаем базовый URL из переменных окружения, если не задан - используем localhost
const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

console.log(' 🔍 axios baseURL:', baseURL);

// Создаем экземпляр axios с базовыми настройками
const api = axios.create({
    baseURL,
    timeout: 10000, // таймаут 10 секунд
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true, // Отправляем куки с запросами
});

// Добавляем перехватчик запросов для добавления токена авторизации
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        
        // Логируем URL запроса для отладки
        console.log(' 🔍 Sending request to:', config.url);
        
        if (token && !config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        console.error('Request error:', error);
        return Promise.reject(error);
    }
);

// Добавляем перехватчик ответов для централизованной обработки ошибок
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response) {
            // Сервер ответил статусом за пределами диапазона 2xx
            console.error(`API Error (${error.response.status}):`, error.response.data);
            
            // Обработка 401 ошибки (неавторизован)
            if (error.response.status === 401) {
                // Если токен просрочен, можно тут его удалить
                // localStorage.removeItem('token');
            }
        } else if (error.request) {
            // Запрос был сделан, но не получен ответ
            console.error('No response received:', error.request);
        } else {
            // Произошла ошибка при настройке запроса
            console.error('Request config error:', error.message);
        }
        
        // Добавляем информацию об URL в объект ошибки для лучшей отладки
        if (error.config) {
            error.apiUrl = error.config.url;
        }
        
        return Promise.reject(error);
    }
);

export default api; 