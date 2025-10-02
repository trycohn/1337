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
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sendWelcomeEmail } = require('../services/emailService');

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

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/avatars');
        // Создаем директорию, если она не существует
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Используем userId и timestamp для уникального имени файла
        const userId = req.user.id;
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `user_${userId}_${timestamp}${ext}`);
    }
});

// Фильтр файлов для multer
const fileFilter = (req, file, cb) => {
    // Принимаем только изображения
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Разрешены только изображения'), false);
    }
};

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5 МБ
    },
    fileFilter: fileFilter
});

// Регистрация нового пользователя
router.post('/register', async (req, res) => {
    const { username, email, password, referralCode } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Username, email и пароль обязательны' });
    }

    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const usernameCheck = await client.query('SELECT * FROM users WHERE username = $1', [username]);
        if (usernameCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Имя пользователя уже занято' });
        }

        const emailCheck = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        if (emailCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Email уже зарегистрирован' });
        }

        // 🔗 ОБРАБОТКА РЕФЕРАЛЬНОГО КОДА
        let referrerId = null;
        let referralLinkId = null;
        let tournamentId = null;
        
        if (referralCode) {
            console.log(`🔗 Проверяем реферальный код: ${referralCode}`);
            
            // Ищем активную реферальную ссылку
            const referralResult = await client.query(`
                SELECT rl.*, u.username as referrer_username 
                FROM referral_links rl
                JOIN users u ON rl.user_id = u.id
                WHERE rl.referral_code = $1 
                  AND rl.expires_at > NOW() 
                  AND rl.uses_count < rl.max_uses
                  AND rl.is_active = true
            `, [referralCode]);
            
            if (referralResult.rows.length > 0) {
                const referralLink = referralResult.rows[0];
                referrerId = referralLink.user_id;
                referralLinkId = referralLink.id;
                tournamentId = referralLink.tournament_id;
                
                console.log(`✅ Действительный реферальный код найден. Приглашающий: ${referralLink.referrer_username} (ID: ${referrerId})`);
            } else {
                console.log(`❌ Недействительный или истекший реферальный код: ${referralCode}`);
                // Не блокируем регистрацию, просто игнорируем неверный код
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await client.query(
            'INSERT INTO users (username, email, password_hash, invited_by, invited_at) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, role',
            [username, email, hashedPassword, referrerId, referrerId ? new Date() : null]
        );
        const newUser = result.rows[0];

        // 🔗 ОБНОВЛЯЕМ СТАТИСТИКУ РЕФЕРАЛЬНОЙ ССЫЛКИ
        if (referralLinkId) {
            await client.query(`
                UPDATE referral_links 
                SET uses_count = uses_count + 1, 
                    last_used_at = NOW() 
                WHERE id = $1
            `, [referralLinkId]);
            
            // Создаем запись об использовании реферальной ссылки
            await client.query(`
                INSERT INTO referral_uses (referral_link_id, new_user_id, registration_ip, user_agent)
                VALUES ($1, $2, $3, $4)
            `, [referralLinkId, newUser.id, req.ip, req.get('User-Agent')]);
            
            console.log(`✅ Статистика реферальной ссылки обновлена. Использований: +1`);
        }

        const token = jwt.sign(
            { id: newUser.id, role: newUser.role, username: newUser.username },
            process.env.JWT_SECRET,
            { expiresIn: '168h' }
        );

        // 📧 УЛУЧШЕННАЯ ОТПРАВКА ПРИВЕТСТВЕННОГО EMAIL
        let emailSent = false;
        let emailError = null;
        try {
            console.log(`📧 Отправляем приветственное письмо пользователю ${username} (${email})`);
            const emailResult = await sendWelcomeEmail(email, username);
            if (emailResult.success) {
                console.log(`✅ Приветственное письмо успешно отправлено: ${emailResult.messageId}`);
                emailSent = true;
            } else {
                console.error(`❌ Ошибка отправки приветственного письма:`, emailResult.error);
                emailError = emailResult.error;
            }
        } catch (emailException) {
            console.error('❌ Исключение при отправке приветственного email:', emailException);
            emailError = emailException.message;
        }

        // 🔔 ОТПРАВЛЯЕМ СИСТЕМНОЕ УВЕДОМЛЕНИЕ
        try {
            const { sendSystemNotification } = require('../utils/systemNotifications');
            
            let welcomeMessage = `🎉 Добро пожаловать в 1337 Community, ${username}!\n\n` +
                               `Ваш аккаунт успешно создан и готов к использованию.\n` +
                               `• Участвуйте в турнирах\n` +
                               `• Находите команду\n` +
                               `• Отслеживайте статистику\n` +
                               `• Получайте достижения\n\n`;
            
            // Добавляем информацию о реферальном приглашении
            if (referrerId) {
                const referrerResult = await client.query('SELECT username FROM users WHERE id = $1', [referrerId]);
                const referrerUsername = referrerResult.rows[0]?.username || 'Неизвестный';
                welcomeMessage += `🔗 Вы были приглашены пользователем ${referrerUsername}!\n`;
                
                if (tournamentId) {
                    const tournamentResult = await client.query('SELECT name FROM tournaments WHERE id = $1', [tournamentId]);
                    const tournamentName = tournamentResult.rows[0]?.name || 'Неизвестный турнир';
                    welcomeMessage += `🏆 Автоматическое участие в турнире "${tournamentName}"!\n`;
                }
                welcomeMessage += '\n';
            }
                               
            welcomeMessage += `${emailSent ? '📧 Приветственное письмо отправлено на ваш email.' : '⚠️ Не удалось отправить приветственное письмо.'}`;
            
            await sendSystemNotification(newUser.id, welcomeMessage, 'welcome', {
                userId: newUser.id,
                username: username,
                email: email,
                emailSent: emailSent,
                referrerId: referrerId,
                tournamentId: tournamentId
            });
            
            console.log(`✅ Системное уведомление отправлено пользователю ${username}`);
        } catch (notificationError) {
            console.error('⚠️ Ошибка отправки системного уведомления:', notificationError);
            // Не блокируем регистрацию
        }

        // 🔗 АВТОМАТИЧЕСКОЕ УЧАСТИЕ В ТУРНИРЕ (если есть реферальная ссылка)
        if (tournamentId && referrerId) {
            try {
                // Проверяем, что турнир все еще активен и принимает участников
                const tournamentCheck = await client.query(`
                    SELECT status, max_participants, 
                           (SELECT COUNT(*) FROM tournament_participants WHERE tournament_id = $1) as current_participants
                    FROM tournaments WHERE id = $1
                `, [tournamentId]);
                
                if (tournamentCheck.rows.length > 0) {
                    const tournament = tournamentCheck.rows[0];
                    
                    if (tournament.status === 'active' && 
                        (!tournament.max_participants || tournament.current_participants < tournament.max_participants)) {
                        
                        // Добавляем пользователя в турнир
                        await client.query(`
                            INSERT INTO tournament_participants (tournament_id, user_id)
                            VALUES ($1, $2)
                            ON CONFLICT (tournament_id, user_id) DO NOTHING
                        `, [tournamentId, newUser.id]);
                        
                        console.log(`✅ Пользователь ${username} автоматически добавлен в турнир ID: ${tournamentId}`);
                        
                        // Отправляем уведомление о успешном участии
                        await sendSystemNotification(newUser.id, 
                            `🏆 Вы успешно зарегистрированы в турнире!\n\nБлагодаря реферальной ссылке вы автоматически стали участником турнира.`, 
                            'tournament_join', 
                            { tournamentId: tournamentId }
                        );
                    }
                }
            } catch (tournamentError) {
                console.error('❌ Ошибка автоматического добавления в турнир:', tournamentError);
                // Не блокируем регистрацию
            }
        }

        // 🔗 УВЕДОМЛЯЕМ ПРИГЛАСИВШЕГО ПОЛЬЗОВАТЕЛЯ
        if (referrerId) {
            try {
                const { sendSystemNotification } = require('../utils/systemNotifications');
                
                await sendSystemNotification(referrerId, 
                    `🎉 По вашей реферальной ссылке зарегистрировался новый пользователь!\n\n` +
                    `👤 Пользователь: ${username}\n` +
                    `🏆 Вы получили бонусы за привлечение нового игрока!`, 
                    'referral_success', 
                    { 
                        newUserId: newUser.id, 
                        newUsername: username,
                        tournamentId: tournamentId 
                    }
                );
                
                console.log(`✅ Уведомление о новом реферале отправлено пользователю ID: ${referrerId}`);
            } catch (referralNotificationError) {
                console.error('⚠️ Ошибка отправки уведомления о реферале:', referralNotificationError);
            }
        }

        // 🏆 ПРОВЕРЯЕМ ДОСТИЖЕНИЯ ДЛЯ НОВОГО ПОЛЬЗОВАТЕЛЯ
        try {
            const achievementSystem = require('../services/achievementSystem');
            
            // Инициализируем систему достижений если не инициализирована
            if (!achievementSystem.initialized) {
                await achievementSystem.initialize();
            }
            
            await achievementSystem.triggerAchievementCheck(newUser.id, 'registration', {
                username: username,
                registrationDate: new Date(),
                referrerId: referrerId,
                tournamentId: tournamentId
            });
            console.log(`🏆 Проверка достижений запущена для пользователя ${username}`);
        } catch (achievementError) {
            console.error('⚠️ Ошибка проверки достижений:', achievementError);
            // Не блокируем регистрацию
        }

        await client.query('COMMIT');

        // 📊 ВОЗВРАЩАЕМ РАСШИРЕННУЮ ИНФОРМАЦИЮ
        const responseData = {
            message: 'Пользователь создан',
            userId: newUser.id,
            token,
            user: {
                id: newUser.id,
                username: newUser.username,
                email: email,
                role: newUser.role
            },
            emailSent: emailSent,
            referralSuccess: !!referrerId,
            tournamentJoined: !!(tournamentId && referrerId)
        };

        // Добавляем информацию об ошибке email только в dev режиме
        if (!emailSent && process.env.NODE_ENV === 'development') {
            responseData.emailError = emailError;
        }

        console.log(`🎉 Пользователь ${username} успешно зарегистрирован (ID: ${newUser.id})${referrerId ? ` по реферальной ссылке от пользователя ID: ${referrerId}` : ''}`);
        res.status(201).json(responseData);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Ошибка регистрации:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
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
            { expiresIn: '168h' }
        );

        res.json({ token });
    } catch (err) {
        console.error('Ошибка входа:', err);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Получение данных текущего пользователя
router.get('/me', authenticateToken, async (req, res) => {
    const start = Date.now();
    try {
        const userId = req.user.id;
        const result = await pool.query(
            'SELECT id, username, email, role, steam_id, faceit_id, full_name, birth_date, steam_url, avatar_url, is_verified, cs2_premier_rank ' +
            'FROM users WHERE id = $1',
            [userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        // Короткое приватное кеширование, вариация по авторизации, метрики
        res.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
        res.set('Vary', 'Authorization');
        try {
            res.set('ETag', `W/"user-${userId}-${result.rows[0].username || ''}-${result.rows[0].avatar_url || ''}"`);
            res.set('X-Response-Time', `${Date.now() - start}ms`);
        } catch (_) {}

        return res.json(result.rows[0]);
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

        // 🛡️ АНТИЧИТ: Импортируем сервис проверки Trust Score
        const { verifyUserSteamAccount, needsTrustScoreRecheck } = require('../services/antiCheat');

        // Проверяем, существует ли пользователь с данным Steam ID
        const existingUser = await pool.query('SELECT * FROM users WHERE steam_id = $1', [steamId]);
        console.log('Existing user with steam_id:', existingUser.rows);

        if (existingUser.rows.length > 0) {
            // Если пользователь существует
            const user = existingUser.rows[0];
            
            // 🛡️ АНТИЧИТ: Проверяем, не забанен ли пользователь
            if (user.is_banned) {
                console.log('❌ User is banned, rejecting login');
                return res.redirect(`https://1337community.com/auth-error?reason=banned&message=${encodeURIComponent(user.ban_reason || 'Your account has been banned')}`);
            }
            
            // 🛡️ АНТИЧИТ: Перепроверяем Trust Score раз в 7 дней
            const needsRecheck = await needsTrustScoreRecheck(user.id);
            
            if (needsRecheck) {
                console.log('🔍 Trust Score recheck required for user:', user.id);
                const trustResult = await verifyUserSteamAccount(steamId, user.id);
                
                if (trustResult.action === 'HARD_BAN') {
                    // Баним аккаунт
                    await pool.query(
                        'UPDATE users SET is_banned = true, ban_reason = $1, banned_at = NOW() WHERE id = $2',
                        [trustResult.reason, user.id]
                    );
                    console.log('❌ User banned due to Trust Score:', user.id);
                    return res.redirect(`https://1337community.com/auth-error?reason=trust_score&message=${encodeURIComponent(trustResult.reason)}`);
                }
                
                console.log(`✅ Trust Score OK: ${trustResult.score}/100 (${trustResult.action})`);
            }
            
            // Создаем JWT и перенаправляем
            const token = jwt.sign(
                { id: user.id, role: user.role, username: user.username },
                process.env.JWT_SECRET,
                { expiresIn: '168h' }
            );
            console.log('User exists, redirecting with token:', token);
            return res.redirect(`https://1337community.com/auth-callback?token=${token}`);
        } else {
            // Если пользователь не существует
            
            // 🛡️ АНТИЧИТ: Проверяем Trust Score ПЕРЕД созданием аккаунта
            console.log('🛡️ New user registration, checking Trust Score...');
            const trustResult = await verifyUserSteamAccount(steamId);
            
            if (trustResult.action === 'HARD_BAN') {
                console.log('❌ Registration blocked due to Trust Score:', trustResult.reason);
                return res.redirect(`https://1337community.com/auth-error?reason=vac_ban&message=${encodeURIComponent(trustResult.reason || 'Your Steam account is not eligible for registration')}`);
            }
            
            if (trustResult.action === 'SOFT_BAN') {
                console.log('⚠️ Registration flagged for review:', trustResult.reason);
                // Можно добавить дополнительную верификацию (email, SMS и т.д.)
                // Пока пропускаем с предупреждением
            }
            
            console.log(`✅ Trust Score OK for new user: ${trustResult.score}/100 (${trustResult.action})`);
            
            // Получаем никнейм из Steam
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
            
            // 🛡️ АНТИЧИТ: Сохраняем Trust Score в БД
            await verifyUserSteamAccount(steamId, newUser.id);
            console.log('✅ Trust Score saved for new user:', newUser.id);
            
            // Создаем JWT для нового пользователя
            const token = jwt.sign(
                { id: newUser.id, role: newUser.role, username: newUser.username },
                process.env.JWT_SECRET,
                { expiresIn: '168h' }
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

        // Пытаемся получить никнейм через Steam API при привязке
        let steamNickname = null;
        try {
            const apiKey = process.env.STEAM_API_KEY;
            if (apiKey) {
                const response = await axios.get(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`);
                if (response.data?.response?.players?.length > 0) {
                    steamNickname = response.data.response.players[0].personaname;
                    console.log(`Получен Steam никнейм для пользователя ${req.user.id}: "${steamNickname}"`);
                }
            }
        } catch (apiError) {
            console.log('Не удалось получить Steam никнейм при привязке:', apiError.message);
            // Продолжаем без никнейма - это не критично
        }

        // Обновляем Steam данные в БД (включая никнейм если получили)
        await pool.query(
            'UPDATE users SET steam_id = $1, steam_url = $2, steam_nickname = $3 WHERE id = $4',
            [steamId, `https://steamcommunity.com/profiles/${steamId}`, steamNickname, req.user.id]
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
        await pool.query('UPDATE users SET steam_id = NULL, steam_url = NULL, steam_nickname = NULL WHERE id = $1', [req.user.id]);
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

    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Неправильный формат email' });
    }

    try {
        console.log(`🔄 Обновление email для пользователя ID: ${req.user.id}`);
        console.log(`📧 Новый email: ${email}`);

        // Получаем текущие данные пользователя для диагностики
        const currentUserResult = await pool.query(
            'SELECT id, username, email, steam_id, faceit_id FROM users WHERE id = $1',
            [req.user.id]
        );

        if (currentUserResult.rows.length === 0) {
            console.error('❌ Пользователь не найден в базе данных');
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const currentUser = currentUserResult.rows[0];
        console.log(`👤 Текущий пользователь:`, {
            id: currentUser.id,
            username: currentUser.username,
            currentEmail: currentUser.email,
            steamId: currentUser.steam_id,
            faceitId: currentUser.faceit_id
        });

        // Проверяем, не занят ли email другим пользователем
        console.log('🔍 Проверяем занятость email...');
        const emailCheck = await pool.query(
            'SELECT id, username, email FROM users WHERE email = $1 AND id != $2',
            [email, req.user.id]
        );

        if (emailCheck.rows.length > 0) {
            console.warn('⚠️ Email уже занят другим пользователем:', emailCheck.rows[0]);
            return res.status(400).json({ error: 'Этот email уже занят' });
        }

        console.log('✅ Email свободен, выполняем обновление...');

        // Обновляем email и сбрасываем статус верификации
        const updateResult = await pool.query(
            'UPDATE users SET email = $1, is_verified = FALSE WHERE id = $2 RETURNING id, username, email, is_verified',
            [email, req.user.id]
        );

        if (updateResult.rows.length === 0) {
            console.error('❌ Не удалось обновить email - пользователь не найден');
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const updatedUser = updateResult.rows[0];
        console.log('✅ Email успешно обновлен:', {
            id: updatedUser.id,
            username: updatedUser.username,
            newEmail: updatedUser.email,
            isVerified: updatedUser.is_verified
        });

        res.json({ 
            message: 'Email успешно обновлен',
            user: {
                email: updatedUser.email,
                isVerified: updatedUser.is_verified
            }
        });
    } catch (err) {
        console.error('❌ Ошибка обновления email:', err);
        
        // Детальная информация об ошибке для диагностики
        let errorMessage = 'Не удалось обновить email';
        let errorDetails = {};

        if (err.code === '23505') {
            // Уникальное ограничение
            errorMessage = 'Этот email уже используется';
            errorDetails = { duplicateKey: true };
        } else if (err.code === '23503') {
            // Нарушение внешнего ключа
            errorMessage = 'Ошибка связи с базой данных';
            errorDetails = { foreignKeyViolation: true };
        } else if (err.code === '23502') {
            // Нарушение NOT NULL
            errorMessage = 'Недостаточно данных для обновления';
            errorDetails = { notNull: true };
        } else if (err.code === '23514') {
            // Нарушение CHECK constraint
            errorMessage = 'Данные не соответствуют требованиям';
            errorDetails = { checkConstraint: true };
        }

        // Дополнительная информация для разработчиков
        if (process.env.NODE_ENV === 'development') {
            errorDetails.sqlCode = err.code;
            errorDetails.sqlMessage = err.message;
        }

        res.status(500).json({ 
            error: errorMessage,
            details: errorDetails
        });
    }
});

// Смена пароля пользователя
router.post('/change-password', authenticateToken, async (req, res) => {
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (!oldPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ message: 'Все поля обязательны для заполнения' });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: 'Новые пароли не совпадают' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Новый пароль должен содержать минимум 6 символов' });
    }

    try {
        // Получаем текущего пользователя
        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }
        const user = userResult.rows[0];

        // Проверяем старый пароль
        if (!user.password_hash) {
            return res.status(400).json({ message: 'У пользователя не установлен пароль. Обратитесь к администратору.' });
        }

        const validOldPassword = await bcrypt.compare(oldPassword, user.password_hash);
        if (!validOldPassword) {
            return res.status(400).json({ message: 'Неверный старый пароль' });
        }

        // Хешируем новый пароль
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Обновляем пароль в базе данных
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedNewPassword, req.user.id]);

        res.json({ message: 'Пароль успешно изменен' });
    } catch (err) {
        console.error('Ошибка смены пароля:', err);
        res.status(500).json({ error: 'Не удалось изменить пароль' });
    }
});

// Получение никнейма Steam
router.get('/steam-nickname', authenticateToken, async (req, res) => {
    try {
        const userResult = await pool.query('SELECT steam_id, steam_nickname FROM users WHERE id = $1', [req.user.id]);
        const { steam_id: steamId, steam_nickname: cachedNickname } = userResult.rows[0];

        if (!steamId) {
            return res.status(400).json({ error: 'Steam ID не привязан' });
        }

        try {
            // Пытаемся получить никнейм через Steam API
            const apiKey = process.env.STEAM_API_KEY;
            const response = await axios.get(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`);
            const steamNickname = response.data.response.players[0].personaname;

            // Если получили никнейм через API - обновляем в БД
            if (steamNickname && steamNickname !== cachedNickname) {
                console.log(`Обновляем Steam никнейм для пользователя ${req.user.id}: "${cachedNickname}" -> "${steamNickname}"`);
                await pool.query('UPDATE users SET steam_nickname = $1 WHERE id = $2', [steamNickname, req.user.id]);
            }

            res.json({ steamNickname });
        } catch (apiError) {
            console.log('Steam API недоступен, используем кэшированный никнейм:', apiError.message);
            
            // Если API недоступен, но есть кэшированный никнейм - возвращаем его
            if (cachedNickname) {
                res.json({ steamNickname: cachedNickname });
            } else {
                // Если никнейма нет даже в кэше - возвращаем ошибку
                res.status(500).json({ error: 'Steam API недоступен и никнейм не найден в кэше' });
            }
        }
    } catch (err) {
        console.error('Ошибка получения никнейма Steam:', err);
        res.status(500).json({ error: 'Не удалось получить никнейм Steam' });
    }
});

// Получение никнейма и информации FACEit
router.get('/faceit-info', authenticateToken, async (req, res) => {
    try {
        const userResult = await pool.query('SELECT faceit_id, faceit_elo FROM users WHERE id = $1', [req.user.id]);
        const { faceit_id: faceitId, faceit_elo: currentFaceitElo } = userResult.rows[0];

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
            
            // Получаем новое значение ELO из ответа API
            const newElo = playerResponse.data.games?.cs2?.faceit_elo || playerResponse.data.games?.csgo?.faceit_elo || 0;
            
            // Проверяем, изменилось ли ELO
            if (newElo !== currentFaceitElo && newElo > 0) {
                console.log(`Обновляем FACEIT ELO для пользователя ${req.user.id}: ${currentFaceitElo} -> ${newElo}`);
                // Обновляем ELO в базе данных
                await pool.query('UPDATE users SET faceit_elo = $1 WHERE id = $2', [newElo, req.user.id]);
            }
            
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
                    elo: newElo,
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
                        elo: newElo,
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
                        elo: newElo,
                        level: playerResponse.data.games?.cs2?.skill_level || playerResponse.data.games?.csgo?.skill_level || 0,
                        statsFrom: null
                    });
                }
            }
        } catch (apiErr) {
            console.error('Ошибка получения данных с FACEIT API:', apiErr);
            // Если API не доступен, возвращаем только ID с базовой ссылкой и текущий ELO из базы
            res.json({ 
                faceitNickname: faceitId, 
                faceitUrl: `https://www.faceit.com/ru/players/${faceitId}`,
                elo: currentFaceitElo || 0,
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
            'SELECT t.name, t.game, uts.result, uts.wins, uts.losses, uts.is_team ' +
            'FROM user_tournament_stats uts ' +
            'JOIN tournaments t ON uts.tournament_id = t.id ' +
            'WHERE uts.user_id = $1',
            [req.user.id]
        );

        const stats = statsResult.rows;
        const soloStats = stats.filter(s => !s.is_team);
        const teamStats = stats.filter(s => s.is_team);

        const soloWins = soloStats.reduce((sum, s) => sum + (s.wins || 0), 0);
        const soloLosses = soloStats.reduce((sum, s) => sum + (s.losses || 0), 0);
        const teamWins = teamStats.reduce((sum, s) => sum + (s.wins || 0), 0);
        const teamLosses = teamStats.reduce((sum, s) => sum + (s.losses || 0), 0);

        const soloWinRate = soloWins + soloLosses > 0 ? (soloWins / (soloWins + soloLosses)) * 100 : 0;
        const teamWinRate = teamWins + teamLosses > 0 ? (teamWins / (teamWins + teamLosses)) * 100 : 0;
        
        // Статистика по играм
        const gameStats = {};
        stats.forEach(stat => {
            if (!gameStats[stat.game]) {
                gameStats[stat.game] = {
                    solo: { wins: 0, losses: 0 },
                    team: { wins: 0, losses: 0 }
                };
            }
            if (stat.is_team) {
                gameStats[stat.game].team.wins += (stat.wins || 0);
                gameStats[stat.game].team.losses += (stat.losses || 0);
            } else {
                gameStats[stat.game].solo.wins += (stat.wins || 0);
                gameStats[stat.game].solo.losses += (stat.losses || 0);
            }
        });

        res.json({
            tournaments: stats,
            solo: { wins: soloWins, losses: soloLosses, winRate: soloWinRate.toFixed(2) },
            team: { wins: teamWins, losses: teamLosses, winRate: teamWinRate.toFixed(2) },
            byGame: gameStats
        });
    } catch (err) {
        console.error('Ошибка получения статистики:', err);
        res.status(500).json({ error: 'Не удалось загрузить статистику' });
    }
});

// Функция для автоматического расчета и обновления результатов турниров
router.post('/recalculate-tournament-stats', authenticateToken, async (req, res) => {
    try {
        console.log('🔄 Начинаем пересчет статистики турниров для пользователя:', req.user.id);
        
        // Проверяем существование таблицы user_tournament_stats
        const tableCheckResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'user_tournament_stats'
            );
        `);
        
        if (!tableCheckResult.rows[0].exists) {
            console.error('❌ Таблица user_tournament_stats не существует!');
            return res.status(500).json({ 
                error: 'Таблица статистики не создана. Обратитесь к администратору.',
                needsTableCreation: true
            });
        }

        // Получаем все завершенные турниры где участвовал пользователь
        const userTournamentsResult = await pool.query(`
            SELECT DISTINCT t.id, t.name, t.game, t.participant_type, t.format, t.status
            FROM tournaments t
            WHERE t.status = 'completed' 
            AND (
                (t.participant_type = 'solo' AND EXISTS(
                    SELECT 1 FROM tournament_participants tp 
                    WHERE tp.tournament_id = t.id AND tp.user_id = $1
                )) OR
                (t.participant_type = 'team' AND EXISTS(
                    SELECT 1 FROM tournament_teams tt 
                    JOIN tournament_team_members ttm ON tt.id = ttm.team_id 
                    WHERE tt.tournament_id = t.id AND ttm.user_id = $1
                ))
            )
        `, [req.user.id]);

        let updatedTournaments = 0;
        let skippedTournaments = 0;
        let errors = [];

        for (const tournament of userTournamentsResult.rows) {
            try {
                console.log(`🎯 Обрабатываем турнир: ${tournament.name} (ID: ${tournament.id})`);
                
                const result = await calculateTournamentResult(tournament.id, req.user.id, tournament.participant_type);
                
                if (result) {
                    // ✅ БЕЗОПАСНЫЙ UPSERT вместо DELETE+INSERT
                    await pool.query(`
                        INSERT INTO user_tournament_stats (user_id, tournament_id, result, wins, losses, is_team)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        ON CONFLICT (user_id, tournament_id) 
                        DO UPDATE SET 
                            result = EXCLUDED.result,
                            wins = EXCLUDED.wins,
                            losses = EXCLUDED.losses,
                            is_team = EXCLUDED.is_team,
                            updated_at = CURRENT_TIMESTAMP
                    `, [
                        req.user.id,
                        tournament.id, 
                        result.place,
                        result.wins || 0,
                        result.losses || 0,
                        tournament.participant_type === 'team'
                    ]);
                    
                    updatedTournaments++;
                    console.log(`✅ Обновлена статистика для турнира ${tournament.name}: ${result.place} (${result.wins}П/${result.losses}П)`);
                } else {
                    skippedTournaments++;
                    console.log(`⚠️ Пропущен турнир ${tournament.name}: не удалось определить результат`);
                }
            } catch (tournamentError) {
                errors.push({
                    tournament: tournament.name,
                    error: tournamentError.message
                });
                console.error(`❌ Ошибка обработки турнира ${tournament.name}:`, tournamentError.message);
            }
        }

        const totalTournaments = userTournamentsResult.rows.length;
        
        // Возвращаем подробный отчет
        res.json({ 
            success: true,
            message: `Статистика обработана для ${totalTournaments} турниров`,
            details: {
                total: totalTournaments,
                updated: updatedTournaments,
                skipped: skippedTournaments,
                errors: errors.length
            },
            errors: errors.length > 0 ? errors : undefined,
            // Добавляем информацию для фронтенда
            statusMessage: errors.length === 0 
                ? `Обновлено: ${updatedTournaments} из ${totalTournaments} турниров`
                : `Обновлено: ${updatedTournaments} из ${totalTournaments}, ошибок: ${errors.length}`
        });
    } catch (err) {
        console.error('❌ Критическая ошибка пересчета статистики турниров:', err);
        
        // Детальная информация об ошибке для разработчиков
        let errorMessage = 'Не удалось пересчитать статистику';
        let needsTableCreation = false;
        
        if (err.message.includes('user_tournament_stats') && err.message.includes('does not exist')) {
            errorMessage = 'Таблица статистики не создана';
            needsTableCreation = true;
        } else if (err.code === '23505') { // Duplicate key
            errorMessage = 'Конфликт данных при обновлении статистики';
        } else if (err.code === '23503') { // Foreign key violation
            errorMessage = 'Ссылочная целостность нарушена';
        }
        
        res.status(500).json({ 
            error: errorMessage,
            needsTableCreation,
            sqlErrorCode: err.code,
            development: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Функция для определения результата игрока в турнире
async function calculateTournamentResult(tournamentId, userId, participantType) {
    try {
        // Получаем все матчи турнира
        const matchesResult = await pool.query(
            'SELECT * FROM matches WHERE tournament_id = $1 ORDER BY round DESC',
            [tournamentId]
        );
        
        const matches = matchesResult.rows;
        if (matches.length === 0) return null;

        // Получаем ID участника (team или participant)
        let participantId;
        if (participantType === 'solo') {
            const participantResult = await pool.query(
                'SELECT id FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2',
                [tournamentId, userId]
            );
            if (participantResult.rows.length === 0) return null;
            participantId = participantResult.rows[0].id;
        } else {
            const teamResult = await pool.query(`
                SELECT tt.id 
                FROM tournament_teams tt
                JOIN tournament_team_members ttm ON tt.id = ttm.team_id
                WHERE tt.tournament_id = $1 AND ttm.user_id = $2
            `, [tournamentId, userId]);
            if (teamResult.rows.length === 0) return null;
            participantId = teamResult.rows[0].id;
        }

        // Находим финальный матч
        const finalMatch = matches.find(match => {
            const maxRound = Math.max(...matches.map(m => m.round || 0));
            return (match.round === maxRound && match.bracket_type !== 'placement' && match.winner_team_id !== null);
        });

        // Проверяем, выиграл ли игрок турнир (1 место)
        if (finalMatch && finalMatch.winner_team_id === participantId) {
            const wins = matches.filter(m => m.winner_team_id === participantId).length;
            const losses = matches.filter(m => 
                (m.team1_id === participantId || m.team2_id === participantId) && 
                m.winner_team_id !== participantId && m.winner_team_id !== null
            ).length;
            
            return { place: 'Победитель', wins, losses };
        }

        // Проверяем матч за 3 место
        const thirdPlaceMatch = matches.find(m => m.bracket_type === 'placement');
        if (thirdPlaceMatch) {
            if (thirdPlaceMatch.winner_team_id === participantId) {
                const wins = matches.filter(m => m.winner_team_id === participantId).length;
                const losses = matches.filter(m => 
                    (m.team1_id === participantId || m.team2_id === participantId) && 
                    m.winner_team_id !== participantId && m.winner_team_id !== null
                ).length;
                
                return { place: '3 место', wins, losses };
            } else if (thirdPlaceMatch.team1_id === participantId || thirdPlaceMatch.team2_id === participantId) {
                const wins = matches.filter(m => m.winner_team_id === participantId).length;
                const losses = matches.filter(m => 
                    (m.team1_id === participantId || m.team2_id === participantId) && 
                    m.winner_team_id !== participantId && m.winner_team_id !== null
                ).length;
                
                return { place: '4 место', wins, losses };
            }
        }

        // Проверяем, дошел ли до финала (2 место)
        if (finalMatch && (finalMatch.team1_id === participantId || finalMatch.team2_id === participantId)) {
            const wins = matches.filter(m => m.winner_team_id === participantId).length;
            const losses = matches.filter(m => 
                (m.team1_id === participantId || m.team2_id === participantId) && 
                m.winner_team_id !== participantId && m.winner_team_id !== null
            ).length;
            
            return { place: '2 место', wins, losses };
        }

        // Определяем на какой стадии выбыл
        const playerMatches = matches.filter(m => 
            m.team1_id === participantId || m.team2_id === participantId
        ).sort((a, b) => (b.round || 0) - (a.round || 0));

        if (playerMatches.length > 0) {
            const lastMatch = playerMatches[0];
            const wins = matches.filter(m => m.winner_team_id === participantId).length;
            const losses = matches.filter(m => 
                (m.team1_id === participantId || m.team2_id === participantId) && 
                m.winner_team_id !== participantId && m.winner_team_id !== null
            ).length;

            // Определяем стадию выбывания
            const maxRound = Math.max(...matches.map(m => m.round || 0));
            const roundsFromEnd = maxRound - (lastMatch.round || 0);
            
            let stage;
            if (roundsFromEnd === 0) stage = 'Финалист';
            else if (roundsFromEnd === 1) stage = 'Полуфинал';
            else if (roundsFromEnd === 2) stage = '1/4 финала';
            else if (roundsFromEnd === 3) stage = '1/8 финала';
            else stage = `${roundsFromEnd + 1} раунд`;

            return { place: stage, wins, losses };
        }

        return { place: 'Участник', wins: 0, losses: 0 };
        
    } catch (err) {
        console.error('Ошибка определения результата турнира:', err);
        return null;
    }
}

// Получение истории матчей пользователя
router.get('/match-history', authenticateToken, async (req, res) => {
    try {
        // Упрощенный запрос для получения истории матчей
        const matchHistoryResult = await pool.query(`
            SELECT 
                m.id,
                t.completed_at as date,
                t.name as tournament_name,
                t.id as tournament_id,
                t.game as discipline,
                m.score1,
                m.score2,
                CASE 
                    WHEN m.winner_team_id = m.team1_id THEN 
                        CASE WHEN tp1.user_id = $1 OR EXISTS(
                            SELECT 1 FROM tournament_team_members ttm 
                            WHERE ttm.team_id = m.team1_id AND ttm.user_id = $1
                        ) THEN 'win' ELSE 'loss' END
                    WHEN m.winner_team_id = m.team2_id THEN 
                        CASE WHEN tp2.user_id = $1 OR EXISTS(
                            SELECT 1 FROM tournament_team_members ttm 
                            WHERE ttm.team_id = m.team2_id AND ttm.user_id = $1
                        ) THEN 'win' ELSE 'loss' END
                    ELSE 'unknown'
                END as result,
                COALESCE(
                    CASE WHEN tp1.user_id = $1 THEN COALESCE(tp2.name, tt2.name)
                         WHEN tp2.user_id = $1 THEN COALESCE(tp1.name, tt1.name)
                         ELSE 'Неизвестный соперник' END,
                    'Неизвестный соперник'
                ) as opponent,
                CONCAT(COALESCE(m.score1, 0), ':', COALESCE(m.score2, 0)) as score
            FROM matches m
            JOIN tournaments t ON m.tournament_id = t.id
            LEFT JOIN tournament_participants tp1 ON m.team1_id = tp1.id
            LEFT JOIN tournament_participants tp2 ON m.team2_id = tp2.id
            LEFT JOIN tournament_teams tt1 ON m.team1_id = tt1.id
            LEFT JOIN tournament_teams tt2 ON m.team2_id = tt2.id
            LEFT JOIN tournament_team_members ttm1 ON tt1.id = ttm1.team_id
            LEFT JOIN tournament_team_members ttm2 ON tt2.id = ttm2.team_id
            WHERE 
                (tp1.user_id = $1 OR tp2.user_id = $1 OR ttm1.user_id = $1 OR ttm2.user_id = $1)
                AND m.winner_team_id IS NOT NULL
            ORDER BY m.id DESC
            LIMIT 100
        `, [req.user.id]);

        res.json(matchHistoryResult.rows);
    } catch (err) {
        console.error('Ошибка получения истории матчей:', err);
        // Возвращаем пустой массив вместо ошибки для лучшего UX
        res.json([]);
    }
});

// Получение турниров пользователя
router.get('/tournaments', authenticateToken, async (req, res) => {
    try {
        console.log('📋 Загружаем турниры для пользователя:', req.user.id);
        
        // Получаем турниры где участвовал пользователь с результатами из user_tournament_stats
        const tournamentsQuery = `
            SELECT DISTINCT 
                t.*,
                uts.result as tournament_result,
                uts.wins,
                uts.losses,
                uts.is_team,
                uts.updated_at as stats_updated_at,
                CASE 
                    WHEN t.participant_type = 'solo' THEN 'solo'
                    WHEN t.participant_type = 'team' THEN 'team'
                    ELSE 'unknown'
                END as participation_type
            FROM tournaments t
            LEFT JOIN (
                -- Для соло турниров
                SELECT DISTINCT tp.tournament_id, tp.user_id
                FROM tournament_participants tp
                WHERE tp.user_id = $1
                UNION
                -- Для командных турниров 
                SELECT DISTINCT tt.tournament_id, ttm.user_id
                FROM tournament_teams tt
                JOIN tournament_team_members ttm ON tt.id = ttm.team_id
                WHERE ttm.user_id = $1
            ) user_participation ON t.id = user_participation.tournament_id
            LEFT JOIN user_tournament_stats uts ON (
                uts.tournament_id = t.id AND 
                uts.user_id = $1
            )
            WHERE user_participation.tournament_id IS NOT NULL
            ORDER BY t.start_date DESC
        `;
        
        const result = await pool.query(tournamentsQuery, [req.user.id]);
        
        console.log(`✅ Найдено ${result.rows.length} турниров для пользователя ${req.user.id}`);
        
        // Логируем для диагностики
        result.rows.forEach(tournament => {
            console.log(`🎯 Турнир "${tournament.name}" (${tournament.status}): результат = "${tournament.tournament_result || 'Не указан'}", обновлен: ${tournament.stats_updated_at || 'никогда'}`);
        });
        
        // Обрабатываем результаты для лучшего отображения
        const processedTournaments = result.rows.map(tournament => ({
            ...tournament,
            // Обеспечиваем правильное отображение результата
            tournament_result: tournament.tournament_result || (
                tournament.status === 'completed' ? 'Не указан' : 'В процессе'
            ),
            // Добавляем дополнительную информацию
            has_stats: !!tournament.tournament_result,
            stats_last_updated: tournament.stats_updated_at,
            win_rate: tournament.wins !== null && tournament.losses !== null 
                ? tournament.wins + tournament.losses > 0 
                    ? Math.round((tournament.wins / (tournament.wins + tournament.losses)) * 100)
                    : 0
                : null
        }));
        
        res.json(processedTournaments);
    } catch (err) {
        console.error('❌ Ошибка получения турниров пользователя:', err);
        res.status(500).json({ 
            error: 'Ошибка загрузки турниров',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
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
        
        // Отправляем код по электронной почте (централизованный сервис)
        const { sendEmailVerificationCode } = require('../services/emailService');
        const sendResult = await sendEmailVerificationCode(email, req.user.username, verificationCode);

        if (!sendResult.success) {
            console.error('❌ Ошибка отправки письма с кодом:', sendResult.error);
            return res.status(502).json({ error: 'Сервис почты недоступен. Попробуйте позже.' });
        }

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
        
        // Отправляем письмо об успешном подтверждении (от единого отправителя)
        const { transporter: mailer } = require('../services/emailService');
        const successMailOptions = {
            from: {
                name: '1337 Community',
                address: process.env.SMTP_USER || 'noreply@1337community.com'
            },
            to: email,
            subject: 'Email успешно подтвержден — 1337 Community',
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; max-width: 600px; margin: 0 auto; background:#000; color:#fff; border:2px solid #ff0000; border-radius:12px;">
                    <div style="padding:24px; text-align:center;">
                        <h2 style="margin:0 0 8px 0;">Ваш email подтвержден</h2>
                        <p style="margin:0; color:#bbb">Добро пожаловать, ${username}!</p>
                    </div>
                    <div style="padding:0 24px 24px 24px; color:#ccc;">
                        Теперь доступны все функции платформы, включая создание и администрирование турниров.
                    </div>
                </div>
            `.trim()
        };

        await mailer.sendMail(successMailOptions);
        
        res.json({ message: 'Email успешно подтвержден' });
    } catch (err) {
        console.error('Ошибка подтверждения email:', err);
        res.status(500).json({ error: 'Не удалось подтвердить email' });
    }
});

// Маршрут для перенаправления пользователя на страницу авторизации Faceit для привязки аккаунта
router.get('/link-faceit', async (req, res) => {
    try {
        const { token } = req.query;
        
        if (!token) {
            return res.status(401).json({ error: 'Токен не предоставлен' });
        }

        // Проверяем и декодируем токен
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            console.error('Ошибка проверки токена:', err);
            return res.status(401).json({ error: 'Недействительный токен' });
        }

        const clientId = process.env.FACEIT_CLIENT_ID;
        const redirectUri = process.env.FACEIT_REDIRECT_URI;

        if (!clientId || !redirectUri) {
            console.error('Отсутствуют переменные окружения FACEIT');
            return res.status(500).json({ error: 'Конфигурация FACEIT не настроена' });
        }

        // Генерация code_verifier и вычисление code_challenge (S256)
        const codeVerifier = crypto.randomBytes(32).toString('hex');
        const hash = crypto.createHash('sha256').update(codeVerifier).digest();
        const codeChallenge = hash.toString('base64')
          .replace(/\+/g, '-')  // URL-safe
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        // Генерируем state-параметр, включающий userId
        const randomPart = crypto.randomBytes(8).toString('hex');
        const state = `${randomPart}-${decoded.id}`;

        console.log('Устанавливаем куки для FACEIT привязки:');
        console.log('code_verifier:', codeVerifier.substring(0, 10) + '...');
        console.log('state:', state);
        console.log('userId:', decoded.id);

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
    } catch (err) {
        console.error('Ошибка в link-faceit:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
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
                    { expiresIn: '168h' }
                );
                console.log('Existing user found, redirecting with token:', token);
                return res.redirect(`https://1337community.com/auth-callback?token=${token}`);
            } else {
                // Если пользователь не существует, создаем новый аккаунт
                console.log('Creating new user with FACEIT profile:', faceitNickname);
                
                // Получаем ELO пользователя из FACEIT API
                let faceitElo = 0;
                try {
                    const playerResponse = await axios.get(`https://open.faceit.com/data/v4/players/${faceitId}`, {
                        headers: {
                            'Authorization': `Bearer ${process.env.FACEIT_API_KEY}`
                        }
                    });
                    faceitElo = playerResponse.data.games?.cs2?.faceit_elo || playerResponse.data.games?.csgo?.faceit_elo || 0;
                } catch (apiErr) {
                    console.error('Ошибка получения ELO из FACEIT API:', apiErr);
                }
                
                const newUserResult = await pool.query(
                    'INSERT INTO users (username, faceit_id, faceit_elo) VALUES ($1, $2, $3) RETURNING id, username, role',
                    [faceitNickname, faceitId, faceitElo]
                );
                
                const newUser = newUserResult.rows[0];
                
                // Создаем JWT для нового пользователя
                const token = jwt.sign(
                    { id: newUser.id, role: newUser.role, username: newUser.username },
                    process.env.JWT_SECRET,
                    { expiresIn: '168h' }
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
            
            // Получаем ELO пользователя из FACEIT API
            let faceitElo = 0;
            try {
                const playerResponse = await axios.get(`https://open.faceit.com/data/v4/players/${faceitId}`, {
                    headers: {
                        'Authorization': `Bearer ${process.env.FACEIT_API_KEY}`
                    }
                });
                faceitElo = playerResponse.data.games?.cs2?.faceit_elo || playerResponse.data.games?.csgo?.faceit_elo || 0;
            } catch (apiErr) {
                console.error('Ошибка получения ELO из FACEIT API:', apiErr);
            }
            
            // Обновляем faceit_id и faceit_elo для пользователя в базе данных
            await pool.query('UPDATE users SET faceit_id = $1, faceit_elo = $2 WHERE id = $3', [faceitId, faceitElo, userId]);
            console.log(`FACEit профиль успешно привязан для пользователя ${userId} с ELO ${faceitElo}`);
            
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

// Загрузка аватара
router.post('/upload-avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' });
        }

        // Определяем базовый URL динамически (используем SERVER_URL в продакшене)
        const baseUrl = process.env.NODE_ENV === 'production'
            ? process.env.SERVER_URL || 'https://1337community.com'
            : `https://${req.get('host')}`;
        const relativePath = `/uploads/avatars/${req.file.filename}`;
        const avatar_url = `${baseUrl}${relativePath}`;

        // Обновляем аватар пользователя в базе данных
        await pool.query(
            'UPDATE users SET avatar_url = $1 WHERE id = $2',
            [avatar_url, req.user.id]
        );

        res.json({ 
            message: 'Аватар успешно загружен',
            avatar_url: avatar_url
        });
    } catch (err) {
        console.error('Ошибка загрузки аватара:', err);
        res.status(500).json({ error: 'Не удалось загрузить аватар' });
    }
});

// Установка аватара из Steam
router.post('/set-steam-avatar', authenticateToken, async (req, res) => {
    try {
        // Получаем Steam ID пользователя
        const userResult = await pool.query(
            'SELECT steam_id FROM users WHERE id = $1',
            [req.user.id]
        );
        
        const steamId = userResult.rows[0].steam_id;
        
        if (!steamId) {
            return res.status(400).json({ error: 'Steam не привязан к аккаунту' });
        }
        
        // Получаем аватар из Steam API
        const apiKey = process.env.STEAM_API_KEY;
        const steamUserResponse = await axios.get(
            `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`
        );
        
        // Получаем URL аватара
        const steamAvatarUrl = steamUserResponse.data.response.players[0].avatarfull;
        
        if (!steamAvatarUrl) {
            return res.status(404).json({ error: 'Аватар Steam не найден' });
        }
        
        // Обновляем аватар пользователя в базе данных
        await pool.query(
            'UPDATE users SET avatar_url = $1 WHERE id = $2',
            [steamAvatarUrl, req.user.id]
        );
        
        res.json({ 
            message: 'Аватар из Steam успешно установлен',
            avatar_url: steamAvatarUrl
        });
    } catch (err) {
        console.error('Ошибка установки аватара из Steam:', err);
        res.status(500).json({ error: 'Не удалось установить аватар из Steam' });
    }
});

// Установка аватара из FACEIT
router.post('/set-faceit-avatar', authenticateToken, async (req, res) => {
    try {
        // Получаем FACEIT ID пользователя
        const userResult = await pool.query(
            'SELECT faceit_id FROM users WHERE id = $1',
            [req.user.id]
        );
        
        const faceitId = userResult.rows[0].faceit_id;
        
        if (!faceitId) {
            return res.status(400).json({ error: 'FACEIT не привязан к аккаунту' });
        }
        
        // Используем FACEIT API для получения данных пользователя
        const playerResponse = await axios.get(`https://open.faceit.com/data/v4/players/${faceitId}`, {
            headers: {
                'Authorization': `Bearer ${process.env.FACEIT_API_KEY}`
            }
        });
        
        // Получаем URL аватара из ответа API
        const faceitAvatarUrl = playerResponse.data.avatar || null;
        
        if (!faceitAvatarUrl) {
            return res.status(404).json({ error: 'Аватар FACEIT не найден' });
        }
        
        // Обновляем аватар пользователя в базе данных
        await pool.query(
            'UPDATE users SET avatar_url = $1 WHERE id = $2',
            [faceitAvatarUrl, req.user.id]
        );
        
        res.json({ 
            message: 'Аватар из FACEIT успешно установлен',
            avatar_url: faceitAvatarUrl
        });
    } catch (err) {
        console.error('Ошибка установки аватара из FACEIT:', err);
        res.status(500).json({ error: 'Не удалось установить аватар из FACEIT' });
    }
});

// Публичный список предзагруженных аватарок (для формы выбора в профиле)
router.get('/preloaded-avatars', async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const dir = path.join(__dirname, '../uploads/avatars/preloaded');
        if (!fs.existsSync(dir)) return res.json({ avatars: [] });
        const files = fs.readdirSync(dir).filter(f => /\.(png|jpe?g|webp)$/i.test(f));
        const metaPath = path.join(dir, 'meta.json');
        let categories = {};
        try {
            if (fs.existsSync(metaPath)) {
                const raw = fs.readFileSync(metaPath, 'utf8');
                const json = JSON.parse(raw);
                if (json && typeof json === 'object' && json.categories && typeof json.categories === 'object') {
                    categories = json.categories;
                }
            }
        } catch (_) {}
        // Возвращаем относительные URL и категорию (по умолчанию standard)
        const list = files.map(name => ({
            filename: name,
            url: `/uploads/avatars/preloaded/${name}`,
            category: categories[name] || 'standard'
        }));
        res.json({ avatars: list });
    } catch (e) {
        console.error('Ошибка получения предзагруженных аватарок:', e);
        res.status(500).json({ avatars: [] });
    }
});

// Установка аватарки из предзагруженных
router.post('/set-preloaded-avatar', authenticateToken, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Некорректный URL' });
        // Принимаем относительный путь или полный URL. Сохраняем относительный для стабильности.
        let stored = url;
        try {
            if (url.startsWith('http://') || url.startsWith('https://')) {
                const u = new URL(url);
                stored = u.pathname + (u.search || '');
            }
        } catch (_) {
            // если new URL упал, оставим как есть (если относительный — ок)
        }
        if (!stored.startsWith('/uploads/avatars/preloaded/')) {
            return res.status(400).json({ error: 'Недопустимый путь к аватару' });
        }
        await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [stored, req.user.id]);
        return res.json({ success: true, avatar_url: stored });
    } catch (e) {
        console.error('Ошибка установки предзагруженной аватарки:', e);
        return res.status(500).json({ error: 'Не удалось установить аватар' });
    }
});

