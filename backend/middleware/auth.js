const jwt = require('jsonwebtoken');

// Middleware для проверки JWT-токена
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>
    if (!token) {
        return res.status(401).json({ message: 'Токен не предоставлен' });
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('Ошибка верификации токена:', err); // Логирование
            return res.status(403).json({ message: 'Недействительный токен' });
        }
        console.log('Токен верифицирован, user:', user); // Логирование
        req.user = user;
        next();
    });
}

// Middleware для ограничения доступа по ролям
function restrictTo(roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Доступ запрещен: недостаточно прав' });
        }
        next();
    };
}

module.exports = { authenticateToken, restrictTo };