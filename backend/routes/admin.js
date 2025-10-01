const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
// Проверка роли администратора (локальная)
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Доступ запрещен. Требуются права администратора' });
    }
    next();
}

// Обновление готовности/присутствия игрока (heartbeat + локальный ready)
router.post('/match-lobby/:lobbyId/presence', authenticateToken, async (req, res) => {
    await ensureAdminLobbyTables();
    const { lobbyId } = req.params;
    const { user_id, ready } = req.body || {};
    const actorId = req.user.id;
    const targetId = Number(user_id) || actorId;
    // Только сам пользователь может менять свой ready
    if (actorId !== targetId) return res.status(403).json({ success: false, error: 'Можно менять только свой статус' });
    try {
        await pool.query(
            `INSERT INTO admin_lobby_presence(lobby_id, user_id, last_seen, is_ready)
             VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
             ON CONFLICT (lobby_id, user_id)
             DO UPDATE SET last_seen = EXCLUDED.last_seen, is_ready = EXCLUDED.is_ready`,
            [Number(lobbyId), targetId, Boolean(ready)]
        );
        return res.json({ success: true });
    } catch (e) {
        console.error('admin_lobby presence update error', e);
        return res.status(500).json({ success: false, error: 'presence update failed' });
    }
});
// =============================
//  Глобальный дефолтный маппул
// =============================

// Обеспечиваем наличие таблицы default_map_pool и базового наполнения
async function ensureDefaultMapPool() {
    // Создаем таблицу, если её нет
    await pool.query(`
        CREATE TABLE IF NOT EXISTS default_map_pool (
            id SERIAL PRIMARY KEY,
            map_name VARCHAR(50) NOT NULL,
            game VARCHAR(255) NOT NULL DEFAULT 'Counter-Strike 2',
            display_order INTEGER DEFAULT 0,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    `);
    // Обеспечиваем наличие колонки game (на случай старой схемы)
    await pool.query(`ALTER TABLE default_map_pool ADD COLUMN IF NOT EXISTS game VARCHAR(255) NOT NULL DEFAULT 'Counter-Strike 2'`);
    // Удаляем старый уникальный индекс по map_name, если был, и создаем составной уникальный ключ
    await pool.query(`
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_indexes WHERE indexname = 'default_map_pool_map_name_key'
            ) THEN
                -- ничего не делаем, это системный уник по столбцу (созданный как constraint), ниже пересоздадим составной
            END IF;
        END$$;
    `);
    await pool.query(`
        DO $$
        BEGIN
            -- пробуем создать составной уникальный constraint, если его нет
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE table_name = 'default_map_pool' AND constraint_type = 'UNIQUE' AND constraint_name = 'default_map_pool_game_map_name_unique'
            ) THEN
                BEGIN
                    ALTER TABLE default_map_pool ADD CONSTRAINT default_map_pool_game_map_name_unique UNIQUE (game, map_name);
                EXCEPTION WHEN duplicate_table THEN
                    -- игнорируем
                END;
            END IF;
        END$$;
    `);
    // Индекс для сортировки
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_default_map_pool_game_order ON default_map_pool(game, display_order)`);
    // Если пусто — наполняем значениями по умолчанию для CS2
    const countRes = await pool.query(`SELECT COUNT(*)::int AS c FROM default_map_pool WHERE game = $1`, ['Counter-Strike 2']);
    if (countRes.rows[0].c === 0) {
        const defaults = ['ancient', 'dust2', 'inferno', 'mirage', 'nuke', 'overpass', 'train'];
        let order = 1;
        for (const key of defaults) {
            await pool.query(
                `INSERT INTO default_map_pool (game, map_name, display_order)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (game, map_name) DO UPDATE SET display_order = EXCLUDED.display_order`,
                ['Counter-Strike 2', key, order]
            );
            order += 1;
        }
    }
}

// Получить текущий дефолтный маппул (для админов)
router.get('/default-map-pool', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await ensureDefaultMapPool();
        const game = (req.query.game && String(req.query.game).trim()) || 'Counter-Strike 2';
        const result = await pool.query(
            `SELECT map_name, display_order
             FROM default_map_pool
             WHERE game = $1
             ORDER BY display_order ASC, id ASC`,
            [game]
        );
        res.json({ success: true, game, maps: result.rows });
    } catch (err) {
        console.error('Ошибка получения дефолтного маппула:', err);
        res.status(500).json({ success: false, error: 'Не удалось получить дефолтный маппул' });
    }
});

// Обновить дефолтный маппул (замена всего набора)
router.put('/default-map-pool', authenticateToken, requireAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureDefaultMapPool();
        const { maps, game: bodyGame } = req.body; // ожидаем массив строк и игру
        const game = (bodyGame && String(bodyGame).trim()) || 'Counter-Strike 2';
        if (!Array.isArray(maps) || maps.length === 0) {
            return res.status(400).json({ success: false, error: 'Требуется непустой массив карт' });
        }

        await client.query('BEGIN');
        await client.query('DELETE FROM default_map_pool WHERE game = $1', [game]);

        let order = 1;
        for (const raw of maps) {
            const key = String(raw).toLowerCase().replace(/^de[_-]?/, '');
            await client.query(
                `INSERT INTO default_map_pool (game, map_name, display_order)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (game, map_name) DO UPDATE SET display_order = EXCLUDED.display_order`,
                [game, key, order]
            );
            order += 1;
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Дефолтный маппул обновлён', game });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Ошибка обновления дефолтного маппула:', err);
        res.status(500).json({ success: false, error: 'Не удалось обновить дефолтный маппул' });
    } finally {
        client.release();
    }
});

// =============================
//  Загрузка изображений карт
// =============================

const mapsImagesDir = path.join(__dirname, '../../frontend/public/images/maps');
fs.mkdirSync(mapsImagesDir, { recursive: true });

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB — запас для 512x512 JPEG
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.mimetype)) return cb(new Error('Недопустимый тип файла'));
        cb(null, true);
    }
});

// Загрузка/обновление изображения карты (320x180, 16:9)
router.post('/upload/map-image', authenticateToken, requireAdmin, upload.single('image'), async (req, res) => {
    try {
        const { mapKey } = req.body; // например: mirage, inferno, vertigo
        if (!mapKey || !req.file) return res.status(400).json({ success: false, error: 'Нужны mapKey и image' });

        const key = String(mapKey).toLowerCase().replace(/^de[_-]?/, '');
        const outPath = path.join(mapsImagesDir, `${key}_logo.jpg`);

        await sharp(req.file.buffer)
            .resize(320, 180, { fit: 'cover' })
            .jpeg({ quality: 85 })
            .toFile(outPath);

        return res.json({
            success: true,
            message: 'Изображение карты сохранено',
            file: `/images/maps/${key}_logo.jpg`
        });
    } catch (e) {
        console.error('Ошибка загрузки изображения карты:', e);
        return res.status(500).json({ success: false, error: 'Не удалось сохранить изображение' });
    }
});

// =============================
//  Загрузка логотипов (1000x1000)
// =============================
const logosDir = path.join(__dirname, '../uploads/logos');

// =============================
//  Управление аккаунтами пользователей (Admin)
// =============================

// Получить краткую информацию о пользователе по ID
router.get('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT id, username, email, role, is_verified, created_at, steam_id, faceit_id, avatar_url
             FROM users WHERE id = $1`,
            [id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        return res.json(result.rows[0]);
    } catch (err) {
        console.error('Ошибка получения пользователя админом:', err);
        return res.status(500).json({ error: 'Не удалось получить пользователя' });
    }
});

// Изменить никнейм пользователя по ID
router.post('/users/:id/username', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ error: 'Ник обязателен' });
    try {
        const exists = await pool.query('SELECT 1 FROM users WHERE username = $1 AND id != $2', [username, id]);
        if (exists.rows.length > 0) return res.status(400).json({ error: 'Ник уже занят' });
        await pool.query('UPDATE users SET username = $1 WHERE id = $2', [username, id]);
        return res.json({ message: 'Ник обновлён' });
    } catch (err) {
        console.error('Ошибка обновления ника админом:', err);
        return res.status(500).json({ error: 'Не удалось обновить ник' });
    }
});

// Сбросить email пользователя (установить NULL и снять верификацию)
router.post('/users/:id/reset-email', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('UPDATE users SET email = NULL, is_verified = FALSE WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        return res.json({ message: 'Email сброшен' });
    } catch (err) {
        console.error('Ошибка сброса email админом:', err);
        return res.status(500).json({ error: 'Не удалось сбросить email' });
    }
});

// Сбросить пароль пользователя на случайный. Возвращает новый пароль администратору
router.post('/users/:id/reset-password', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        // Генерируем 12-символьный безопасный пароль [a-zA-Z0-9]
        const raw = crypto.randomBytes(18).toString('base64');
        const newPassword = raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || crypto.randomBytes(8).toString('hex').slice(0, 12);
        const passwordHash = await bcrypt.hash(newPassword, 10);
        const result = await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id', [passwordHash, id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        return res.json({ message: 'Пароль сброшен', newPassword });
    } catch (err) {
        console.error('Ошибка сброса пароля админом:', err);
        return res.status(500).json({ error: 'Не удалось сбросить пароль' });
    }
});

