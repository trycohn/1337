import axios from 'axios';

// Получаем базовый URL из переменных окружения, если не задан - используем localhost
const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

console.log(' 🔍 axios baseURL:', baseURL);

// Создаем экземпляр axios с базовыми настройками
const api = axios.create({
    baseURL,
    timeout: 30000, // увеличиваем таймаут до 30 секунд
    headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    },
    withCredentials: true, // Отправляем куки с запросами
});

// Список критически важных endpoints для retry логики
const CRITICAL_ENDPOINTS = [
    '/api/users/profile',
    '/api/tournaments/',
    '/api/users/me'
];

// Функция для определения, нужно ли повторить запрос
const shouldRetry = (error, config) => {
    // 🔧 БЕЗОПАСНАЯ ПРОВЕРКА: Если config undefined, не повторяем
    if (!config) {
        console.warn('⚠️ shouldRetry: config is undefined');
        return false;
    }
    
    // Не повторяем, если это уже повторный запрос
    const retryCount = config.__retryCount || 0;
    if (retryCount >= 2) return false;
    
    // Повторяем для критических endpoints
    const isCriticalEndpoint = CRITICAL_ENDPOINTS.some(endpoint => 
        config.url?.includes(endpoint)
    );
    
    // Повторяем для таймаутов, сетевых ошибок или 5xx ошибок
    const shouldRetryError = (
        error.code === 'ECONNABORTED' || // timeout
        error.code === 'ERR_NETWORK' || // network error
        error.code === 'ERR_INSUFFICIENT_RESOURCES' || // insufficient resources
        (error.response?.status >= 500 && error.response?.status < 600) // 5xx errors
    );
    
    return isCriticalEndpoint && shouldRetryError;
};

// Функция для retry с экспоненциальной задержкой
const retryRequest = async (config) => {
    // 🔧 БЕЗОПАСНАЯ ПРОВЕРКА: Если config undefined, отклоняем
    if (!config) {
        console.error('❌ retryRequest: config is undefined');
        return Promise.reject(new Error('Config is undefined'));
    }
    
    config.__retryCount = (config.__retryCount || 0) + 1;
    const delay = Math.pow(2, config.__retryCount) * 1000; // 2s, 4s, 8s
    
    console.log(`🔄 Повторный запрос #${config.__retryCount} к ${config.url} через ${delay}ms`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return api(config);
};

// Добавляем перехватчик запросов для добавления токена авторизации
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        
        // Логируем URL запроса для отладки (только для критических)
        const isCritical = CRITICAL_ENDPOINTS.some(endpoint => 
            config.url?.includes(endpoint)
        );
        
        if (isCritical) {
            console.log(' 🔍 Sending request to:', config.url);
        }
        
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
    async (error) => {
        const config = error?.config; // 🔧 БЕЗОПАСНОЕ ПОЛУЧЕНИЕ CONFIG
        
        // Пытаемся повторить критические запросы только если config существует
        if (config && shouldRetry(error, config)) {
            try {
                return await retryRequest(config);
            } catch (retryError) {
                // Если retry тоже не сработал, продолжаем с оригинальной ошибкой
                console.error(`❌ Retry failed for ${config.url}:`, retryError);
            }
        }
        
        if (error.response) {
            // Сервер ответил статусом за пределами диапазона 2xx
            const status = error.response.status;
            const url = config?.url;
            
            // Не логируем некритические 404 ошибки
            const isExpected404 = status === 404 && (
                url?.includes('admin-request-status') ||
                url?.includes('dota-stats') ||
                url?.includes('maps')
            );
            
            if (!isExpected404) {
                console.error(`API Error (${status}) на ${url}:`, {
                    status,
                    message: error.response.data?.message || error.response.data?.error,
                    data: error.response.data
                });
            }
            
            // Обработка 401 ошибки (неавторизован)
            if (status === 401) {
                // Проверяем, не expired ли токен
                const token = localStorage.getItem('token');
                if (token && !url?.includes('/login')) {
                    console.warn('🔐 Токен возможно истек, перенаправляем на авторизацию');
                    // Можно добавить редирект на страницу логина
                }
            }
        } else if (error.request) {
            // Запрос был сделан, но не получен ответ
            if (error.code === 'ECONNABORTED') {
                console.warn(`⏱️ Timeout для ${config?.url} (${config?.timeout}ms)`);
            } else if (error.code === 'ERR_NETWORK') {
                console.warn(`🌐 Сетевая ошибка для ${config?.url}`);
            } else if (error.code === 'ERR_INSUFFICIENT_RESOURCES') {
                console.warn(`💾 Недостаток ресурсов для ${config?.url}`);
            } else {
                console.error('No response received:', {
                    url: config?.url,
                    code: error.code,
                    message: error.message
                });
            }
        } else {
            // Произошла ошибка при настройке запроса
            // 🔧 ИСПРАВЛЕНИЕ: Безопасное логирование без циклических ссылок
            console.error('Request config error:', {
                message: error.message,
                code: error.code,
                name: error.name,
                stack: error.stack?.substring(0, 500) // Ограничиваем размер stack trace
            });
        }
        
        // Добавляем информацию об URL в объект ошибки для лучшей отладки
        if (config) {
            error.apiUrl = config.url;
            error.retryCount = config.__retryCount || 0;
        }
        
        return Promise.reject(error);
    }
);

export default api; 