// Получение публичного профиля пользователя по ID
router.get('/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        console.log(`🔍 Запрос профиля пользователя ID: ${userId}`);
        
        // Получаем базовую информацию о пользователе (используем только основные поля)
        const userResult = await pool.query(
            'SELECT id, username, steam_id, faceit_id, steam_url, avatar_url, cs2_premier_rank, created_at FROM users WHERE id = $1',
            [userId]
        );
        
        console.log(`📊 Результат запроса для пользователя ${userId}:`, {
            found: userResult.rows.length > 0,
            rowCount: userResult.rows.length
        });
        
        if (userResult.rows.length === 0) {
            console.log(`❌ Пользователь с ID ${userId} не найден в базе данных`);
            return res.status(404).json({ message: 'Пользователь не найден' });
        }
        
        const user = userResult.rows[0];
        console.log(`✅ Пользователь найден: ${user.username} (ID: ${user.id})`);
        
        // Устанавливаем статус онлайн по умолчанию
        user.online_status = 'offline';
        
        // Получаем соединения WebSocket для проверки онлайн-статуса в реальном времени
        const app = global.app || req.app;
        const connectedClients = app.get('connectedClients');
        
        // Проверяем, есть ли у пользователя активное WebSocket соединение
        if (connectedClients && connectedClients.has(userId.toString())) {
            const ws = connectedClients.get(userId.toString());
            if (ws && ws.readyState === 1) { // 1 = WebSocket.OPEN
                user.online_status = 'online';
            }
        }
        
        // Если у пользователя привязан Steam, получаем его никнейм (с кэшированием)
        if (user.steam_id) {
            try {
                // Проверяем кэш никнейма в базе данных (если он был обновлен недавно)
                const steamCacheResult = await pool.query(
                    'SELECT steam_nickname, steam_nickname_updated FROM users WHERE id = $1 AND steam_nickname_updated > NOW() - INTERVAL \'1 hour\'',
                    [userId]
                );
                
                if (steamCacheResult.rows.length > 0 && steamCacheResult.rows[0].steam_nickname) {
                    // Используем кэшированный никнейм
                    user.steam_nickname = steamCacheResult.rows[0].steam_nickname;
                } else {
                    // Кэш устарел или отсутствует, запрашиваем у Steam API
                    const apiKey = process.env.STEAM_API_KEY;
                    if (apiKey) {
                        const steamUserResponse = await axios.get(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${user.steam_id}`, {
                            timeout: 5000 // Таймаут 5 секунд
                        });
                        
                        if (steamUserResponse.data.response.players.length > 0) {
                            const steamNickname = steamUserResponse.data.response.players[0].personaname;
                            user.steam_nickname = steamNickname;
                            
                            // Сохраняем в кэш
                            await pool.query(
                                'UPDATE users SET steam_nickname = $1, steam_nickname_updated = NOW() WHERE id = $2',
                                [steamNickname, userId]
                            );
                        }
                    }
                }
            } catch (steamErr) {
                console.error('Ошибка получения никнейма Steam:', steamErr.message);
                // Если не удалось получить никнейм, используем кэшированный или оставляем пустым
                const fallbackResult = await pool.query('SELECT steam_nickname FROM users WHERE id = $1', [userId]);
                if (fallbackResult.rows.length > 0 && fallbackResult.rows[0].steam_nickname) {
                    user.steam_nickname = fallbackResult.rows[0].steam_nickname;
                }
            }
        }
        
        // Получаем статистику пользователя
        const statsResult = await pool.query(
            'SELECT t.name, t.game, uts.result, uts.wins, uts.losses, uts.is_team ' +
            'FROM user_tournament_stats uts ' +
            'JOIN tournaments t ON uts.tournament_id = t.id ' +
            'WHERE uts.user_id = $1',
            [userId]
        );

        const stats = statsResult.rows;
        const soloStats = stats.filter(s => !s.is_team);
        const teamStats = stats.filter(s => s.is_team);

        const soloWins = soloStats.reduce((sum, s) => sum + (s.wins || 0), 0);
        const soloLosses = soloStats.reduce((sum, s) => sum + (s.losses || 0), 0);
        const teamWins = teamStats.reduce((sum, s) => sum + (s.wins || 0), 0);
        const teamLosses = teamStats.reduce((sum, s) => sum + (s.losses || 0), 0);

        const soloWinRate = soloWins + soloLosses > 0 ? (soloWins / (soloWins + soloLosses)) * 100 : 0;
        const teamWinRate = teamWins + teamLosses > 0 ? (teamWins / (teamWins + teamLosses)) * 100 : 0;
        
        // Добавляем статистику к данным пользователя
        user.stats = {
            tournaments: stats,
            solo: { wins: soloWins, losses: soloLosses, winRate: soloWinRate.toFixed(2) },
            team: { wins: teamWins, losses: teamLosses, winRate: teamWinRate.toFixed(2) }
        };
        
        // Если у пользователя привязан Faceit, получаем информацию о нем
        if (user.faceit_id) {
            try {
                // Используем FACEIT API для получения данных пользователя
                const playerResponse = await axios.get(`https://open.faceit.com/data/v4/players/${user.faceit_id}`, {
                    headers: {
                        'Authorization': `Bearer ${process.env.FACEIT_API_KEY}`
                    }
                });
                
                const faceitNickname = playerResponse.data.nickname;
                const faceitUrl = `https://www.faceit.com/ru/players/${faceitNickname}`;
                const faceitElo = playerResponse.data.games?.cs2?.faceit_elo || playerResponse.data.games?.csgo?.faceit_elo || 0;
                const faceitLevel = playerResponse.data.games?.cs2?.skill_level || playerResponse.data.games?.csgo?.skill_level || 0;
                
                user.faceit = {
                    faceitNickname,
                    faceitUrl,
                    elo: faceitElo,
                    level: faceitLevel
                };
                
                // Пробуем получить статистику CS2 или CSGO
                try {
                    const statsResponse = await axios.get(`https://open.faceit.com/data/v4/players/${user.faceit_id}/stats/cs2`, {
                        headers: {
                            'Authorization': `Bearer ${process.env.FACEIT_API_KEY}`
                        }
                    });
                    
                    if (statsResponse.data && statsResponse.data.lifetime) {
                        user.faceit.stats = statsResponse.data.lifetime;
                        user.faceit.statsFrom = 'cs2';
                    }
                } catch (cs2Err) {
                    try {
                        const statsResponse = await axios.get(`https://open.faceit.com/data/v4/players/${user.faceit_id}/stats/csgo`, {
                            headers: {
                                'Authorization': `Bearer ${process.env.FACEIT_API_KEY}`
                            }
                        });
                        
                        if (statsResponse.data && statsResponse.data.lifetime) {
                            user.faceit.stats = statsResponse.data.lifetime;
                            user.faceit.statsFrom = 'csgo';
                        }
                    } catch (csgoErr) {
                        // Если обе попытки не удались, продолжаем без статистики
                        console.log('Ни CS2, ни CSGO статистика не найдены для пользователя', userId);
                    }
                }
            } catch (faceitErr) {
                console.error('Ошибка получения информации Faceit:', faceitErr.message);
                // Продолжаем без данных Faceit
            }
        }
        
        // Если у пользователя привязан Steam и есть Premier ранг, добавляем его к ответу
        if (user.steam_id && user.cs2_premier_rank) {
            user.premier_rank = user.cs2_premier_rank;
        }

        // Получаем список друзей пользователя (только принятые заявки)
        const friendsResult = await pool.query(`
            SELECT f.id, f.status,
                u.id as friend_id, u.username, u.avatar_url
            FROM friends f
            JOIN users u ON (
                CASE
                    WHEN f.user_id = $1 THEN f.friend_id
                    WHEN f.friend_id = $1 THEN f.user_id
                END
            ) = u.id
            WHERE (f.user_id = $1 OR f.friend_id = $1)
            AND f.status = 'accepted'
            LIMIT 10
        `, [userId]);

        // Форматируем список друзей и добавляем к ответу
        if (friendsResult.rows.length > 0) {
            user.friends = friendsResult.rows.map(row => ({
                id: row.friend_id,
                username: row.username,
                avatar_url: row.avatar_url
            }));
        }
        
        // Удаляем не нужные для публичного профиля поля
        delete user.cs2_premier_rank;
        
        console.log(`✅ Профиль пользователя ${userId} успешно сформирован`);
        res.json(user);
    } catch (err) {
        console.error('❌ Ошибка получения профиля пользователя:', err);
        res.status(500).json({ error: 'Ошибка сервера при получении профиля' });
    }
});