// Удалить аккаунт пользователя (безопасная анонимизация)
router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        await client.query('BEGIN');
        const userRes = await client.query('SELECT id, username FROM users WHERE id = $1 FOR UPDATE', [id]);
        if (userRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const uniqueSuffix = crypto.randomBytes(3).toString('hex');
        const anonymizedUsername = `deleted_user_${id}_${uniqueSuffix}`;

        await client.query(
            `UPDATE users
             SET username = $1,
                 email = NULL,
                 password_hash = $2,
                 steam_id = NULL,
                 steam_url = NULL,
                 steam_nickname = NULL,
                 faceit_id = NULL,
                 faceit_elo = NULL,
                 full_name = NULL,
                 birth_date = NULL,
                 avatar_url = '/uploads/avatars/preloaded/circle-user.svg',
                 is_verified = FALSE
             WHERE id = $3`,
            [anonymizedUsername, await bcrypt.hash(crypto.randomBytes(12).toString('hex'), 10), id]
        );

        await client.query('COMMIT');
        return res.json({ message: 'Аккаунт удалён (анонимизирован)', username: anonymizedUsername });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Ошибка удаления аккаунта админом:', err);
        return res.status(500).json({ error: 'Не удалось удалить аккаунт' });
    } finally {
        client.release();
    }
});
fs.mkdirSync(logosDir, { recursive: true });

router.post('/upload/logo', authenticateToken, requireAdmin, upload.single('logo'), async (req, res) => {
    try {
        const { type = 'org', name = 'logo' } = req.body; // type: org/team/tournament
        if (!req.file) return res.status(400).json({ success: false, error: 'Файл не загружен' });

        const safeType = ['org', 'team', 'tournament'].includes(type) ? type : 'org';
        const dir = path.join(logosDir, safeType);
        fs.mkdirSync(dir, { recursive: true });

        const slug = String(name).toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'logo';
        const filename = `${slug}-${Date.now()}.jpg`;
        const outPath = path.join(dir, filename);

        await sharp(req.file.buffer)
            .resize(1000, 1000, { fit: 'cover', position: 'centre' })
            .jpeg({ quality: 90 })
            .toFile(outPath);

        const publicUrl = `/uploads/logos/${safeType}/${filename}`;
        return res.json({ success: true, message: 'Логотип сохранен', url: publicUrl });
    } catch (e) {
        console.error('Ошибка загрузки логотипа:', e);
        return res.status(500).json({ success: false, error: 'Не удалось сохранить логотип' });
    }
});


// =============================
//  Предзагруженные аватарки
// =============================
const preloadedAvatarsDir = path.join(__dirname, '../uploads/avatars/preloaded');
fs.mkdirSync(preloadedAvatarsDir, { recursive: true });
const preloadedMetaFile = path.join(preloadedAvatarsDir, 'meta.json');

function readPreloadedMeta() {
    try {
        if (!fs.existsSync(preloadedMetaFile)) return { categories: {} };
        const raw = fs.readFileSync(preloadedMetaFile, 'utf8');
        const json = JSON.parse(raw);
        if (!json || typeof json !== 'object') return { categories: {} };
        if (!json.categories || typeof json.categories !== 'object') json.categories = {};
        return json;
    } catch (e) {
        return { categories: {} };
    }
}

