// backend/middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = process.env;

// Middleware для проверки авторизации
const authMiddleware = (req, res, next) => {
    // Получаем заголовок Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    // Если заголовок начинается с "Bearer ", удаляем этот префикс
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    try {
        // Верифицируем токен
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('Decoded token:', decoded);
        // Сохраняем данные пользователя из токена в req.user
        req.user = decoded.user;
        next();
    } catch (err) {
        console.error(err);
        res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};

module.exports = authMiddleware;
