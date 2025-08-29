import axios from 'axios';

// Setup axios: in development use relative paths (proxy), in production use REACT_APP_API_URL
const api = axios.create({
    baseURL: process.env.NODE_ENV === 'production'
        ? process.env.REACT_APP_API_URL
        : ''
});

console.log('🔍 axios baseURL:', api.defaults.baseURL);

// Создаем оригинальный метод для вывода в консоль
const originalConsoleLog = console.log;

api.interceptors.request.use(request => {
    // Подставляем Bearer токен, если он есть и заголовок ещё не установлен
    try {
        const token = localStorage.getItem('token');
        if (token && !request.headers?.Authorization) {
            request.headers = request.headers || {};
            request.headers.Authorization = `Bearer ${token}`;
        }
    } catch (_) {
        // no-op
    }
    // Логируем целевой URL
    originalConsoleLog('🔍 Sending request to:', request.url);
    return request;
});

// Добавляем перехватчик ответов для подавления нормальных 404 ошибок
api.interceptors.response.use(
    response => response,
    error => {
        const url = error.config?.url;
        const status = error.response?.status;
        
        // Список endpoints где 404 является нормальным поведением
        const expectedNotFoundEndpoints = [
            'match-history',                    // Старый endpoint
            'organization-request-status',      // Нет заявки на организацию
            'dota-stats/profile/'              // Нет профиля Dota 2
        ];
        
        // Проверяем, является ли эта ошибка ожидаемой 404
        const isExpected404 = status === 404 && 
            expectedNotFoundEndpoints.some(endpoint => url?.includes(endpoint));
        
        if (isExpected404) {
            // Для ожидаемых 404 ошибок не выводим в консоль, но возвращаем rejected Promise
            // чтобы код в блоке catch мог обработать эту ситуацию
            return Promise.reject(error);
        }
        
        // Для всех остальных ошибок выводим информацию и продолжаем обычную обработку
        console.error('❌ API Error:', {
            url: url,
            status: status,
            message: error.response?.data?.message || error.message
        });
        
        return Promise.reject(error);
    }
);

export default api;