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
    // Используем безопасный метод для вывода в консоль без ошибок
    originalConsoleLog('🔍 Sending request to:', request.url);
    return request;
});

// Добавляем перехватчик ответов для подавления 404 ошибок при запросе истории матчей
api.interceptors.response.use(
    response => response,
    error => {
        // Проверяем, связана ли ошибка с запросом истории матчей и является ли она 404
        if (error.config && 
            error.config.url && 
            error.config.url.includes('match-history') && 
            error.response && 
            error.response.status === 404) {
            // Для запроса истории матчей с 404 не выводим ошибку в консоль, но возвращаем rejected Promise
            // чтобы код в блоке catch мог обработать эту ошибку
            return Promise.reject(error);
        }
        
        // Для всех остальных ошибок продолжаем обычную обработку
        return Promise.reject(error);
    }
);

export default api;