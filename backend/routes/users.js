const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/auth');
const passport = require('passport');

// Регистрация нового пользователя
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Username, email и пароль обязательны' });
    }

    try {
        const usernameCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (usernameCheck.rows.length > 0) {
            return res.status(400).json({ message: 'Имя пользователя уже занято' });
        }

        const emailCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (emailCheck.rows.length > 0) {
            return res.status(400).json({ message: 'Email уже зарегистрирован' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, role',
            [username, email, hashedPassword]
        );
        const newUser = result.rows[0];

        const token = jwt.sign(
            { id: newUser.id, role: newUser.role, username: newUser.username },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(201).json({ message: 'Пользователь создан', userId: newUser.id, token });
    } catch (err) {
        console.error('Ошибка регистрации:', err);
        res.status(500).json({ error: err.message });
    }
});

// Вход пользователя
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email и пароль обязательны' });
    }

    try {
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'Неверный email или пароль' });
        }
        const user = userResult.rows[0];

        if (!user.password_hash) {
            return res.status(500).json({ message: 'Хэш пароля пользователя не установлен.' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ message: 'Неверный email или пароль' });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ token });
    } catch (err) {
        console.error('Ошибка входа:', err);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Получение данных текущего пользователя
router.get('/me', authenticateToken, async (req, res) => {
    try {
        console.log('Получение данных пользователя, req.user:', req.user);
        const result = await pool.query(
            'SELECT id, username, email, role, steam_id, faceit_id, full_name, birth_date, steam_url, avatar_url, is_verified ' +
            'FROM users WHERE id = $1',
            [req.user.id]
        );
        console.log('Результат запроса:', result.rows);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Ошибка в /me:', err);
        res.status(500).json({ error: err.message });
    }
});

// Маршрут для начала Steam авторизации
router.get('/steam', (req, res, next) => {
    const authToken = req.query.authToken;
    console.log('Steam authToken:', authToken);
    if (authToken) {
        try {
            const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
            console.log('Steam authToken decoded:', decoded);
            req.authToken = authToken; // Сохраняем authToken в запросе
            passport.authenticate('steam', { session: false })(req, res, next);
        } catch (err) {
            console.error('Invalid authToken:', err);
            return res.status(401).json({ error: 'Недействительный токен авторизации' });
        }
    } else {
        passport.authenticate('steam', { session: false })(req, res, next);
    }
});

// Callback для Steam авторизации
router.get('/steam-callback', passport.authenticate('steam', { session: false }), async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Начинаем транзакцию

        console.log('Steam callback, req.user:', req.user);
        const steamId = req.user.steamId;
        const authToken = req.authToken;
        console.log('Steam callback, authToken:', authToken);

        if (authToken) {
            // Верифицируем токен и получаем существующего пользователя
            const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
            console.log('Linking Steam to user:', decoded);

            // Находим пользователя с этим steam_id (нового пользователя)
            const existingSteamUser = await client.query('SELECT * FROM users WHERE steam_id = $1', [steamId]);
            if (existingSteamUser.rows.length > 0) {
                const newUserId = existingSteamUser.rows[0].id;

                // Проверяем, не привязан ли steam_id к другому пользователю (кроме decoded.id)
                if (newUserId !== decoded.id) {
                    // Переносим steam_id и steam_url в профиль decoded.id
                    await client.query(
                        'UPDATE users SET steam_id = $1, steam_url = $2 WHERE id = $3',
                        [steamId, `https://steamcommunity.com/profiles/${steamId}`, decoded.id]
                    );
                    console.log('Steam data transferred to user:', decoded.id);

                    // Удаляем нового пользователя
                    await client.query('DELETE FROM users WHERE id = $1', [newUserId]);
                    console.log('New user deleted:', newUserId);
                } else {
                    console.log('Steam ID already linked to this user:', decoded.id);
                }
            } else {
                // Если новый пользователь не был создан, просто обновляем steam_id
                await client.query(
                    'UPDATE users SET steam_id = $1, steam_url = $2 WHERE id = $3',
                    [steamId, `https://steamcommunity.com/profiles/${steamId}`, decoded.id]
                );
                console.log('Steam ID linked to user:', decoded.id);
            }

            const user = (await client.query('SELECT * FROM users WHERE id = $1', [decoded.id])).rows[0];
            if (!user) {
                throw new Error('Пользователь не найден');
            }

            const token = jwt.sign(
                { id: user.id, role: user.role || 'user', username: user.username },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            console.log('Redirecting with token:', token);
            await client.query('COMMIT'); // Завершаем транзакцию
            res.redirect(`https://1337community.com/profile?token=${token}`);
        } else {
            // Создание нового пользователя, если authToken отсутствует
            const newUsername = `steam_${steamId}`;
            const result = await client.query(
                'INSERT INTO users (username, steam_id, steam_url) VALUES ($1, $2, $3) ON CONFLICT (steam_id) DO UPDATE SET username = EXCLUDED.username RETURNING id, username, role',
                [newUsername, steamId, `https://steamcommunity.com/profiles/${steamId}`]
            );
            const newUser = result.rows[0];

            const token = jwt.sign(
                { id: newUser.id, role: newUser.role, username: newUser.username },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            console.log('New user created and redirecting with token:', token);
            await client.query('COMMIT'); // Завершаем транзакцию
            res.redirect(`https://1337community.com/profile?token=${token}`);
        }
    } catch (err) {
        await client.query('ROLLBACK'); // Откатываем транзакцию при ошибке
        console.error('Ошибка в steam-callback:', err);
        res.status(500).json({ error: 'Ошибка авторизации через Steam' });
    } finally {
        client.release();
    }
});

// Привязка профиля FACEit (заглушка)
router.post('/link-faceit', authenticateToken, async (req, res) => {
    const { faceitId } = req.body;

    if (!faceitId) {
        return res.status(400).json({ message: 'FACEit ID обязателен' });
    }

    try {
        const result = await pool.query(
            'UPDATE users SET faceit_id = $1 WHERE id = $2 RETURNING faceit_id',
            [faceitId, req.user.id]
        );
        res.json({ message: 'Профиль FACEit успешно привязан', faceitId: result.rows[0].faceit_id });
    } catch (err) {
        console.error('Ошибка привязки FACEit:', err);
        res.status(500).json({ error: 'Не удалось привязать FACEit профиль' });
    }
});

// Верификация профиля
router.post('/verify', authenticateToken, async (req, res) => {
    const { fullName, birthDate, avatarUrl } = req.body;

    if (!fullName || !birthDate) {
        return res.status(400).json({ message: 'ФИО и дата рождения обязательны' });
    }

    try {
        const result = await pool.query(
            'UPDATE users SET full_name = $1, birth_date = $2, avatar_url = $3, is_verified = TRUE WHERE id = $4 RETURNING full_name, birth_date, avatar_url, is_verified',
            [fullName, birthDate, avatarUrl || null, req.user.id]
        );
        res.json({ message: 'Профиль успешно верифицирован', user: result.rows[0] });
    } catch (err) {
        console.error('Ошибка верификации:', err);
        res.status(500).json({ error: 'Не удалось верифицировать профиль' });
    }
});

// Получение статистики пользователя
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const statsResult = await pool.query(
            'SELECT t.name, uts.result, uts.wins, uts.losses, uts.is_team ' +
            'FROM user_tournament_stats uts ' +
            'JOIN tournaments t ON uts.tournament_id = t.id ' +
            'WHERE uts.user_id = $1',
            [req.user.id]
        );

        const stats = statsResult.rows;
        const soloStats = stats.filter(s => !s.is_team);
        const teamStats = stats.filter(s => s.is_team);

        const soloWins = soloStats.reduce((sum, s) => sum + s.wins, 0);
        const soloLosses = soloStats.reduce((sum, s) => sum + s.losses, 0);
        const teamWins = teamStats.reduce((sum, s) => sum + s.wins, 0);
        const teamLosses = teamStats.reduce((sum, s) => sum + s.losses, 0);

        const soloWinRate = soloWins + soloLosses > 0 ? (soloWins / (soloWins + soloLosses)) * 100 : 0;
        const teamWinRate = teamWins + teamLosses > 0 ? (teamWins / (teamWins + teamLosses)) * 100 : 0;

        res.json({
            tournaments: stats,
            solo: { wins: soloWins, losses: soloLosses, winRate: soloWinRate.toFixed(2) },
            team: { wins: teamWins, losses: teamLosses, winRate: teamWinRate.toFixed(2) }
        });
    } catch (err) {
        console.error('Ошибка получения статистики:', err);
        res.status(500).json({ error: 'Не удалось загрузить статистику' });
    }
});

