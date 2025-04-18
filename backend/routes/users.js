const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/auth');
const axios = require('axios');
const querystring = require('querystring');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const nodemailer = require('nodemailer');

// Настройка транспорта nodemailer
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT === '465', // true для 465, false для других портов
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Подключаем cookie-parser middleware
router.use(cookieParser());

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
            'SELECT id, username, email, role, steam_id, faceit_id, full_name, birth_date, steam_url, avatar_url, is_verified, cs2_premier_rank ' +
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

// Маршрут для авторизации через Steam (инициация процесса)
router.get('/steam', (req, res) => {
    console.log('Инициирован вход через Steam');
    const baseUrl = process.env.SERVER_URL || process.env.REACT_APP_API_URL || 'http://localhost:3000';
    const steamLoginUrl = `https://steamcommunity.com/openid/login?openid.ns=http://specs.openid.net/auth/2.0&openid.mode=checkid_setup&openid.return_to=${baseUrl}/api/users/steam-callback&openid.realm=${baseUrl}&openid.identity=http://specs.openid.net/auth/2.0/identifier_select&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select`;
    res.redirect(steamLoginUrl);
});

// Callback для Steam OpenID
router.get('/steam-callback', async (req, res) => {
    try {
        console.log('Steam callback query:', req.query);
        const openidParams = req.query;

        const checkAuthUrl = 'https://steamcommunity.com/openid/login';
        const authParams = {
            ...openidParams,
            'openid.mode': 'check_authentication'
        };
        console.log('Checking Steam authentication with params:', authParams);
        const response = await axios.get(checkAuthUrl, { params: authParams });
        console.log('Steam auth response:', response.data);
        const isValid = response.data.includes('is_valid:true');

        if (!isValid) {
            console.error('Steam authentication failed');
            return res.status(401).json({ error: 'Недействительный ответ от Steam' });
        }

        const steamId = openidParams['openid.claimed_id'].split('/').pop();
        console.log('Extracted Steam ID:', steamId);

        // Проверяем, существует ли пользователь с данным Steam ID
        const existingUser = await pool.query('SELECT * FROM users WHERE steam_id = $1', [steamId]);
        console.log('Existing user with steam_id:', existingUser.rows);

        if (existingUser.rows.length > 0) {
            // Если пользователь существует, создаем JWT и перенаправляем
            const user = existingUser.rows[0];
            const token = jwt.sign(
                { id: user.id, role: user.role, username: user.username },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );
            console.log('User exists, redirecting with token:', token);
            return res.redirect(`https://1337community.com/auth-callback?token=${token}`);
        } else {
            // Если пользователь не существует, получаем его никнейм из Steam
            const apiKey = process.env.STEAM_API_KEY;
            const steamUserResponse = await axios.get(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`);
            const steamNickname = steamUserResponse.data.response.players[0].personaname;
            const steamAvatarUrl = steamUserResponse.data.response.players[0].avatarfull;
            
            // Создаем нового пользователя с никнеймом и Steam ID
            const newUserResult = await pool.query(
                'INSERT INTO users (username, steam_id, steam_url, avatar_url) VALUES ($1, $2, $3, $4) RETURNING id, username, role',
                [steamNickname, steamId, `https://steamcommunity.com/profiles/${steamId}`, steamAvatarUrl]
            );
            
            const newUser = newUserResult.rows[0];
            
            // Создаем JWT для нового пользователя
            const token = jwt.sign(
                { id: newUser.id, role: newUser.role, username: newUser.username },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );
            
            console.log('Created new user with Steam profile, redirecting with token:', newUser);
            return res.redirect(`https://1337community.com/auth-callback?token=${token}`);
        }
    } catch (err) {
        console.error('Ошибка в steam-callback:', err);
        return res.redirect(`https://1337community.com/auth-error?message=${encodeURIComponent(err.message)}`);
    }
});