// Функция для получения правильного склонения слова "минута"
function getMinutesWord(minutes) {
    if (minutes >= 11 && minutes <= 14) {
        return 'минут';
    }
    
    const lastDigit = minutes % 10;
    if (lastDigit === 1) {
        return 'минуту';
    } else if (lastDigit >= 2 && lastDigit <= 4) {
        return 'минуты';
    } else {
        return 'минут';
    }
}

// Функция для получения правильного склонения слова "час"
function getHoursWord(hours) {
    if (hours >= 11 && hours <= 14) {
        return 'часов';
    }
    
    const lastDigit = hours % 10;
    if (lastDigit === 1) {
        return 'час';
    } else if (lastDigit >= 2 && lastDigit <= 4) {
        return 'часа';
    } else {
        return 'часов';
    }
}

// Функция для получения правильного склонения слова "день"
function getDaysWord(days) {
    if (days >= 11 && days <= 14) {
        return 'дней';
    }
    
    const lastDigit = days % 10;
    if (lastDigit === 1) {
        return 'день';
    } else if (lastDigit >= 2 && lastDigit <= 4) {
        return 'дня';
    } else {
        return 'дней';
    }
}

// Поиск пользователей по никнейму
router.get('/search', authenticateToken, async (req, res) => {
    // Совместимость: поддерживаем и query, и q
    const query = (req.query.query ?? req.query.q ?? '').toString();
    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 20) : 10;
    
    console.log('🔍 [Backend] ПОИСК ПОЛЬЗОВАТЕЛЕЙ - ЗАПРОС ПОЛУЧЕН');
    console.log('🔍 [Backend] Параметры запроса:', { query });
    console.log('🔍 [Backend] Пользователь:', { id: req.user?.id, username: req.user?.username });
    
    if (!query || query.length < 2) {
        console.log('🔍 [Backend] Запрос слишком короткий');
        return res.status(400).json({ error: 'Минимальная длина запроса - 2 символа' });
    }

    try {
        console.log('🔍 [Backend] Выполняем SQL запрос с паттерном:', `%${query}%`, 'limit:', limit);
        const likePattern = `%${query}%`;
        // Быстрый и релевантный поиск с pg_trgm (ORDER BY similarity)
        const result = await pool.query(
            `SELECT id, username, avatar_url, faceit_elo, cs2_premier_rank, steam_id
             FROM users
             WHERE username ILIKE $1 OR email ILIKE $1
             ORDER BY GREATEST(similarity(username, $2), similarity(email, $2)) DESC
             LIMIT $3`,
            [likePattern, query, limit]
        );
        
        console.log('🔍 [Backend] SQL запрос выполнен успешно');
        console.log('🔍 [Backend] Найдено пользователей:', result.rows.length);
        console.log('🔍 [Backend] Результаты:', result.rows.map(user => ({ id: user.id, username: user.username })));
        
        res.json(result.rows);
    } catch (err) {
        console.error('🔍 [Backend] Ошибка при поиске пользователей:', err);
        res.status(500).json({ error: 'Ошибка сервера при поиске пользователей' });
    }
});

