/**
 * Утилиты для работы с пользователями
 */

/**
 * Декодируем payload JWT (base64url) безопасно
 * @param {string} token JWT token
 * @returns {object|null} decoded payload or null if token is invalid
 */
export const decodeTokenPayload = (token) => {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error('Ошибка декодирования токена:', err);
    return null;
  }
};

/**
 * Получает ID текущего авторизованного пользователя из токена
 * @returns {string|null} ID пользователя или null, если пользователь не авторизован
 */
export const getCurrentUserId = () => {
  const token = localStorage.getItem('token');
  const payload = decodeTokenPayload(token);
  return payload?.id ? payload.id.toString() : null;
};

/**
 * Проверяет, совпадает ли ID с ID текущего пользователя
 * @param {string} userId ID для проверки
 * @returns {boolean} true, если ID совпадает с ID текущего пользователя
 */
export const isCurrentUser = (userId) => {
  const currentUserId = getCurrentUserId();
  return currentUserId && currentUserId.toString() === userId.toString();
};

/**
 * Перенаправляет на личный кабинет, если ID совпадает с ID текущего пользователя
 * @param {string} userId ID для проверки
 * @param {function} navigateFn Функция navigate из react-router-dom
 * @returns {boolean} true, если было выполнено перенаправление
 */
export const redirectIfCurrentUser = (userId, navigateFn) => {
  if (isCurrentUser(userId)) {
    navigateFn('/profile');
    return true;
  }
  return false;
};

/**
 * Обеспечивает использование правильного URL в зависимости от окружения
 * @param {string} url URL, который нужно исправить
 * @returns {string|null} Исправленный URL или исходный URL
 */
export const ensureHttps = (url) => {
  if (!url) return url;
  
  // Заменяем http на https
  let correctedUrl = url.replace(/^http:\/\//i, 'https://');
  
  // В production заменяем localhost:3000 на правильный домен
  if (process.env.NODE_ENV === 'production' || window.location.hostname !== 'localhost') {
    correctedUrl = correctedUrl.replace(/^https?:\/\/localhost:3000/i, 'https://1337community.com');
  }
  
  return correctedUrl;
}; 