function writePreloadedMeta(meta) {
    try {
        const data = { categories: meta.categories || {} };
        fs.writeFileSync(preloadedMetaFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (_) {}
}

function getCategoryFor(filename) {
    const meta = readPreloadedMeta();
    return meta.categories && meta.categories[filename] || 'standard';
}

function setCategoryFor(filename, category) {
    const meta = readPreloadedMeta();
    if (!meta.categories) meta.categories = {};
    meta.categories[filename] = category;
    writePreloadedMeta(meta);
}

// =============================
//  Site settings (key-value)
// =============================
async function ensureSiteSettings() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS site_settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

async function getSetting(key) {
    await ensureSiteSettings();
    const r = await pool.query('SELECT value FROM site_settings WHERE key = $1', [key]);
    return r.rows[0]?.value || null;
}

async function setSetting(key, value) {
    await ensureSiteSettings();
    await pool.query(
        `INSERT INTO site_settings(key, value, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
        [key, value]
    );
}

// Список предзагруженных аватарок (для админов)
router.get('/preloaded-avatars', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const files = fs.readdirSync(preloadedAvatarsDir)
            .filter(f => /\.(png|jpe?g|webp)$/i.test(f));
        const list = files.map((name) => {
            const stat = fs.statSync(path.join(preloadedAvatarsDir, name));
            return {
                filename: name,
                url: `/uploads/avatars/preloaded/${name}`,
                size: stat.size,
                mtime: stat.mtimeMs,
                category: getCategoryFor(name)
            };
        }).sort((a, b) => b.mtime - a.mtime);
        return res.json({ success: true, avatars: list });
    } catch (e) {
        console.error('Ошибка получения предзагруженных аватарок:', e);
        return res.status(500).json({ success: false, error: 'Не удалось получить список' });
    }
});

// Текущий дефолтный аватар (для админов)
router.get('/preloaded-avatars/default', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const defaultUrl = await getSetting('default_avatar_url');
        return res.json({ success: true, default_url: defaultUrl });
    } catch (e) {
        console.error('Ошибка получения дефолтного аватара:', e);
        return res.status(500).json({ success: false, error: 'Не удалось получить дефолтный аватар' });
    }
});

// Установка дефолтного аватара (только 1). Обновляет default для новых пользователей и тех, у кого он не задан
router.put('/preloaded-avatars/default', authenticateToken, requireAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const { filename, url } = req.body || {};
        let targetUrl = null;
        let fileToCheck = null;

        if (filename && typeof filename === 'string') {
            fileToCheck = filename;
            targetUrl = `/uploads/avatars/preloaded/${filename}`;
        } else if (url && typeof url === 'string') {
            try {
                let pathPart = url;
                if (url.startsWith('http://') || url.startsWith('https://')) {
                    const u = new URL(url);
                    pathPart = u.pathname;
                }
                if (!pathPart.startsWith('/uploads/avatars/preloaded/')) {
                    return res.status(400).json({ success: false, error: 'Недопустимый путь к аватару' });
                }
                targetUrl = pathPart;
                fileToCheck = path.basename(pathPart);
            } catch (_) {
                return res.status(400).json({ success: false, error: 'Некорректный URL' });
            }
        } else {
            return res.status(400).json({ success: false, error: 'Укажите filename или url' });
        }

        // Проверяем, что файл существует в каталоге предзагруженных
        const absPath = path.join(preloadedAvatarsDir, fileToCheck);
        if (!fs.existsSync(absPath)) {
            return res.status(404).json({ success: false, error: 'Файл не найден среди предзагруженных' });
        }

        // Получим предыдущий дефолт
        const previousDefault = await getSetting('default_avatar_url');

        await client.query('BEGIN');
        await setSetting('default_avatar_url', targetUrl);
        // Для новых пользователей (DDL нельзя параметризовать — экранируем вручную)
        const escapedDefault = String(targetUrl).replace(/'/g, "''");
        await client.query(`ALTER TABLE users ALTER COLUMN avatar_url SET DEFAULT '${escapedDefault}'`);

        // 1) Обновляем пустые/некорректные значения
        await client.query(
            `UPDATE users
             SET avatar_url = $1
             WHERE avatar_url IS NULL
                OR trim(avatar_url) = ''
                OR lower(avatar_url) IN ('null','undefined')`,
            [targetUrl]
        );

        // 2) Обновляем тех, у кого стоит предыдущий дефолт или системный circle-user.svg
        const legacyDefault = '/uploads/avatars/preloaded/circle-user.svg';
        const candidates = [previousDefault, legacyDefault].filter(Boolean);
        if (candidates.length > 0) {
            await client.query(
                `UPDATE users
                 SET avatar_url = $1
                 WHERE avatar_url = ANY($2::text[])`,
                [targetUrl, candidates]
            );
        }

        await client.query('COMMIT');
        return res.json({ success: true, default_url: targetUrl });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Ошибка установки дефолтного аватара:', e);
        return res.status(500).json({ success: false, error: 'Не удалось установить дефолтный аватар' });
    } finally {
        client.release();
    }
});

// Загрузка новой предзагруженной аватарки (квадрат, 512x512)
router.post('/preloaded-avatars', authenticateToken, requireAdmin, (req, res, next) => {
    try {
        console.log('[UPLOAD DEBUG] /api/admin/preloaded-avatars START', {
            path: req.originalUrl,
            method: req.method,
            contentType: req.headers['content-type'],
            contentLength: req.headers['content-length'],
            userId: req.user && req.user.id,
            userRole: req.user && req.user.role
        });
    } catch (_) {}
    upload.single('image')(req, res, function (err) {
        if (err) {
            try {
                console.error('[UPLOAD DEBUG] Multer error', {
                    code: err.code,
                    message: err.message,
                    stack: err.stack,
                    contentLength: req.headers && req.headers['content-length'],
                    contentType: req.headers && req.headers['content-type']
                });
            } catch (_) {}
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ success: false, error: 'Файл слишком большой' });
            }
            return res.status(400).json({ success: false, error: err.message || 'Ошибка загрузки файла' });
        }
        try {
            console.log('[UPLOAD DEBUG] Multer OK', {
                hasFile: !!req.file,
                originalname: req.file && req.file.originalname,
                mimetype: req.file && req.file.mimetype,
                reportedSize: req.file && req.file.size,
                bufferLen: req.file && req.file.buffer && req.file.buffer.length
            });
        } catch (_) {}
        next();
    });
}, async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'Файл не загружен' });

        const filenameBase = (req.body.name || 'avatar')
            .toString()
            .toLowerCase()
            .replace(/[^a-z0-9-_]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') || 'avatar';

        const filename = `${filenameBase}-${Date.now()}.jpg`;
        const outPath = path.join(preloadedAvatarsDir, filename);

        await sharp(req.file.buffer)
            .resize(512, 512, { fit: 'cover', position: 'centre' })
            .jpeg({ quality: 90 })
            .toFile(outPath);

        try {
            console.log('[UPLOAD DEBUG] Saved preloaded avatar', {
                filename,
                publicUrl: `/uploads/avatars/preloaded/${filename}`
            });
        } catch (_) {}
        // Устанавливаем категорию по умолчанию — standard
        setCategoryFor(filename, 'standard');
        return res.json({ success: true, url: `/uploads/avatars/preloaded/${filename}`, filename, category: 'standard' });
    } catch (e) {
        console.error('Ошибка загрузки предзагруженной аватарки:', e);
        return res.status(500).json({ success: false, error: 'Не удалось сохранить аватар' });
    }
});

// Удаление предзагруженной аватарки
router.delete('/preloaded-avatars/:filename', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { filename } = req.params;
        if (!filename || filename.includes('..')) return res.status(400).json({ success: false, error: 'Некорректное имя файла' });
        const filePath = path.join(preloadedAvatarsDir, filename);
        if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, error: 'Файл не найден' });
        fs.unlinkSync(filePath);
        // также удалим запись в метаданных
        const meta = readPreloadedMeta();
        if (meta.categories && meta.categories[filename]) {
            delete meta.categories[filename];
            writePreloadedMeta(meta);
        }
        return res.json({ success: true });
    } catch (e) {
        console.error('Ошибка удаления аватарки:', e);
        return res.status(500).json({ success: false, error: 'Не удалось удалить' });
    }
});

// Обновление категории предзагруженной аватарки
router.patch('/preloaded-avatars/:filename/category', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { filename } = req.params;
        const { category } = req.body || {};
        const allowed = ['standard', 'rare', 'special', 'epic', 'legendary'];
        if (!filename || filename.includes('..')) return res.status(400).json({ success: false, error: 'Некорректное имя файла' });
        if (!allowed.includes(category)) return res.status(400).json({ success: false, error: 'Некорректная категория' });
        const filePath = path.join(preloadedAvatarsDir, filename);
        if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, error: 'Файл не найден' });
        setCategoryFor(filename, category);
        return res.json({ success: true });
    } catch (e) {
        console.error('Ошибка обновления категории аватарки:', e);
        return res.status(500).json({ success: false, error: 'Не удалось обновить категорию' });
    }
});


// (объявление перенесено наверх)

// Настройка транспорта nodemailer
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT === '465',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Функция для создания slug из названия
function createSlug(name) {
    return name.toLowerCase()
        .replace(/[^a-z0-9а-я]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

// Получение всех заявок на создание организаций
router.get('/organization-requests', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { status = 'all', page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = '';
        let queryParams = [limit, offset];

        if (status !== 'all') {
            whereClause = 'WHERE or2.status = $3';
            queryParams.push(status);
        }

        const result = await pool.query(`
            SELECT or2.*, 
                   u.username, u.email, u.avatar_url,
                   admin_user.username as reviewed_by_username
            FROM organization_requests or2
            JOIN users u ON or2.user_id = u.id
            LEFT JOIN users admin_user ON or2.reviewed_by = admin_user.id
            ${whereClause}
            ORDER BY or2.created_at DESC
            LIMIT $1 OFFSET $2
        `, queryParams);

        // Получаем общее количество заявок
        const countQuery = status !== 'all' 
            ? 'SELECT COUNT(*) FROM organization_requests WHERE status = $1'
            : 'SELECT COUNT(*) FROM organization_requests';
        const countParams = status !== 'all' ? [status] : [];
        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        res.json({
            requests: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Ошибка получения заявок:', err);
        res.status(500).json({ error: 'Не удалось получить заявки' });
    }
});

// Получение конкретной заявки
router.get('/organization-requests/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT or2.*, 
                   u.username, u.email, u.avatar_url, u.id as user_id,
                   admin_user.username as reviewed_by_username
            FROM organization_requests or2
            JOIN users u ON or2.user_id = u.id
            LEFT JOIN users admin_user ON or2.reviewed_by = admin_user.id
            WHERE or2.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Заявка не найдена' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Ошибка получения заявки:', err);
        res.status(500).json({ error: 'Не удалось получить заявку' });
    }
});

// Одобрение заявки на создание организации
router.post('/organization-requests/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const { id } = req.params;
        const { contact_email, contact_phone, admin_comment } = req.body;

        // Получаем заявку
        const requestResult = await client.query(`
            SELECT or2.*, u.username, u.email 
            FROM organization_requests or2
            JOIN users u ON or2.user_id = u.id
            WHERE or2.id = $1 AND or2.status = 'pending'
        `, [id]);

        if (requestResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Заявка не найдена или уже обработана' });
        }

        const request = requestResult.rows[0];

        // Создаем slug из названия организации
        let slug = createSlug(request.organization_name);
        
        // Проверяем уникальность slug
        let slugCounter = 1;
        let originalSlug = slug;
        while (true) {
            const existingSlug = await client.query('SELECT id FROM organizers WHERE slug = $1', [slug]);
            if (existingSlug.rows.length === 0) break;
            slug = `${originalSlug}-${slugCounter}`;
            slugCounter++;
        }

        // Создаем организатора
        const organizerResult = await client.query(`
            INSERT INTO organizers (
                name, slug, description, logo_url, website_url, 
                vk_url, telegram_url, contact_email, contact_phone, manager_user_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [
            request.organization_name,
            slug,
            request.description,
            request.logo_url,
            request.website_url,
            request.vk_url,
            request.telegram_url,
            contact_email || request.email,
            contact_phone,
            request.user_id
        ]);

        const organizer = organizerResult.rows[0];

        // Добавляем пользователя как менеджера организации
        await client.query(`
            INSERT INTO organizer_members (organizer_id, user_id, role)
            VALUES ($1, $2, 'manager')
        `, [organizer.id, request.user_id]);

        // Обновляем статус заявки
        await client.query(`
            UPDATE organization_requests 
            SET status = 'approved', 
                admin_comment = $1,
                reviewed_by = $2,
                reviewed_at = CURRENT_TIMESTAMP
            WHERE id = $3
        `, [admin_comment, req.user.id, id]);

        await client.query('COMMIT');

        // Отправляем уведомление пользователю
        try {
            const mailOptions = {
                from: process.env.SMTP_FROM,
                to: request.email,
                subject: 'Ваша заявка на создание аккаунта организации одобрена!',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #4dbb63;">Поздравляем! Ваша заявка одобрена!</h2>
                        <p>Здравствуйте, ${request.username}!</p>
                        <p>Ваша заявка на создание аккаунта организации "<strong>${request.organization_name}</strong>" была одобрена администрацией.</p>
                        
                        <div style="background-color: #f0f8ff; padding: 15px; margin: 20px 0; border-left: 4px solid #4dbb63;">
                            <p style="margin: 0;">Профиль вашей организации доступен по ссылке:</p>
                            <p style="margin: 10px 0 0 0;">
                                <a href="https://1337community.com/organizer/${slug}" target="_blank" style="color: #4dbb63; font-weight: bold;">
                                    https://1337community.com/organizer/${slug}
                                </a>
                            </p>
                        </div>
                        
                        ${admin_comment ? `
                            <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-left: 4px solid #4682b4;">
                                <h4 style="margin: 0 0 10px 0; color: #4682b4;">Комментарий администратора:</h4>
                                <p style="margin: 0;">${admin_comment}</p>
                            </div>
                        ` : ''}
                        
                        <p>Теперь вы можете:</p>
                        <ul>
                            <li>Создавать турниры от имени организации</li>
                            <li>Управлять участниками команды</li>
                            <li>Редактировать информацию об организации</li>
                        </ul>
                        
                        <p>Спасибо за ваш интерес к нашей платформе!</p>
                        <p>С уважением,<br>Команда 1337 Community</p>
                    </div>
                `
            };
            
            await transporter.sendMail(mailOptions);
        } catch (emailErr) {
            console.error('Ошибка отправки email:', emailErr);
            // Не прерываем выполнение, если email не отправился
        }

        res.json({
            message: 'Заявка успешно одобрена',
            organizer: organizer
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Ошибка одобрения заявки:', err);
        res.status(500).json({ error: 'Не удалось одобрить заявку' });
    } finally {
        client.release();
    }
});

// Отклонение заявки на создание организации
router.post('/organization-requests/:id/reject', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { admin_comment } = req.body;

        if (!admin_comment || admin_comment.trim() === '') {
            return res.status(400).json({ error: 'Комментарий обязателен при отклонении заявки' });
        }

        // Получаем заявку для отправки уведомления
        const requestResult = await pool.query(`
            SELECT or2.*, u.username, u.email 
            FROM organization_requests or2
            JOIN users u ON or2.user_id = u.id
            WHERE or2.id = $1 AND or2.status = 'pending'
        `, [id]);

        if (requestResult.rows.length === 0) {
            return res.status(404).json({ error: 'Заявка не найдена или уже обработана' });
        }

        const request = requestResult.rows[0];

        // Обновляем статус заявки
        await pool.query(`
            UPDATE organization_requests 
            SET status = 'rejected', 
                admin_comment = $1,
                reviewed_by = $2,
                reviewed_at = CURRENT_TIMESTAMP
            WHERE id = $3
        `, [admin_comment, req.user.id, id]);

        // Отправляем уведомление пользователю
        try {
            const mailOptions = {
                from: process.env.SMTP_FROM,
                to: request.email,
                subject: 'Ваша заявка на создание аккаунта организации отклонена',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #bb4d4d;">Заявка отклонена</h2>
                        <p>Здравствуйте, ${request.username}!</p>
                        <p>К сожалению, ваша заявка на создание аккаунта организации "<strong>${request.organization_name}</strong>" была отклонена администрацией.</p>
                        
                        <div style="background-color: #fff5f5; padding: 15px; margin: 20px 0; border-left: 4px solid #bb4d4d;">
                            <h4 style="margin: 0 0 10px 0; color: #bb4d4d;">Причина отклонения:</h4>
                            <p style="margin: 0;">${admin_comment}</p>
                        </div>
                        
                        <p>Вы можете подать новую заявку, учтя указанные замечания.</p>
                        
                        <p>С уважением,<br>Команда 1337 Community</p>
                    </div>
                `
            };
            
            await transporter.sendMail(mailOptions);
        } catch (emailErr) {
            console.error('Ошибка отправки email:', emailErr);
            // Не прерываем выполнение, если email не отправился
        }

        res.json({ message: 'Заявка отклонена' });

    } catch (err) {
        console.error('Ошибка отклонения заявки:', err);
        res.status(500).json({ error: 'Не удалось отклонить заявку' });
    }
});

// Получение статистики для админ панели
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const statsResult = await pool.query(`
            SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
                COUNT(CASE WHEN role = 'user' THEN 1 END) as regular_users
            FROM users
        `);

        const organizersResult = await pool.query(`
            SELECT COUNT(*) as total_organizers FROM organizers WHERE is_active = true
        `);

        const requestsResult = await pool.query(`
            SELECT 
                status,
                COUNT(*) as count
            FROM organization_requests
            GROUP BY status
        `);

        const tournamentsResult = await pool.query(`
            SELECT 
                COUNT(*) as total_tournaments,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_tournaments,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tournaments
            FROM tournaments
        `);

        const stats = {
            users: statsResult.rows[0],
            organizers: organizersResult.rows[0],
            requests: requestsResult.rows.reduce((acc, row) => {
                acc[row.status] = parseInt(row.count);
                return acc;
            }, { pending: 0, approved: 0, rejected: 0 }),
            tournaments: tournamentsResult.rows[0]
        };

        res.json(stats);
    } catch (err) {
        console.error('Ошибка получения статистики:', err);
        res.status(500).json({ error: 'Не удалось получить статистику' });
    }
});

