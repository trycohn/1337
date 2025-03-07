const jwt = require('jsonwebtoken');
const { JWT_SECRET } = process.env;

// Middleware для проверки авторизации
const authMiddleware = (req, res, next) => {
    // Получаем заголовок Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing token' });
    }

    // Извлекаем токен, удаляя префикс "Bearer "
    const token = authHeader.slice(7);

    try {
        // Верифицируем токен
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('Decoded token:', decoded); // Удалить в продакшене
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Unauthorized: Token has expired' });
        }
        console.error('JWT verification error:', err);
        res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};

module.exports = authMiddleware;

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"
    
    if (!token) {
        return res.sendStatus(401); // Нет токена
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.sendStatus(403); // Токен недействителен
        }
        req.user = user;
        next(); // Передаём управление следующему middleware или маршруту
    });
}

module.exports = authenticateToken;