// Привязка Steam ID
router.post('/link-steam', authenticateToken, async (req, res) => {
    const { steamId } = req.body;

    if (!steamId) {
        console.error('No steamId provided in /link-steam');
        return res.status(400).json({ message: 'Steam ID обязателен' });
    }

    try {
        console.log('Linking Steam ID:', steamId, 'to user:', req.user.id);
        const existingSteamUser = await pool.query('SELECT * FROM users WHERE steam_id = $1', [steamId]);
        if (existingSteamUser.rows.length > 0 && existingSteamUser.rows[0].id !== req.user.id) {
            console.error('Steam ID already linked to another user:', existingSteamUser.rows[0].id);
            return res.status(400).json({ error: 'Этот Steam ID уже привязан к другому пользователю' });
        }

        await pool.query(
            'UPDATE users SET steam_id = $1, steam_url = $2 WHERE id = $3',
            [steamId, `https://steamcommunity.com/profiles/${steamId}`, req.user.id]
        );
        console.log('Steam ID linked successfully to user:', req.user.id);

        res.json({ message: 'Steam успешно привязан' });
    } catch (err) {
        console.error('Ошибка привязки Steam:', err);
        res.status(500).json({ error: 'Не удалось привязать Steam' });
    }
});

// отвязка Steam ID
router.post('/unlink-steam', authenticateToken, async (req, res) => {
    try {
        await pool.query('UPDATE users SET steam_id = NULL, steam_url = NULL WHERE id = $1', [req.user.id]);
        res.json({ message: 'Steam отвязан' });
    } catch (err) {
        console.error('Ошибка отвязки Steam:', err);
        res.status(500).json({ error: 'Не удалось отвязать Steam' });
    }
});

// Изменение никнейма
router.post('/update-username', authenticateToken, async (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ message: 'Никнейм обязателен' });
    }

    try {
        const usernameCheck = await pool.query('SELECT * FROM users WHERE username = $1 AND id != $2', [username, req.user.id]);
        if (usernameCheck.rows.length > 0) {
            return res.status(400).json({ message: 'Этот никнейм уже занят' });
        }

        await pool.query('UPDATE users SET username = $1 WHERE id = $2', [username, req.user.id]);
        res.json({ message: 'Никнейм успешно изменён' });
    } catch (err) {
        console.error('Ошибка изменения никнейма:', err);
        res.status(500).json({ error: 'Не удалось изменить никнейм' });
    }
});

// Обновление email пользователя
router.post('/update-email', authenticateToken, async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email обязателен' });
    }

    try {
        // Проверяем, не занят ли email другим пользователем
        const emailCheck = await pool.query('SELECT * FROM users WHERE email = $1 AND id != $2', [email, req.user.id]);
        if (emailCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Этот email уже занят' });
        }

        // Обновляем email и сбрасываем статус верификации
        await pool.query('UPDATE users SET email = $1, is_verified = FALSE WHERE id = $2', [email, req.user.id]);
        res.json({ message: 'Email успешно обновлен' });
    } catch (err) {
        console.error('Ошибка обновления email:', err);
        res.status(500).json({ error: 'Не удалось обновить email' });
    }
});