// =============================
//  CS2: Тестовое лобби (админ)
// =============================
router.get('/match/test-lobby', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Заглушка: читаем базовые переменные окружения для формирования ссылок
        const host = process.env.CS2_TEST_HOST || '127.0.0.1';
        const port = Number(process.env.CS2_TEST_PORT || 27015);
        const pass = process.env.CS2_TEST_PASSWORD || 'test1337';
        const gotvHost = process.env.CS2_GOTV_HOST || host;
        const gotvPort = Number(process.env.CS2_GOTV_PORT || 27020);
        const gotvPass = process.env.CS2_GOTV_PASSWORD || 'gotv1337';

        const connect = `steam://rungameid/730//+connect ${host}:${port};+password ${pass}`;
        const gotv = `steam://rungameid/730//+connect ${gotvHost}:${gotvPort};+password ${gotvPass}`;

        return res.json({ success: true, connect, gotv });
    } catch (e) {
        console.error('Ошибка GET /match/test-lobby', e);
        return res.status(500).json({ success: false, error: 'Не удалось получить тестовое лобби' });
    }
});

router.post('/match/test-lobby', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { players = [], settings = {} } = req.body || {};
        if (!Array.isArray(players) || players.length === 0) {
            return res.status(400).json({ success: false, error: 'Нужен непустой список игроков' });
        }
        // В реальной интеграции здесь: создание сервера через Pterodactyl, конфиг MatchZy, вайтлист SteamID и т.д.
        const host = process.env.CS2_TEST_HOST || '127.0.0.1';
        const port = Number(process.env.CS2_TEST_PORT || 27015);
        const pass = process.env.CS2_TEST_PASSWORD || 'test1337';
        const gotvHost = process.env.CS2_GOTV_HOST || host;
        const gotvPort = Number(process.env.CS2_GOTV_PORT || 27020);
        const gotvPass = process.env.CS2_GOTV_PASSWORD || 'gotv1337';

        // Возвращаем строки подключения
        const connect = `steam://rungameid/730//+connect ${host}:${port};+password ${pass}`;
        const gotv = `steam://rungameid/730//+connect ${gotvHost}:${gotvPort};+password ${gotvPass}`;
        return res.json({ success: true, connect, gotv, applied: { players: players.length, settings } });
    } catch (e) {
        console.error('Ошибка POST /match/test-lobby', e);
        return res.status(500).json({ success: false, error: 'Не удалось создать тестовое лобби' });
    }
});

router.post('/match/test-lobby/whitelist', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { players = [], steam_ids = [] } = req.body || {};
        const ids = Array.isArray(players) && players.length > 0
            ? players.map(p => p.steam_id).filter(Boolean)
            : (Array.isArray(steam_ids) ? steam_ids.filter(Boolean) : []);

        if (ids.length === 0) {
            return res.status(400).json({ success: false, error: 'Нужен список steam_id' });
        }

        // В реальной интеграции: отправить команды в консоль сервера/Pterodactyl или RCON
        // Здесь — заглушка успешной синхронизации
        return res.json({ success: true, whitelisted: ids.length });
    } catch (e) {
        console.error('Ошибка POST /match/test-lobby/whitelist', e);
        return res.status(500).json({ success: false, error: 'Не удалось синхронизировать whitelist' });
    }
});

