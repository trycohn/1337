const jwt = require('jsonwebtoken');

// Middleware для проверки JWT-токена
function authenticateToken(req, res, next) {
    let token = req.headers['authorization'] && req.headers['authorization'].split(' ')[1]; // Bearer <token>

    console.log('Проверка пути:', req.path); // Отладка пути
    console.log('Query параметры:', req.query); // Отладка query

    // Проверяем query-параметр token для маршрута link-steam
    if (!token && req.query.token) {
        token = req.query.token;
        console.log('Токен найден в query:', token); // Отладка
    }

    if (!token) {
        console.log('Токен не найден в заголовках или query:', req.headers, req.query);
        return res.status(401).json({ message: 'Токен не предоставлен' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('Ошибка верификации токена:', err);
            return res.status(403).json({ message: 'Недействительный токен' });
        }
        console.log('Токен верифицирован, user:', user);
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