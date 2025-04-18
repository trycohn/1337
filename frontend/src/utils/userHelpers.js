/**
 * Утилиты для работы с пользователями
 */

/**
 * Получает ID текущего авторизованного пользователя из токена
 * @returns {string|null} ID пользователя или null, если пользователь не авторизован
 */
export const getCurrentUserId = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;
  
  try {
    const tokenPayload = JSON.parse(atob(token.split('.')[1]));
    return tokenPayload.id.toString();
  } catch (error) {
    console.error('Ошибка при получении ID пользователя из токена:', error);
    return null;
  }
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