// =============================
//  ADMIN LOBBY (отдельное лобби под админ-матч)
// =============================
async function ensureAdminLobbyTables() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_match_lobbies (
            id SERIAL PRIMARY KEY,
            status VARCHAR(16) NOT NULL DEFAULT 'waiting',
            match_format VARCHAR(8), -- bo1|bo3|bo5
            team1_name VARCHAR(64) DEFAULT 'Команда 1',
            team2_name VARCHAR(64) DEFAULT 'Команда 2',
            team1_ready BOOLEAN DEFAULT FALSE,
            team2_ready BOOLEAN DEFAULT FALSE,
            first_picker_team SMALLINT, -- 1|2
            current_turn_team SMALLINT, -- 1|2
            created_by INTEGER NOT NULL,
            connect_url TEXT,
            gotv_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_lobby_invitations (
            id SERIAL PRIMARY KEY,
            lobby_id INTEGER NOT NULL REFERENCES admin_match_lobbies(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL,
            team SMALLINT, -- 1|2 (NULL = без команды)
            accepted BOOLEAN DEFAULT FALSE,
            declined BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
    // Безопасно добавляем недостающую колонку declined
    await pool.query(`ALTER TABLE admin_lobby_invitations ADD COLUMN IF NOT EXISTS declined BOOLEAN DEFAULT FALSE`);

    // Присутствие пользователей в админ-лобби (heartbeats)
    await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_lobby_presence (
            lobby_id INTEGER NOT NULL REFERENCES admin_match_lobbies(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL,
            last_seen TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (lobby_id, user_id)
        );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_lobby_presence_lobby_seen ON admin_lobby_presence(lobby_id, last_seen)`);
    // Готовность игрока (локальная отметка)
    await pool.query(`ALTER TABLE admin_lobby_presence ADD COLUMN IF NOT EXISTS is_ready BOOLEAN DEFAULT FALSE`);
    // Дедупликация и уникальный индекс
    await pool.query(`
        WITH dup AS (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY lobby_id, user_id ORDER BY created_at DESC, id DESC) rn
            FROM admin_lobby_invitations
        )
        DELETE FROM admin_lobby_invitations a USING dup
        WHERE a.id = dup.id AND dup.rn > 1;
    `);
    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS admin_lobby_inv_unique ON admin_lobby_invitations(lobby_id, user_id);
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_map_selections (
            id SERIAL PRIMARY KEY,
            lobby_id INTEGER NOT NULL REFERENCES admin_match_lobbies(id) ON DELETE CASCADE,
            map_name VARCHAR(64) NOT NULL,
            action_type VARCHAR(8) NOT NULL, -- pick|ban
            team SMALLINT NOT NULL, -- 1|2
            action_order INTEGER NOT NULL,
            UNIQUE(lobby_id, map_name)
        );
    `);
}

function determineNextTurnForFormat(matchFormat, actionIndex, firstPickerTeam) {
    const sequences = {
        bo1: ['ban', 'ban', 'ban', 'ban', 'ban', 'ban', 'pick'],
        bo3: ['ban', 'ban', 'pick', 'pick', 'ban', 'ban', 'pick'],
        bo5: ['pick', 'pick', 'ban', 'ban', 'pick', 'pick', 'pick']
    };
    const seq = sequences[matchFormat] || [];
    if (actionIndex >= seq.length) return { completed: true };
    const isFirstPickerTurn = actionIndex % 2 === 0;
    const nextTeam = isFirstPickerTurn ? firstPickerTeam : (firstPickerTeam === 1 ? 2 : 1);
    return { completed: false, teamId: nextTeam, actionType: seq[actionIndex] };
}

// Создать админ-лобби (одно активное на пользователя)
router.post('/match-lobby', authenticateToken, requireAdmin, async (req, res) => {
    await ensureDefaultMapPool();
    await ensureAdminLobbyTables();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Пытаемся найти последнее незавершённое лобби автора
        const existing = await client.query(
            `SELECT * FROM admin_match_lobbies 
             WHERE created_by = $1 AND status IN ('waiting','ready','picking')
             ORDER BY created_at DESC LIMIT 1`,
            [req.user.id]
        );
        let lobby;
        if (existing.rows[0]) {
            lobby = existing.rows[0];
        } else {
            const ins = await client.query(
                `INSERT INTO admin_match_lobbies(created_by) VALUES($1) RETURNING *`,
                [req.user.id]
            );
            lobby = ins.rows[0];
        }
        // Доступные карты из default_map_pool
        const mapsRes = await client.query(
            `SELECT concat('de_', map_name) as map_name, display_order
             FROM default_map_pool WHERE game = $1 ORDER BY display_order ASC, map_name ASC`,
            ['Counter-Strike 2']
        );
        await client.query('COMMIT');
        // Уведомление создателю (персональная комната), чтобы можно было вернуться в активное лобби
        try {
            const io = req.app.get('io');
            if (io) {
                io.to(`user_${req.user.id}`).emit('admin_match_lobby_invite', { lobbyId: Number(lobby.id) });
            }
        } catch (_) {}
        return res.json({ success: true, lobby, available_maps: mapsRes.rows });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Ошибка создания админ-лобби', e);
        return res.status(500).json({ success: false, error: 'Не удалось создать лобби' });
    } finally {
        client.release();
    }
});

