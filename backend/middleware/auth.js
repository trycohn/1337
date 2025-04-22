const jwt = require('jsonwebtoken');
const pool = require('../db');

// Middleware для проверки JWT-токена
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    console.log('Проверка пути:', req.path); // Отладка пути
    console.log('Query параметры:', req.query); // Отладка query

    // Проверяем query-параметр token для маршрута link-steam
    if (!token && req.query.token) {
        token = req.query.token;
        console.log('Токен найден в query:', token); // Отладка
    }

    if (!token) {
        console.log('Токен не предоставлен для пути:', req.path);
        return res.status(401).json({ message: 'Токен не предоставлен' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('Ошибка проверки токена:', err);
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

// Новый middleware для проверки верификации email
async function verifyEmailRequired(req, res, next) {
    try {
        const userResult = await pool.query(
            'SELECT is_verified FROM users WHERE id = $1',
            [req.user.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        if (!userResult.rows[0].is_verified) {
            return res.status(403).json({ message: 'Для этого действия требуется подтвердить email' });
        }

        next();
    } catch (err) {
        console.error('Ошибка проверки верификации email:', err);
        res.status(500).json({ error: 'Ошибка сервера при проверке верификации' });
    }
}

// Новый middleware для проверки, что пользователь является создателем или администратором турнира
async function verifyAdminOrCreator(req, res, next) {
    const tournamentId = req.params.id;
    const userId = req.user.id;
    try {
        const result = await pool.query(
            'SELECT created_by FROM tournaments WHERE id = $1',
            [tournamentId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        const { created_by } = result.rows[0];
        if (created_by === userId) {
            return next();
        }
        const adminCheck = await pool.query(
            'SELECT 1 FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
            [tournamentId, userId]
        );
        if (adminCheck.rows.length > 0) {
            return next();
        }
        return res.status(403).json({ error: 'Доступ запрещён: только создатель или администратор турнира' });
    } catch (err) {
        console.error('Ошибка проверки прав админа или создателя:', err);
        return res.status(500).json({ error: 'Ошибка проверки прав доступа' });
    }
}

module.exports = { authenticateToken, restrictTo, verifyEmailRequired, verifyAdminOrCreator };