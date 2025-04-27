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
 * Обеспечивает использование HTTPS вместо HTTP в URL
 * @param {string} url URL, который нужно исправить
 * @returns {string|null} URL с HTTPS вместо HTTP или исходный URL, если он не содержит протокол
 */
export const ensureHttps = (url) => {
  if (!url) return url;
  return url.replace(/^http:\/\//i, 'https://');
}; 