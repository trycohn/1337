const jwt = require('jsonwebtoken');
const db = require('./db');

// Проверка JWT токена для защиты маршрутов
const authenticateToken = (req, res, next) => {
    // Извлекаем токен из заголовка Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET || 'secret_key', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Невалидный или истекший токен' });
        }
        
        // Добавляем пользователя в объект запроса
        req.user = user;
        next();
    });
};

module.exports = { authenticateToken };