// Получение статуса онлайн пользователя
router.get('/:id/status', authenticateToken, async (req, res) => {
    const userId = req.params.id;
    
    try {
        // Получаем last_activity_at из таблицы users
        const result = await pool.query(
            'SELECT last_activity_at FROM users WHERE id = $1',
            [userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        const lastActivity = result.rows[0].last_activity_at;
        
        // Проверяем, существует ли значение last_activity_at
        if (!lastActivity) {
            // Если значение отсутствует, просто возвращаем статус оффлайн
            return res.json({
                online: false,
                last_online: null
            });
        }
        
        try {
            // Преобразуем дату в объект Date и вычисляем разницу
            const lastActivityDate = new Date(lastActivity);
            // Считаем пользователя онлайн, если его последняя активность была не более 15 минут назад
            const isOnline = (Date.now() - lastActivityDate.getTime()) < 15 * 60 * 1000;
            
            res.json({
                online: isOnline,
                last_online: lastActivity
            });
        } catch (dateError) {
            console.error('Ошибка обработки даты для пользователя', userId, ':', dateError);
            // В случае ошибки обработки даты возвращаем оффлайн
            res.json({
                online: false,
                last_online: null
            });
        }
    } catch (err) {
        console.error('Ошибка получения статуса пользователя:', err);
        // Возвращаем простой ответ вместо ошибки
        res.json({
            online: false,
            last_online: null
        });
    }
});

// Эндпоинт для подачи заявки на создание аккаунта организации
router.post('/create-organization-request', authenticateToken, upload.single('logo'), async (req, res) => {
    const { organizationName, description, websiteUrl, vkUrl, telegramUrl } = req.body;
    
    // Проверка обязательных полей
    if (!organizationName || !description) {
        return res.status(400).json({ error: 'Название организации и описание обязательны' });
    }
    
    try {
        // Проверяем, что у пользователя есть подтвержденный email
        const userResult = await pool.query('SELECT username, email, is_verified FROM users WHERE id = $1', [req.user.id]);
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        const user = userResult.rows[0];
        
        if (!user.email) {
            return res.status(400).json({ error: 'Для подачи заявки необходимо привязать email' });
        }
        
        if (!user.is_verified) {
            return res.status(400).json({ error: 'Для подачи заявки необходимо подтвердить email' });
        }
        
        // Проверяем, есть ли уже активная заявка от этого пользователя
        const existingRequestResult = await pool.query(
            'SELECT id FROM organization_requests WHERE user_id = $1 AND status = $2',
            [req.user.id, 'pending']
        );
        
        if (existingRequestResult.rows.length > 0) {
            return res.status(400).json({ error: 'У вас уже есть активная заявка на рассмотрении' });
        }
        
        // Обработка загруженного логотипа
        let logoUrl = null;
        if (req.file) {
            const baseUrl = process.env.NODE_ENV === 'production'
                ? process.env.SERVER_URL || 'https://1337community.com'
                : `http://localhost:3000`;
            logoUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;
        }
        
        // Сохраняем заявку в базу данных
        const requestResult = await pool.query(`
            INSERT INTO organization_requests (
                user_id, organization_name, description, website_url, 
                vk_url, telegram_url, logo_url, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
            RETURNING *
        `, [
            req.user.id,
            organizationName,
            description,
            websiteUrl || null,
            vkUrl || null,
            telegramUrl || null,
            logoUrl
        ]);
        
        const request = requestResult.rows[0];
        
        // Отправляем уведомления администраторам
        try {
            // Создаем дату в читаемом формате
            const requestDate = new Date(request.created_at).toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            // Определяем базовый URL для админ панели
            const baseUrl = process.env.CLIENT_URL || 'https://1337community.com';

            // HTML шаблон письма для администраторов
            const adminMailOptions = {
                from: process.env.SMTP_FROM,
                to: 'nikita_gorenkov@mail.ru, Try.conn@yandex.ru',
                subject: 'Новая заявка на создание организации - 1337Community',
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 0;">
                        <div style="background-color: #ffffff; border: 1px solid #e0e0e0;">
                            <!-- Header -->
                            <div style="background-color: #000000; color: #ffffff; padding: 20px; text-align: center;">
                                <h1 style="margin: 0; font-size: 24px; font-weight: 300;">1337 COMMUNITY</h1>
                                <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">Новая заявка на организацию</p>
                            </div>
                            
                            <!-- Content -->
                            <div style="padding: 30px;">
                                <h2 style="color: #000000; margin: 0 0 25px 0; font-size: 20px; font-weight: 400; border-bottom: 1px solid #e0e0e0; padding-bottom: 10px;">
                                    Информация о заявке
                                </h2>
                                
                                <!-- Applicant Info -->
                                <div style="margin-bottom: 25px;">
                                    <h3 style="color: #333333; margin: 0 0 15px 0; font-size: 16px; font-weight: 500;">Заявитель</h3>
                                    <table style="width: 100%; border-collapse: collapse;">
                                        <tr>
                                            <td style="padding: 8px 0; color: #666666; width: 120px; font-size: 14px;">Никнейм:</td>
                                            <td style="padding: 8px 0; color: #000000; font-size: 14px; font-weight: 500;">${user.username}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px 0; color: #666666; width: 120px; font-size: 14px;">Email:</td>
                                            <td style="padding: 8px 0; color: #000000; font-size: 14px;">${user.email}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px 0; color: #666666; width: 120px; font-size: 14px;">Дата подачи:</td>
                                            <td style="padding: 8px 0; color: #000000; font-size: 14px;">${requestDate}</td>
                                        </tr>
                                    </table>
                                </div>
                                
                                <!-- Organization Info -->
                                <div style="margin-bottom: 25px;">
                                    <h3 style="color: #333333; margin: 0 0 15px 0; font-size: 16px; font-weight: 500;">Организация</h3>
                                    <table style="width: 100%; border-collapse: collapse;">
                                        <tr>
                                            <td style="padding: 8px 0; color: #666666; width: 120px; font-size: 14px; vertical-align: top;">Название:</td>
                                            <td style="padding: 8px 0; color: #000000; font-size: 14px; font-weight: 500;">${organizationName}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px 0; color: #666666; width: 120px; font-size: 14px; vertical-align: top;">Описание:</td>
                                            <td style="padding: 8px 0; color: #000000; font-size: 14px; line-height: 1.4;">
                                                <div style="background-color: #f8f8f8; padding: 12px; border-left: 3px solid #000000; font-style: italic;">
                                                    ${description}
                                                </div>
                                            </td>
                                        </tr>
                                        ${websiteUrl ? `
                                        <tr>
                                            <td style="padding: 8px 0; color: #666666; width: 120px; font-size: 14px;">Веб-сайт:</td>
                                            <td style="padding: 8px 0; font-size: 14px;"><a href="${websiteUrl}" target="_blank" style="color: #000000; text-decoration: underline;">${websiteUrl}</a></td>
                                        </tr>` : ''}
                                        ${vkUrl ? `
                                        <tr>
                                            <td style="padding: 8px 0; color: #666666; width: 120px; font-size: 14px;">VK:</td>
                                            <td style="padding: 8px 0; font-size: 14px;"><a href="${vkUrl}" target="_blank" style="color: #000000; text-decoration: underline;">${vkUrl}</a></td>
                                        </tr>` : ''}
                                        ${telegramUrl ? `
                                        <tr>
                                            <td style="padding: 8px 0; color: #666666; width: 120px; font-size: 14px;">Telegram:</td>
                                            <td style="padding: 8px 0; font-size: 14px;"><a href="${telegramUrl}" target="_blank" style="color: #000000; text-decoration: underline;">${telegramUrl}</a></td>
                                        </tr>` : ''}
                                        ${logoUrl ? `
                                        <tr>
                                            <td style="padding: 8px 0; color: #666666; width: 120px; font-size: 14px;">Логотип:</td>
                                            <td style="padding: 8px 0; font-size: 14px;"><a href="${logoUrl}" target="_blank" style="color: #000000; text-decoration: underline;">Посмотреть логотип</a></td>
                                        </tr>` : ''}
                                    </table>
                                </div>
                                
                                <!-- Action Button -->
                                <div style="text-align: center; margin: 30px 0; padding: 20px 0; border-top: 1px solid #e0e0e0; border-bottom: 1px solid #e0e0e0;">
                                    <p style="margin: 0 0 15px 0; color: #333333; font-size: 14px;">Заявка ожидает рассмотрения</p>
                                    <a href="https://1337community.com/admin" 
                                       style="display: inline-block; background-color: #000000; color: #ffffff; padding: 12px 30px; text-decoration: none; font-size: 14px; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase;">
                                        Админ панель
                                    </a>
                                </div>
                            </div>
                            
                            <!-- Footer -->
                            <div style="background-color: #f8f8f8; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
                                <p style="margin: 0 0 5px 0; color: #666666; font-size: 12px;">1337 Community • Автоматическое уведомление</p>
                                <p style="margin: 0; color: #999999; font-size: 11px;">
                                    ID заявки: #${request.id} | ${new Date().toLocaleString('ru-RU')}
                                </p>
                            </div>
                        </div>
                    </div>
                `
            };

            // Отправляем письмо администраторам
            await transporter.sendMail(adminMailOptions);
            console.log('✅ Уведомление администраторам о новой заявке на организацию отправлено');
            
        } catch (emailErr) {
            console.error('❌ Ошибка отправки уведомления администраторам:', emailErr);
            // Не прерываем выполнение, если email не отправился
        }
        
        res.json({ 
            message: 'Заявка на создание аккаунта организации успешно отправлена! Администрация рассмотрит её в течение 1-3 рабочих дней.',
            requestId: request.id,
            organizationName: organizationName
        });
        
    } catch (err) {
        console.error('Ошибка при отправке заявки на организацию:', err);
        res.status(500).json({ error: 'Не удалось отправить заявку' });
    }
});

// Получение статуса заявки на организацию пользователя
router.get('/organization-request-status', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM organization_requests 
            WHERE user_id = $1 
            ORDER BY created_at DESC 
            LIMIT 1
        `, [req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Заявка не найдена' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Ошибка получения статуса заявки:', err);
        res.status(500).json({ error: 'Не удалось получить статус заявки' });
    }
});

// Запрос на восстановление пароля
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email обязателен' });
    }

    try {
        // Проверяем, существует ли пользователь с таким email
        const userResult = await pool.query('SELECT id, username, email FROM users WHERE email = $1', [email]);
        
        if (userResult.rows.length === 0) {
            // Не сообщаем, что email не найден из соображений безопасности
            return res.json({ message: 'Если аккаунт с таким email существует, на него будет отправлено письмо с инструкциями по восстановлению пароля' });
        }

        const user = userResult.rows[0];
        
        // Генерируем токен для сброса пароля
        const resetToken = crypto.randomBytes(32).toString('hex');
        
        // Сохраняем токен в базе данных со временем истечения (1 час)
        await pool.query(
            'UPDATE users SET password_reset_token = $1, password_reset_expires = NOW() + INTERVAL \'1 hour\' WHERE id = $2',
            [resetToken, user.id]
        );
        
        // Формируем ссылку для сброса пароля
        const baseUrl = process.env.CLIENT_URL || 'https://1337community.com';
        const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
        
        // Отправляем письмо с ссылкой для сброса пароля
        const mailOptions = {
            from: process.env.SMTP_FROM,
            to: email,
            subject: 'Восстановление пароля - 1337 Community',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Восстановление пароля</h2>
                    <p>Здравствуйте, ${user.username}!</p>
                    <p>Вы запросили восстановление пароля для вашего аккаунта на 1337 Community.</p>
                    <p>Для установки нового пароля перейдите по ссылке ниже:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" 
                           style="display: inline-block; background-color: #000000; color: #ffffff; padding: 12px 30px; text-decoration: none; font-size: 14px; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase;">
                            Восстановить пароль
                        </a>
                    </div>
                    <p>Ссылка действительна в течение 1 часа.</p>
                    <p>Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо.</p>
                    <div style="background-color: #f8f8f8; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
                        <p style="margin: 0 0 5px 0; color: #666666; font-size: 12px;">1337 Community • Автоматическое уведомление</p>
                        <p style="margin: 0; color: #999999; font-size: 11px;">
                            ${new Date().toLocaleString('ru-RU')}
                        </p>
                    </div>
                </div>
            `
        };
        
        await transporter.sendMail(mailOptions);
        
        res.json({ message: 'Если аккаунт с таким email существует, на него будет отправлено письмо с инструкциями по восстановлению пароля' });
        
    } catch (err) {
        console.error('Ошибка запроса восстановления пароля:', err);
        res.status(500).json({ error: 'Не удалось отправить письмо для восстановления пароля' });
    }
});

// Сброс пароля по токену
router.post('/reset-password', async (req, res) => {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password || !confirmPassword) {
        return res.status(400).json({ message: 'Все поля обязательны для заполнения' });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Пароли не совпадают' });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: 'Пароль должен содержать минимум 6 символов' });
    }

    try {
        // Ищем пользователя по токену и проверяем срок действия
        const userResult = await pool.query(
            'SELECT id, username, email FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()',
            [token]
        );

        if (userResult.rows.length === 0) {
            return res.status(400).json({ message: 'Недействительный или истекший токен' });
        }

        const user = userResult.rows[0];

        // Хешируем новый пароль
        const hashedPassword = await bcrypt.hash(password, 10);

        // Обновляем пароль и очищаем токен сброса
        await pool.query(
            'UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $2',
            [hashedPassword, user.id]
        );

        // Отправляем уведомление об успешном изменении пароля
        const successMailOptions = {
            from: process.env.SMTP_FROM,
            to: user.email,
            subject: 'Пароль успешно изменен - 1337 Community',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Пароль изменен</h2>
                    <p>Здравствуйте, ${user.username}!</p>
                    <p>Ваш пароль был успешно изменен.</p>
                    <p>Если это были не вы, немедленно обратитесь к администрации сайта.</p>
                    <div style="background-color: #f0f8ff; padding: 15px; margin: 20px 0; border-left: 4px solid #4682b4;">
                        <p style="margin: 0;">Теперь вы можете войти в аккаунт с новым паролем.</p>
                    </div>
                    <div style="background-color: #f8f8f8; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
                        <p style="margin: 0 0 5px 0; color: #666666; font-size: 12px;">1337 Community • Автоматическое уведомление</p>
                        <p style="margin: 0; color: #999999; font-size: 11px;">
                            ${new Date().toLocaleString('ru-RU')}
                        </p>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(successMailOptions);

        res.json({ message: 'Пароль успешно изменен' });

    } catch (err) {
        console.error('Ошибка сброса пароля:', err);
        res.status(500).json({ error: 'Не удалось изменить пароль' });
    }
});

module.exports = router;