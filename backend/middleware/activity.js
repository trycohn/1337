const pool = require('../db');

/**
 * Middleware для обновления времени последней активности пользователя
 * Обновляет поле last_active в базе данных при каждом запросе аутентифицированного пользователя
 */
const updateActivity = async (req, res, next) => {
    // Проверяем, аутентифицирован ли пользователь
    if (req.user && req.user.id) {
        try {
            // Обновляем время последней активности пользователя
            await pool.query('UPDATE users SET last_active = NOW() WHERE id = $1', [req.user.id]);
            
            // Получаем соединения WebSocket для пользователя
            const app = global.app || req.app;
            const connectedClients = app.get('connectedClients');
            
            // Если у пользователя есть активное WebSocket-соединение, помечаем его как онлайн в реальном времени
            if (connectedClients && connectedClients.has(req.user.id.toString())) {
                const ws = connectedClients.get(req.user.id.toString());
                if (ws && ws.readyState === 1) { // 1 = WebSocket.OPEN
                    req.isUserOnline = true;
                }
            }
        } catch (err) {
            console.error('Ошибка обновления активности пользователя:', err);
            // Продолжаем выполнение запроса даже при ошибке обновления активности
        }
    }
    next();
};

module.exports = { updateActivity }; 