// Получение никнейма Steam
router.get('/steam-nickname', authenticateToken, async (req, res) => {
    try {
        const userResult = await pool.query('SELECT steam_id FROM users WHERE id = $1', [req.user.id]);
        const steamId = userResult.rows[0].steam_id;

        if (!steamId) {
            return res.status(400).json({ error: 'Steam ID не привязан' });
        }

        const apiKey = process.env.STEAM_API_KEY; // Укажи свой Steam API ключ в .env
        const response = await axios.get(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`);
        const steamNickname = response.data.response.players[0].personaname;

        res.json({ steamNickname });
    } catch (err) {
        console.error('Ошибка получения никнейма Steam:', err);
        res.status(500).json({ error: 'Не удалось получить никнейм Steam' });
    }
});

// Получение никнейма и информации FACEit
router.get('/faceit-info', authenticateToken, async (req, res) => {
    try {
        const userResult = await pool.query('SELECT faceit_id FROM users WHERE id = $1', [req.user.id]);
        const faceitId = userResult.rows[0].faceit_id;

        if (!faceitId) {
            return res.status(400).json({ error: 'FACEit ID не привязан' });
        }

        try {
            // Используем FACEIT API для получения данных пользователя
            const playerResponse = await axios.get(`https://open.faceit.com/data/v4/players/${faceitId}`, {
                headers: {
                    'Authorization': `Bearer ${process.env.FACEIT_API_KEY}`
                }
            });
            
            const faceitNickname = playerResponse.data.nickname;
            const faceitUrl = `https://www.faceit.com/ru/players/${faceitNickname}`;
            
            // Получаем статистику CS2 (игра с ID csgo в FACEIT API)
            try {
                const statsResponse = await axios.get(`https://open.faceit.com/data/v4/players/${faceitId}/stats/cs2`, {
                    headers: {
                        'Authorization': `Bearer ${process.env.FACEIT_API_KEY}`
                    }
                });
                
                // Получаем базовые данные о пользователе FACEIT
                const userData = {
                    faceitNickname,
                    faceitUrl,
                    elo: playerResponse.data.games?.cs2?.faceit_elo || playerResponse.data.games?.csgo?.faceit_elo || 0,
                    level: playerResponse.data.games?.cs2?.skill_level || playerResponse.data.games?.csgo?.skill_level || 0,
                    statsFrom: 'cs2'
                };
                
                // Добавляем статистику, если она доступна
                if (statsResponse.data && statsResponse.data.lifetime) {
                    userData.stats = statsResponse.data.lifetime;
                }
                
                res.json(userData);
            } catch (cs2Err) {
                console.log('CS2 статистика не найдена, пробуем CSGO...');
                try {
                    // Пробуем получить статистику CS:GO если CS2 не найдена
                    const statsResponse = await axios.get(`https://open.faceit.com/data/v4/players/${faceitId}/stats/csgo`, {
                        headers: {
                            'Authorization': `Bearer ${process.env.FACEIT_API_KEY}`
                        }
                    });
                    
                    // Получаем базовые данные о пользователе FACEIT
                    const userData = {
                        faceitNickname,
                        faceitUrl,
                        elo: playerResponse.data.games?.csgo?.faceit_elo || playerResponse.data.games?.cs2?.faceit_elo || 0,
                        level: playerResponse.data.games?.csgo?.skill_level || playerResponse.data.games?.cs2?.skill_level || 0,
                        statsFrom: 'csgo'
                    };
                    
                    // Добавляем статистику, если она доступна
                    if (statsResponse.data && statsResponse.data.lifetime) {
                        userData.stats = statsResponse.data.lifetime;
                    }
                    
                    res.json(userData);
                } catch (csgoErr) {
                    console.log('Ни CS2, ни CSGO статистика не найдены');
                    // Если API не доступен, возвращаем только ID с базовой ссылкой
                    res.json({ 
                        faceitNickname: faceitNickname || faceitId, 
                        faceitUrl: `https://www.faceit.com/ru/players/${faceitNickname || faceitId}`,
                        elo: playerResponse.data.games?.cs2?.faceit_elo || playerResponse.data.games?.csgo?.faceit_elo || 0,
                        level: playerResponse.data.games?.cs2?.skill_level || playerResponse.data.games?.csgo?.skill_level || 0,
                        statsFrom: null
                    });
                }
            }
        } catch (apiErr) {
            console.error('Ошибка получения данных с FACEIT API:', apiErr);
            // Если API не доступен, возвращаем только ID с базовой ссылкой
            res.json({ 
                faceitNickname: faceitId, 
                faceitUrl: `https://www.faceit.com/ru/players/${faceitId}`,
                elo: 0,
                level: 0,
                statsFrom: null
            });
        }
    } catch (err) {
        console.error('Ошибка получения информации FACEIT:', err);
        res.status(500).json({ error: 'Не удалось получить данные FACEIT' });
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

// Отвязка FACEIT ID
router.post('/unlink-faceit', authenticateToken, async (req, res) => {
    try {
        await pool.query('UPDATE users SET faceit_id = NULL WHERE id = $1', [req.user.id]);
        res.json({ message: 'FACEIT отвязан' });
    } catch (err) {
        console.error('Ошибка отвязки FACEIT:', err);
        res.status(500).json({ error: 'Не удалось отвязать FACEIT' });
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

// Подтверждение через email
router.post('/verify-email', authenticateToken, async (req, res) => {
    try {
        // Получаем email пользователя из базы данных
        const userResult = await pool.query(
            'SELECT email FROM users WHERE id = $1',
            [req.user.id]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }
        
        const email = userResult.rows[0].email;
        
        // Генерируем 6-значный код
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Сохраняем код в базе данных
        await pool.query(
            'UPDATE users SET verification_token = $1, token_expiry = NOW() + INTERVAL \'30 minutes\' WHERE id = $2',
            [verificationCode, req.user.id]
        );
        
        // Отправляем код по электронной почте
        const mailOptions = {
            from: process.env.SMTP_FROM,
            to: email,
            subject: 'Подтверждение электронной почты - 1337 Community',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Подтверждение электронной почты</h2>
                    <p>Здравствуйте, ${req.user.username}!</p>
                    <p>Для подтверждения вашей электронной почты, пожалуйста, введите следующий код:</p>
                    <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; margin: 20px 0;">
                        <strong>${verificationCode}</strong>
                    </div>
                    <p>Код действителен в течение 30 минут.</p>
                    <p>Если вы не запрашивали подтверждение почты, пожалуйста, проигнорируйте это сообщение.</p>
                    <p>С уважением,<br>Команда 1337 Community</p>
                </div>
            `
        };
        
        await transporter.sendMail(mailOptions);
        
        res.json({ message: 'Код подтверждения отправлен на вашу почту' });
    } catch (err) {
        console.error('Ошибка отправки кода верификации:', err);
        res.status(500).json({ error: 'Не удалось отправить код подтверждения' });
    }
});

router.post('/confirm-email', authenticateToken, async (req, res) => {
    const { code } = req.body;
    
    if (!code) {
        return res.status(400).json({ message: 'Код подтверждения обязателен' });
    }
    
    try {
        const result = await pool.query(
            'SELECT verification_token, token_expiry, email, username FROM users WHERE id = $1',
            [req.user.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }
        
        const { verification_token, token_expiry, email, username } = result.rows[0];
        
        // Проверяем срок действия кода
        if (token_expiry && new Date() > new Date(token_expiry)) {
            return res.status(400).json({ message: 'Срок действия кода истек. Запросите новый код' });
        }
        
        // Проверяем код
        if (code !== verification_token) {
            return res.status(400).json({ message: 'Неверный код подтверждения' });
        }
        
        // Подтверждаем email
        await pool.query(
            'UPDATE users SET is_verified = TRUE, verification_token = NULL, token_expiry = NULL WHERE id = $1',
            [req.user.id]
        );
        
        // Отправляем письмо об успешном подтверждении
        const successMailOptions = {
            from: process.env.SMTP_FROM,
            to: email,
            subject: 'Email успешно подтвержден - 1337 Community',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Ваш email успешно подтвержден!</h2>
                    <p>Здравствуйте, ${username}!</p>
                    <p>Поздравляем! Ваш email был успешно подтвержден.</p>
                    <p>Теперь вам доступны все функции нашего сайта, включая создание и администрирование турниров.</p>
                    <div style="background-color: #f0f8ff; padding: 15px; margin: 20px 0; border-left: 4px solid #4682b4;">
                        <p style="margin: 0;">Добро пожаловать в полноценное сообщество 1337 Community!</p>
                    </div>
                    <p>С уважением,<br>Команда 1337 Community</p>
                </div>
            `
        };
        
        await transporter.sendMail(successMailOptions);
        
        res.json({ message: 'Email успешно подтвержден' });
    } catch (err) {
        console.error('Ошибка подтверждения email:', err);
        res.status(500).json({ error: 'Не удалось подтвердить email' });
    }
});

// Маршрут для перенаправления пользователя на страницу авторизации Faceit для привязки аккаунта
router.get('/link-faceit', authenticateToken, (req, res) => {
    const clientId = process.env.FACEIT_CLIENT_ID;
    const redirectUri = process.env.FACEIT_REDIRECT_URI; // должен точно совпадать с настройками Faceit

    // Генерация code_verifier и вычисление code_challenge (S256)
    const codeVerifier = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    const codeChallenge = hash.toString('base64')
      .replace(/\+/g, '-')  // URL-safe
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Генерируем state-параметр, включающий userId
    const randomPart = crypto.randomBytes(8).toString('hex');
    const state = `${randomPart}-${req.user.id}`;

    console.log('Устанавливаем куки для FACEIT привязки:');
    console.log('code_verifier:', codeVerifier.substring(0, 10) + '...');
    console.log('state:', state);
    console.log('Host:', req.headers.host);
    console.log('Origin:', req.headers.origin);

    // Получаем домен из заголовка или используем стандартный
    const domain = req.headers.host ? req.headers.host.split(':')[0] : '1337community.com';
    const cookieOptions = { 
        httpOnly: true, 
        secure: true, 
        sameSite: 'none',
        maxAge: 15 * 60 * 1000 // 15 минут
    };
    
    console.log('Cookie options:', cookieOptions);

    // Сохраняем codeVerifier и state в куки с настройками для HTTPS
    res.cookie('faceit_code_verifier', codeVerifier, cookieOptions);
    res.cookie('faceit_state', state, cookieOptions);

    const authUrl = 'https://accounts.faceit.com';
    const params = querystring.stringify({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid profile email membership',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state: state,
        redirect_popup: 'true'
    });
    
    console.log('Redirect URL:', `${authUrl}?${params}`);
    console.log('FACEIT параметры:', {clientId, redirectUri});
    
    res.redirect(`${authUrl}?${params}`);
});

// Callback для Faceit после авторизации
router.get('/faceit-callback', async (req, res) => {
    const { code, state: returnedState } = req.query;
    console.log('Получен callback от FACEIT:', req.query);
    console.log('Cookies в запросе:', req.cookies);
    
    if (!code) {
        console.error('Ошибка: Код авторизации отсутствует');
        return res.redirect('https://1337community.com/profile?error=no_code');
    }
    
    try {
        const savedState = req.cookies.faceit_state;
        if (!savedState || savedState !== returnedState) {
            console.error('Ошибка: Несоответствие state параметра', {
                savedState,
                returnedState
            });
            return res.redirect('https://1337community.com/profile?error=invalid_state');
        }
        
        const codeVerifier = req.cookies.faceit_code_verifier;
        if (!codeVerifier) {
            console.error('Ошибка: code_verifier отсутствует в куки');
            return res.redirect('https://1337community.com/profile?error=no_verifier');
        }

        console.log('Отправка запроса на получение токена FACEIT...');
        
        // Обмен кода авторизации на токен, передавая code_verifier
        const tokenParams = {
            grant_type: 'authorization_code',
            code,
            redirect_uri: process.env.FACEIT_REDIRECT_URI,
            code_verifier: codeVerifier
        };
        
        const tokenResponse = await axios.post(
            'https://api.faceit.com/auth/v1/oauth/token',
            querystring.stringify(tokenParams),
            { 
                headers: { 
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + Buffer.from(
                        `${process.env.FACEIT_CLIENT_ID}:${process.env.FACEIT_CLIENT_SECRET}`
                    ).toString('base64')
                }
            }
        );
        
        const { access_token } = tokenResponse.data;
        console.log('Токен получен успешно, запрашиваем данные пользователя');
        
        // Получение данных пользователя с помощью access_token
        const userInfoResponse = await axios.get(
            'https://api.faceit.com/auth/v1/resources/userinfo',
            { headers: { Authorization: `Bearer ${access_token}` } }
        );
        const faceitUser = userInfoResponse.data;
        
        // Извлекаем FACEIT ID и никнейм
        const faceitId = faceitUser.sub || faceitUser.guid || faceitUser.id;
        const faceitNickname = faceitUser.nickname || faceitUser.name || faceitUser.preferred_username;
        
        console.log('Получены данные пользователя FACEIT:', faceitId, faceitNickname);
        
        // Очищаем куки
        res.clearCookie('faceit_code_verifier', { httpOnly: true, secure: true, sameSite: 'none' });
        res.clearCookie('faceit_state', { httpOnly: true, secure: true, sameSite: 'none' });
        
        // Проверяем, является ли это операцией входа или привязки профиля
        if (savedState.includes('-login')) {
            // Проверяем, существует ли пользователь с данным FACEIT ID
            const existingUser = await pool.query('SELECT * FROM users WHERE faceit_id = $1', [faceitId]);
            
            if (existingUser.rows.length > 0) {
                // Если пользователь существует, создаем JWT и перенаправляем
                const user = existingUser.rows[0];
                const token = jwt.sign(
                    { id: user.id, role: user.role, username: user.username },
                    process.env.JWT_SECRET,
                    { expiresIn: '1h' }
                );
                console.log('Existing user found, redirecting with token:', token);
                return res.redirect(`https://1337community.com/auth-callback?token=${token}`);
            } else {
                // Если пользователь не существует, создаем новый аккаунт
                console.log('Creating new user with FACEIT profile:', faceitNickname);
                
                const newUserResult = await pool.query(
                    'INSERT INTO users (username, faceit_id) VALUES ($1, $2) RETURNING id, username, role',
                    [faceitNickname, faceitId]
                );
                
                const newUser = newUserResult.rows[0];
                
                // Создаем JWT для нового пользователя
                const token = jwt.sign(
                    { id: newUser.id, role: newUser.role, username: newUser.username },
                    process.env.JWT_SECRET,
                    { expiresIn: '1h' }
                );
                
                console.log('Created new user with FACEIT profile, redirecting with token:', newUser);
                return res.redirect(`https://1337community.com/auth-callback?token=${token}`);
            }
        } else {
            // Это операция привязки профиля к существующему аккаунту
            const stateParts = savedState.split('-');
            const userId = stateParts[stateParts.length - 1];
            
            // Проверяем, не привязан ли уже FACEIT ID к другому аккаунту
            const existingFaceitUser = await pool.query('SELECT * FROM users WHERE faceit_id = $1 AND id != $2', [faceitId, userId]);
            if (existingFaceitUser.rows.length > 0) {
                console.error('FACEIT ID уже привязан к другому аккаунту');
                return res.redirect('https://1337community.com/profile?error=faceit_already_linked');
            }
            
            // Обновляем faceit_id для пользователя в базе данных
            await pool.query('UPDATE users SET faceit_id = $1 WHERE id = $2', [faceitId, userId]);
            console.log('FACEit профиль успешно привязан для пользователя', userId);
            
            res.redirect('https://1337community.com/profile?faceit=success');
        }
    } catch (err) {
        console.error('Ошибка FACEIT авторизации:', err.response?.data || err.message);
        // Более подробный лог ошибки
        if (err.response) {
            console.error('Данные ответа с ошибкой:', {
                data: err.response.data,
                status: err.response.status,
                headers: err.response.headers
            });
        }
        
        res.redirect(`https://1337community.com/auth-error?message=${encodeURIComponent(err.message)}`);
    }
});

// Маршрут для авторизации через FACEIT (инициация процесса)
router.get('/faceit-login', (req, res) => {
    console.log('Инициирован вход через FACEIT');
    const clientId = process.env.FACEIT_CLIENT_ID;
    const redirectUri = process.env.FACEIT_REDIRECT_URI; // должен точно совпадать с настройками Faceit

    // Генерация code_verifier и вычисление code_challenge (S256)
    const codeVerifier = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    const codeChallenge = hash.toString('base64')
      .replace(/\+/g, '-')  // URL-safe
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Генерируем state-параметр с пометкой, что это логин
    const randomPart = crypto.randomBytes(8).toString('hex');
    const state = `${randomPart}-login`;

    console.log('Устанавливаем куки для FACEIT авторизации:');
    console.log('code_verifier:', codeVerifier.substring(0, 10) + '...');
    console.log('state:', state);

    const cookieOptions = { 
        httpOnly: true, 
        secure: true, 
        sameSite: 'none',
        maxAge: 15 * 60 * 1000 // 15 минут
    };
    
    // Сохраняем codeVerifier и state в куки
    res.cookie('faceit_code_verifier', codeVerifier, cookieOptions);
    res.cookie('faceit_state', state, cookieOptions);

    const authUrl = 'https://accounts.faceit.com';
    const params = querystring.stringify({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid profile email membership',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state: state,
        redirect_popup: 'true'
    });
    
    console.log('FACEIT login redirect URL:', `${authUrl}?${params}`);
    
    res.redirect(`${authUrl}?${params}`);
});

module.exports = router;