// Получить состояние админ-лобби
router.get('/match-lobby/:lobbyId', authenticateToken, async (req, res) => {
    await ensureAdminLobbyTables();
    await ensureDefaultMapPool();
    const { lobbyId } = req.params;
    const client = await pool.connect();
    try {
        const lobbyRes = await client.query(`SELECT * FROM admin_match_lobbies WHERE id = $1`, [lobbyId]);
        if (!lobbyRes.rows[0]) return res.status(404).json({ success: false, error: 'Лобби не найдено' });
        const lobby = lobbyRes.rows[0];

        // 🛡️ Доступ: админ ИЛИ создатель ИЛИ приглашённый пользователь
        if (req.user.role !== 'admin') {
            const invited = await client.query(
                `SELECT 1 FROM admin_lobby_invitations WHERE lobby_id = $1 AND user_id = $2 LIMIT 1`,
                [lobbyId, req.user.id]
            );
            const isCreator = Number(lobby.created_by) === Number(req.user.id);
            if (!(invited.rows[0] || isCreator)) {
                console.warn('[ADMIN_LOBBY][ACCESS_DENIED]', {
                    lobbyId: Number(lobbyId),
                    requesterId: Number(req.user.id),
                    isCreator,
                    invitedFound: !!invited.rows[0]
                });
                await client.query('ROLLBACK');
                return res.status(403).json({ success: false, error: 'Нет доступа к этому лобби' });
            }
        }
        // 💓 Обновляем heartbeat присутствия для текущего пользователя
        try {
            await client.query(
                `INSERT INTO admin_lobby_presence(lobby_id, user_id, last_seen)
                 VALUES ($1, $2, CURRENT_TIMESTAMP)
                 ON CONFLICT (lobby_id, user_id)
                 DO UPDATE SET last_seen = EXCLUDED.last_seen`,
                [lobbyId, req.user.id]
            );
        } catch (_) {}
        const mapsRes = await client.query(
            `SELECT concat('de_', map_name) as map_name, display_order
             FROM default_map_pool WHERE game = $1 ORDER BY display_order ASC, map_name ASC`,
            ['Counter-Strike 2']
        );
        const selRes = await client.query(
            `SELECT map_name, action_type, team as team_id, action_order
             FROM admin_map_selections WHERE lobby_id = $1 ORDER BY action_order ASC`,
            [lobbyId]
        );
        const invRes = await client.query(
            `SELECT DISTINCT ON (i.user_id)
                    i.user_id, i.team, i.accepted, i.declined, i.created_at,
                    u.username, u.avatar_url, u.steam_id
             FROM admin_lobby_invitations i
             JOIN users u ON u.id = i.user_id
             WHERE i.lobby_id = $1
             ORDER BY i.user_id, i.created_at DESC`,
            [lobbyId]
        );
        // Включаем создателя лобби как приглашенного участника (если нет записи)
        if (!invRes.rows.some(r => Number(r.user_id) === Number(lobby.created_by))) {
            const owner = await client.query('SELECT id, username, avatar_url, steam_id FROM users WHERE id = $1', [lobby.created_by]);
            if (owner.rows[0]) {
                invRes.rows.unshift({
                    user_id: owner.rows[0].id,
                    team: null,
                    accepted: true,
                    declined: false,
                    created_at: lobby.created_at,
                    username: owner.rows[0].username,
                    avatar_url: owner.rows[0].avatar_url,
                    steam_id: owner.rows[0].steam_id
                });
            }
        }
        // Группируем участников
        const team1_users = invRes.rows
            .filter(r => r.team === 1 && r.accepted)
            .map(r => ({ id: r.user_id, username: r.username, avatar_url: r.avatar_url, steam_id: r.steam_id }));
        const team2_users = invRes.rows
            .filter(r => r.team === 2 && r.accepted)
            .map(r => ({ id: r.user_id, username: r.username, avatar_url: r.avatar_url, steam_id: r.steam_id }));
        const unassigned_users = invRes.rows
            .filter(r => r.accepted === true && r.team === null && r.declined === false)
            .map(r => ({ id: r.user_id, username: r.username, avatar_url: r.avatar_url }));
        const invited_pending_users = invRes.rows
            .filter(r => r.accepted === false && r.declined === false)
            .map(r => ({ id: r.user_id, username: r.username, avatar_url: r.avatar_url }));
        const invited_declined_users = invRes.rows
            .filter(r => r.declined === true)
            .map(r => ({ id: r.user_id, username: r.username, avatar_url: r.avatar_url }));

        // Онлайн‑присутствие: heartbeat за 10 секунд + (опционально) сокет-комната
        let online_user_ids = [];
        let ready_user_ids = [];
        try {
            const hb = await client.query(
                `SELECT DISTINCT user_id, is_ready FROM admin_lobby_presence
                 WHERE lobby_id = $1 AND last_seen > (CURRENT_TIMESTAMP - INTERVAL '10 seconds')`,
                [lobbyId]
            );
            const ids = new Set();
            const rids = new Set();
            for (const row of hb.rows) {
                ids.add(Number(row.user_id));
                if (row.is_ready) rids.add(Number(row.user_id));
            }
            try {
                const io = req.app.get('io');
                if (io) {
                    const sockets = await io.in(`admin_lobby_${lobbyId}`).fetchSockets();
                    for (const s of sockets) { if (s.userId) ids.add(Number(s.userId)); }
                }
            } catch (_) {}
            online_user_ids = Array.from(ids);
            ready_user_ids = Array.from(rids);
        } catch (_) {}
        return res.json({ success: true, lobby, available_maps: mapsRes.rows, selections: selRes.rows, team1_users, team2_users, unassigned_users, invited_pending_users, invited_declined_users, online_user_ids, ready_user_ids });
    } catch (e) {
        console.error('Ошибка получения админ-лобби', e);
        return res.status(500).json({ success: false, error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

// Пригласить пользователя в команду
router.post('/match-lobby/:lobbyId/invite', authenticateToken, requireAdmin, async (req, res) => {
    await ensureAdminLobbyTables();
    const { lobbyId } = req.params;
    const { user_id, team = null, accept = false } = req.body || {};
    if (!user_id) return res.status(400).json({ success: false, error: 'user_id обязателен' });
    try {
        console.log('[ADMIN_LOBBY][INVITE] request', {
            lobbyId: Number(lobbyId),
            inviterId: req.user?.id,
            targetUserId: Number(user_id),
            team,
            accept
        });
        await pool.query(
            `INSERT INTO admin_lobby_invitations(lobby_id, user_id, team, accepted)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (lobby_id, user_id)
             DO UPDATE SET team = EXCLUDED.team, accepted = admin_lobby_invitations.accepted OR EXCLUDED.accepted`,
            [lobbyId, user_id, (team === null ? null : Number(team)), Boolean(accept)]
        );
        // WS-уведомление приглашенному
        try {
            const io = req.app.get('io');
            if (io) {
                const roomName = `user_${user_id}`;
                let socketsCount = 0;
                try {
                    const sockets = await io.in(roomName).allSockets();
                    socketsCount = sockets ? sockets.size : 0;
                } catch (_) {}
                console.log('[ADMIN_LOBBY][INVITE] emit admin_match_lobby_invite', {
                    lobbyId: Number(lobbyId),
                    room: roomName,
                    socketsInRoom: socketsCount
                });
                io.to(`user_${user_id}`).emit('admin_match_lobby_invite', { lobbyId: Number(lobbyId) });
                return res.json({ success: true, debug: { room: roomName, socketsInRoom: socketsCount } });
            }
        } catch (_) {}
        return res.json({ success: true, debug: { room: `user_${user_id}`, socketsInRoom: 0 } });
    } catch (e) {
        console.error('Ошибка приглашения', e);
        return res.status(500).json({ success: false, error: 'Не удалось пригласить' });
    }
});

// Отменить приглашение пользователя в админ-лобби
router.delete('/match-lobby/:lobbyId/invite/:userId', authenticateToken, async (req, res) => {
    await ensureAdminLobbyTables();
    const { lobbyId, userId } = req.params;
    try {
        // Разрешаем: админ или создатель лобби
        const r = await pool.query('SELECT created_by FROM admin_match_lobbies WHERE id = $1', [lobbyId]);
        if (r.rows.length === 0) return res.status(404).json({ success: false, error: 'Лобби не найдено' });
        const isCreator = Number(r.rows[0].created_by) === Number(req.user.id);
        if (!(req.user.role === 'admin' || isCreator)) {
            return res.status(403).json({ success: false, error: 'Нет прав на отмену приглашения' });
        }
        await pool.query('DELETE FROM admin_lobby_invitations WHERE lobby_id = $1 AND user_id = $2', [lobbyId, userId]);
        return res.json({ success: true });
    } catch (e) {
        console.error('Ошибка отмены приглашения', e);
        return res.status(500).json({ success: false, error: 'Не удалось отменить приглашение' });
    }
});

// Принять приглашение пользователем
router.post('/match-lobby/:lobbyId/accept', authenticateToken, async (req, res) => {
    await ensureAdminLobbyTables();
    const { lobbyId } = req.params;
    const userId = req.user.id;
    try {
        const r = await pool.query(
            `UPDATE admin_lobby_invitations SET accepted = TRUE, declined = FALSE WHERE lobby_id = $1 AND user_id = $2 RETURNING *`,
            [lobbyId, userId]
        );
        if (r.rows.length === 0) return res.status(404).json({ success: false, error: 'Приглашение не найдено' });
        return res.json({ success: true });
    } catch (e) {
        console.error('Ошибка принятия приглашения', e);
        return res.status(500).json({ success: false, error: 'Не удалось принять приглашение' });
    }
});

// Отказ от приглашения
router.post('/match-lobby/:lobbyId/decline', authenticateToken, async (req, res) => {
    await ensureAdminLobbyTables();
    const { lobbyId } = req.params;
    const userId = req.user.id;
    try {
        const r = await pool.query(
            `UPDATE admin_lobby_invitations SET declined = TRUE, accepted = FALSE WHERE lobby_id = $1 AND user_id = $2 RETURNING *`,
            [lobbyId, userId]
        );
        if (r.rows.length === 0) return res.status(404).json({ success: false, error: 'Приглашение не найдено' });
        return res.json({ success: true });
    } catch (e) {
        console.error('Ошибка отказа от приглашения', e);
        return res.status(500).json({ success: false, error: 'Не удалось отказаться' });
    }
});

// Мои приглашения в админ-лобби (pending)
router.get('/match-lobbies/my-invites', authenticateToken, async (req, res) => {
    await ensureAdminLobbyTables();
    try {
        console.log('[ADMIN_LOBBY][MY_INVITES] request', { userId: req.user?.id });
        const r = await pool.query(
            `SELECT i.lobby_id, i.team, i.accepted, i.created_at,
                    aml.status as lobby_status, aml.created_by
             FROM admin_lobby_invitations i
             JOIN admin_match_lobbies aml ON aml.id = i.lobby_id
             WHERE i.user_id = $1 AND COALESCE(i.accepted,false) = false
             ORDER BY i.created_at DESC NULLS LAST
             LIMIT 20`,
            [req.user.id]
        );
        console.log('[ADMIN_LOBBY][MY_INVITES] rows', { count: r.rows.length });
        return res.json({ success: true, invites: r.rows });
    } catch (e) {
        console.error('Ошибка получения приглашений', e);
        return res.status(500).json({ success: false, error: 'Не удалось получить приглашения' });
    }
});

// Админ вступает в команду
router.post('/match-lobby/:lobbyId/join', authenticateToken, requireAdmin, async (req, res) => {
    await ensureAdminLobbyTables();
    const { lobbyId } = req.params;
    const { team } = req.body || {};
    if (![1,2].includes(Number(team))) return res.status(400).json({ success: false, error: 'team должен быть 1 или 2' });
    try {
        await pool.query(
            `INSERT INTO admin_lobby_invitations(lobby_id, user_id, team, accepted)
             VALUES ($1, $2, $3, TRUE)
             ON CONFLICT DO NOTHING`,
            [lobbyId, req.user.id, Number(team)]
        );
        return res.json({ success: true });
    } catch (e) {
        console.error('Ошибка join', e);
        return res.status(500).json({ success: false, error: 'Не удалось вступить' });
    }
});

// Пользователь (приглашённый) выбирает команду и принимает приглашение
router.post('/match-lobby/:lobbyId/self-assign', authenticateToken, async (req, res) => {
    await ensureAdminLobbyTables();
    const { lobbyId } = req.params;
    const { team } = req.body || {};
    if (![1,2,null].includes(team === null ? null : Number(team))) {
        return res.status(400).json({ success: false, error: 'team должен быть 1, 2 или null' });
    }
    try {
        // Проверяем, что пользователь приглашён в это лобби
        const r = await pool.query(
            `SELECT 1 FROM admin_lobby_invitations WHERE lobby_id = $1 AND user_id = $2 LIMIT 1`,
            [lobbyId, req.user.id]
        );
        if (r.rows.length === 0) return res.status(403).json({ success: false, error: 'Вы не приглашены в это лобби' });
        // Обновляем команду и принимаем
        await pool.query(
            `UPDATE admin_lobby_invitations SET team = $1, accepted = TRUE WHERE lobby_id = $2 AND user_id = $3`,
            [team === null ? null : Number(team), lobbyId, req.user.id]
        );
        return res.json({ success: true });
    } catch (e) {
        console.error('Ошибка self-assign', e);
        return res.status(500).json({ success: false, error: 'Не удалось присоединиться' });
    }
});

// Установить формат
router.post('/match-lobby/:lobbyId/format', authenticateToken, requireAdmin, async (req, res) => {
    await ensureAdminLobbyTables();
    const { lobbyId } = req.params;
    const { format } = req.body || {};
    if (!['bo1','bo3','bo5'].includes(format)) return res.status(400).json({ success: false, error: 'Неверный формат' });
    try {
        const r = await pool.query(
            `UPDATE admin_match_lobbies 
             SET match_format = $1,
                 status = 'waiting',
                 team1_ready = FALSE,
                 team2_ready = FALSE,
                 first_picker_team = NULL,
                 current_turn_team = NULL,
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = $2 
             RETURNING *`,
            [format, lobbyId]
        );
        return res.json({ success: true, lobby: r.rows[0] });
    } catch (e) {
        console.error('Ошибка установки формата', e);
        return res.status(500).json({ success: false, error: 'Не удалось установить формат' });
    }
});

// Готовность команд
router.post('/match-lobby/:lobbyId/ready', authenticateToken, requireAdmin, async (req, res) => {
    await ensureAdminLobbyTables();
    const { lobbyId } = req.params;
    const { team, ready } = req.body || {};
    if (![1,2].includes(Number(team))) return res.status(400).json({ success: false, error: 'team должен быть 1 или 2' });
    const t = Number(team);
    const col = t === 1 ? 'team1_ready' : 'team2_ready';
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const upd = await client.query(
            `UPDATE admin_match_lobbies SET ${col} = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
            [Boolean(ready), lobbyId]
        );
        let lobby = upd.rows[0];
        // Если обе команды готовы — помечаем статус как 'ready', старт отдельной кнопкой
        if (lobby.team1_ready && lobby.team2_ready && lobby.status === 'waiting') {
            lobby = (await client.query(
                `UPDATE admin_match_lobbies SET status = 'ready', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
                [lobbyId]
            )).rows[0];
        }
        await client.query('COMMIT');
        return res.json({ success: true, lobby });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Ошибка ready', e);
        return res.status(500).json({ success: false, error: 'Не удалось обновить готовность' });
    } finally {
        client.release();
    }
});

// Пик/бан карты — разрешаем:
// - админ/создатель лобби
// - капитан команды, у которой сейчас ход (капитан = первый принявший инвайт в команде)
router.post('/match-lobby/:lobbyId/select-map', authenticateToken, async (req, res) => {
    await ensureAdminLobbyTables();
    const { lobbyId } = req.params;
    const { mapName, action } = req.body || {};
    if (!['pick','ban'].includes(action)) return res.status(400).json({ success: false, error: 'action: pick|ban' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const lobRes = await client.query('SELECT * FROM admin_match_lobbies WHERE id = $1 FOR UPDATE', [lobbyId]);
        const lobby = lobRes.rows[0];
        if (!lobby) throw new Error('Лобби не найдено');
        if (lobby.status !== 'picking') throw new Error('Пики/баны ещё не начались');

        // Проверка прав
        const isAdmin = req.user.role === 'admin' || Number(lobby.created_by) === Number(req.user.id);
        if (!isAdmin) {
            // Пользователь должен быть принятым участником команды, у которой сейчас ход
            const teamTurn = lobby.current_turn_team;
            if (teamTurn !== 1 && teamTurn !== 2) {
                await client.query('ROLLBACK');
                return res.status(403).json({ success: false, error: 'Не ваш ход' });
            }
            const acc = await client.query(
                `SELECT user_id FROM admin_lobby_invitations 
                 WHERE lobby_id = $1 AND accepted = TRUE AND team = $2
                 ORDER BY created_at ASC LIMIT 1`,
                [lobbyId, teamTurn]
            );
            const captainUserId = acc.rows[0]?.user_id ? Number(acc.rows[0].user_id) : null;
            if (captainUserId !== Number(req.user.id)) {
                await client.query('ROLLBACK');
                return res.status(403).json({ success: false, error: 'Ход может делать только капитан команды' });
            }
        }
        // Проверка, не выбрана ли карта
        const exists = await client.query('SELECT 1 FROM admin_map_selections WHERE lobby_id = $1 AND map_name = $2', [lobbyId, mapName]);
        if (exists.rows[0]) throw new Error('Карта уже выбрана или забанена');
        // Определяем чей ход
        const countRes = await client.query('SELECT COUNT(*)::int AS c FROM admin_map_selections WHERE lobby_id = $1', [lobbyId]);
        const actionIndex = countRes.rows[0].c;
        const turnTeam = lobby.current_turn_team;
        // Сохраняем действие
        await client.query(
            `INSERT INTO admin_map_selections(lobby_id, map_name, action_type, team, action_order)
             VALUES ($1, $2, $3, $4, $5)`,
            [lobbyId, mapName, action, turnTeam, actionIndex + 1]
        );
        // Следующий ход
        const next = determineNextTurnForFormat(lobby.match_format, actionIndex + 1, lobby.first_picker_team);
        if (next.completed) {
            // Завершено — формируем JSON конфиг матча
            // (поднимем статус до 'match_created' сразу после записи файла + генерации ссылок)

            // Собираем данные для JSON: карты, составы команд и имена
            const picksRes = await client.query(
                `SELECT map_name, action_type, action_order
                 FROM admin_map_selections
                 WHERE lobby_id = $1
                 ORDER BY action_order ASC`,
                [lobbyId]
            );
            const maplist = picksRes.rows
                .filter(r => r.action_type === 'pick')
                .map(r => String(r.map_name));

            // Получаем составы команд (только принявшие приглашение)
            const teamRes = await client.query(
                `SELECT i.team, u.username, u.steam_id
                 FROM admin_lobby_invitations i
                 JOIN users u ON u.id = i.user_id
                 WHERE i.lobby_id = $1 AND i.accepted = TRUE AND i.team IN (1,2)`,
                [lobbyId]
            );
            const team1PlayersSteam = teamRes.rows.filter(r => Number(r.team) === 1)
                .map(r => r.steam_id).filter(Boolean).map(String);
            const team2PlayersSteam = teamRes.rows.filter(r => Number(r.team) === 2)
                .map(r => r.steam_id).filter(Boolean).map(String);

            // Читаем названия команд и формат
            const lobbyFresh = (await client.query('SELECT match_format, team1_name, team2_name FROM admin_match_lobbies WHERE id = $1', [lobbyId])).rows[0];
            const format = lobbyFresh?.match_format || lobby.match_format || 'bo1';
            const numMapsByFormat = { bo1: 1, bo3: 3, bo5: 5 };
            const num_maps = numMapsByFormat[format] || 1;

            // Формируем уникальный matchid и путь для сохранения
            const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
            const matchid = `${format}-lobby${lobbyId}-${ts}`;
            const cfg = {
                matchid,
                num_maps,
                maplist,
                skip_veto: true,
                side_type: 'standard',
                team1: { name: lobbyFresh?.team1_name || 'TEAM_A', players: team1PlayersSteam },
                team2: { name: lobbyFresh?.team2_name || 'TEAM_B', players: team2PlayersSteam }
            };

            let configJsonSaved = false;
            let publicUrl = null;
            try {
                const path = require('path');
                const fs = require('fs');
                const baseDir = path.join(__dirname, '..', 'lobbies', String(lobbyId));
                fs.mkdirSync(baseDir, { recursive: true });
                const fileName = `${matchid}.json`;
                const filePath = path.join(baseDir, fileName);
                fs.writeFileSync(filePath, JSON.stringify(cfg, null, 2), 'utf8');
                publicUrl = `/lobby/${lobbyId}/${fileName}`;
                configJsonSaved = true;
            } catch (writeErr) {
                console.error('Ошибка записи JSON конфига лобби', writeErr);
                // продолжим создание матч‑ссылок даже если файл не записался
            }

            // Автогенерация ссылок подключения — сразу после завершения пик/бан
            const cs2Host = process.env.CS2_TEST_HOST || process.env.CS2_GOTV_HOST || '127.0.0.1';
            const cs2Port = process.env.CS2_TEST_PORT || process.env.CS2_GOTV_PORT || '27015';
            const cs2Pass = process.env.CS2_TEST_PASSWORD || process.env.CS2_GOTV_PASSWORD || '';
            const connect = `steam://connect/${cs2Host}:${cs2Port}/${cs2Pass ? cs2Pass : ''}`.replace(/\/$/, '');
            const gotvHost = process.env.CS2_GOTV_HOST || cs2Host;
            const gotvPort = process.env.CS2_GOTV_PORT || '27020';
            const gotvPass = process.env.CS2_GOTV_PASSWORD || cs2Pass;
            const gotv = `steam://rungameid/730//+connect ${gotvHost}:${gotvPort};+password ${gotvPass}`;

            const updStatus = await client.query(
                `UPDATE admin_match_lobbies SET status = 'match_created', connect_url = $1, gotv_url = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,
                [connect, gotv, lobbyId]
            );
            // Создаём запись в matches как custom match
            const participants = await client.query(
                `SELECT i.team, i.user_id, u.username, u.steam_id
                 FROM admin_lobby_invitations i
                 JOIN users u ON u.id = i.user_id
                 WHERE i.lobby_id = $1 AND i.accepted = TRUE AND i.team IN (1,2)
                 ORDER BY i.team ASC, i.created_at ASC`,
                [lobbyId]
            );
            const team1Players = participants.rows.filter(r => Number(r.team) === 1).map(r => ({ user_id: r.user_id, username: r.username, steam_id: r.steam_id }));
            const team2Players = participants.rows.filter(r => Number(r.team) === 2).map(r => ({ user_id: r.user_id, username: r.username, steam_id: r.steam_id }));
            const mapsData = picksRes.rows
                .filter(r => r.action_type === 'pick')
                .map((r, idx) => ({ order: r.action_order, map: r.map_name, index: idx + 1 }));

            const matchIns = await client.query(
                `INSERT INTO matches (source_type, custom_lobby_id, game, tournament_id, team1_id, team2_id, team1_name, team2_name, status, created_at,
                                      connect_url, gotv_url, maps_data, team1_players, team2_players)
                 VALUES ('custom', $1, $2, NULL, NULL, NULL, $3, $4, 'completed', NOW(), $5, $6, $7::jsonb, $8::jsonb, $9::jsonb)
                 RETURNING id`,
                [lobbyId, 'CS2', lobbyFresh?.team1_name || 'TEAM_A', lobbyFresh?.team2_name || 'TEAM_B', connect, gotv, JSON.stringify(mapsData), JSON.stringify(team1Players), JSON.stringify(team2Players)]
            );
            const newMatchId = matchIns.rows[0].id;

            // Сохраняем шаги пика/бана в match_veto_steps
            for (const row of picksRes.rows) {
                await client.query(
                    `INSERT INTO match_veto_steps (match_id, action_order, action_type, team_id, map_name)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [newMatchId, row.action_order, row.action_type, row.team_id || null, row.map_name]
                );
            }

            await client.query('COMMIT');
            return res.json({ success: true, completed: true, config_json_url: publicUrl, matchid, maplist, connect, gotv, lobby: updStatus.rows[0], match_id: newMatchId });
        } else {
            const upd = await client.query(
                `UPDATE admin_match_lobbies SET current_turn_team = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
                [next.teamId, lobbyId]
            );
            await client.query('COMMIT');
            return res.json({ success: true, completed: false, lobby: upd.rows[0] });
        }
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Ошибка select-map', e);
        return res.status(400).json({ success: false, error: e.message || 'Не удалось выполнить действие' });
    } finally {
        client.release();
    }
});

// Старт стадии пик/бан (только создатель)
router.post('/match-lobby/:lobbyId/start-pick', authenticateToken, requireAdmin, async (req, res) => {
    const { lobbyId } = req.params;
    const { firstPicker } = req.body || {};
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const r = await client.query('SELECT * FROM admin_match_lobbies WHERE id = $1 FOR UPDATE', [lobbyId]);
        const lobby = r.rows[0];
        if (!lobby) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, error: 'Лобби не найдено' }); }
        if (Number(lobby.created_by) !== Number(req.user.id)) { await client.query('ROLLBACK'); return res.status(403).json({ success: false, error: 'Только создатель может начать пик/бан' }); }
        if (!lobby.match_format) { await client.query('ROLLBACK'); return res.status(400).json({ success: false, error: 'Не выбран формат матча' }); }
        if (!(lobby.team1_ready && lobby.team2_ready)) { await client.query('ROLLBACK'); return res.status(400).json({ success: false, error: 'Обе команды должны быть готовы' }); }
        const fp = firstPicker === 1 || firstPicker === 2 ? firstPicker : (Math.random() < 0.5 ? 1 : 2);
        const upd = await client.query(
            `UPDATE admin_match_lobbies SET status = 'picking', first_picker_team = $1, current_turn_team = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
            [fp, lobbyId]
        );
        await client.query('COMMIT');
        return res.json({ success: true, lobby: upd.rows[0] });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Ошибка старта пик/бан', e);
        return res.status(500).json({ success: false, error: 'Не удалось начать пик/бан' });
    } finally {
        client.release();
    }
});

// Создать матч (генерируем ссылки подключения), только создатель
router.post('/match-lobby/:lobbyId/create-match', authenticateToken, requireAdmin, async (req, res) => {
    const { lobbyId } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const r = await client.query('SELECT * FROM admin_match_lobbies WHERE id = $1 FOR UPDATE', [lobbyId]);
        const lobby = r.rows[0];
        if (!lobby) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, error: 'Лобби не найдено' }); }
        if (Number(lobby.created_by) !== Number(req.user.id)) { await client.query('ROLLBACK'); return res.status(403).json({ success: false, error: 'Только создатель может создать матч' }); }
        if (lobby.status !== 'ready_to_create') { await client.query('ROLLBACK'); return res.status(400).json({ success: false, error: 'Пики/баны должны быть завершены' }); }
        const host = process.env.CS2_TEST_HOST || '127.0.0.1';
        const port = Number(process.env.CS2_TEST_PORT || 27015);
        const pass = process.env.CS2_TEST_PASSWORD || 'test1337';
        const gotvHost = process.env.CS2_GOTV_HOST || host;
        const gotvPort = Number(process.env.CS2_GOTV_PORT || 27020);
        const gotvPass = process.env.CS2_GOTV_PASSWORD || 'gotv1337';
        const connect = `steam://rungameid/730//+connect ${host}:${port};+password ${pass}`;
        const gotv = `steam://rungameid/730//+connect ${gotvHost}:${gotvPort};+password ${gotvPass}`;
        const upd = await client.query(
            `UPDATE admin_match_lobbies SET status = 'match_created', connect_url = $1, gotv_url = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,
            [connect, gotv, lobbyId]
        );
        await client.query('COMMIT');
        // Уведомление приглашённым (если подключены)
        try {
            const io = req.app.get('io');
            if (io) {
                const inv = await pool.query('SELECT user_id FROM admin_lobby_invitations WHERE lobby_id = $1 AND accepted = TRUE', [lobbyId]);
                for (const row of inv.rows) {
                    io.to(`user_${row.user_id}`).emit('admin_match_created', { lobbyId: Number(lobbyId), connect, gotv });
                }
            }
        } catch (_) {}
        return res.json({ success: true, lobby: upd.rows[0], connect, gotv });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Ошибка create-match', e);
        return res.status(500).json({ success: false, error: 'Не удалось создать матч' });
    } finally {
        client.release();
    }
});
// Получить ссылки подключения по завершению
router.get('/match-lobby/:lobbyId/connect', authenticateToken, async (req, res) => {
    const { lobbyId } = req.params;
    try {
        // Доступ: админ/создатель/приглашённый
        const r = await pool.query('SELECT connect_url, gotv_url, created_by FROM admin_match_lobbies WHERE id = $1', [lobbyId]);
        if (!r.rows[0]) return res.status(404).json({ success: false, error: 'Лобби не найдено' });
        if (req.user.role !== 'admin' && Number(r.rows[0].created_by) !== Number(req.user.id)) {
            const invited = await pool.query(
                `SELECT 1 FROM admin_lobby_invitations WHERE lobby_id = $1 AND user_id = $2 LIMIT 1`,
                [lobbyId, req.user.id]
            );
            if (invited.rows.length === 0) return res.status(403).json({ success: false, error: 'Нет доступа' });
        }
        return res.json({ success: true, connect: r.rows[0].connect_url, gotv: r.rows[0].gotv_url });
    } catch (e) {
        console.error('Ошибка connect', e);
        return res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Очистить лобби (создатель)
router.post('/match-lobby/:lobbyId/clear', authenticateToken, requireAdmin, async (req, res) => {
    await ensureAdminLobbyTables();
    const { lobbyId } = req.params;
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const r = await client.query('SELECT created_by FROM admin_match_lobbies WHERE id = $1 FOR UPDATE', [lobbyId]);
        if (!r.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'Лобби не найдено' });
        }
        if (Number(r.rows[0].created_by) !== Number(userId)) {
            await client.query('ROLLBACK');
            return res.status(403).json({ success: false, error: 'Только создатель лобби может выполнять очистку' });
        }
        await client.query('DELETE FROM admin_map_selections WHERE lobby_id = $1', [lobbyId]);
        await client.query('DELETE FROM admin_lobby_invitations WHERE lobby_id = $1', [lobbyId]);
        const upd = await client.query(
            `UPDATE admin_match_lobbies
             SET status = 'waiting', match_format = NULL,
                 team1_ready = FALSE, team2_ready = FALSE,
                 first_picker_team = NULL, current_turn_team = NULL,
                 connect_url = NULL, gotv_url = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 RETURNING *`,
            [lobbyId]
        );
        await client.query('COMMIT');
        return res.json({ success: true, lobby: upd.rows[0] });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Ошибка очистки лобби', e);
        return res.status(500).json({ success: false, error: 'Не удалось очистить лобби' });
    } finally {
        client.release();
    }
});

module.exports = router; 