// Подтверждение через email (заглушка)
router.post('/verify-email', authenticateToken, async (req, res) => {
    const verificationToken = Math.random().toString(36).substring(2);

    try {
        await pool.query(
            'UPDATE users SET verification_token = $1 WHERE id = $2',
            [verificationToken, req.user.id]
        );
        console.log(`Токен верификации для пользователя ${req.user.id}: ${verificationToken}`);
        res.json({ message: 'Токен верификации отправлен (проверь консоль)', token: verificationToken });
    } catch (err) {
        console.error('Ошибка верификации email:', err);
        res.status(500).json({ error: 'Не удалось отправить токен верификации' });
    }
});

router.post('/confirm-email', authenticateToken, async (req, res) => {
    const { token } = req.body;

    try {
        const result = await pool.query(
            'SELECT verification_token FROM users WHERE id = $1',
            [req.user.id]
        );
        const storedToken = result.rows[0].verification_token;

        if (token === storedToken) {
            await pool.query(
                'UPDATE users SET is_verified = TRUE, verification_token = NULL WHERE id = $1',
                [req.user.id]
            );
            res.json({ message: 'Учётная запись подтверждена' });
        } else {
            res.status(400).json({ message: 'Неверный токен верификации' });
        }
    } catch (err) {
        console.error('Ошибка подтверждения email:', err);
        res.status(500).json({ error: 'Не удалось подтвердить учётную запись' });
    }
});

module.exports = router;