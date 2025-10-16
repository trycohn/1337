// (route moved below after router initialization)
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
// Проверка роли администратора (обновлено под многоролёвость)
const { restrictTo } = require('../middleware/auth');
const requireAdmin = restrictTo(['platform_admin']);

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
        // Требуем привязку Steam для участия в лобби
        const u = await pool.query('SELECT steam_id FROM users WHERE id = $1', [actorId]);
        if (!u.rows[0]?.steam_id) {
            return res.status(400).json({ success: false, error: 'Необходимо привязать Steam для участия в лобби' });
        }
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
let __mapsEnsured = false;
async function ensureDefaultMapPool() {
    if (__mapsEnsured) return;
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
    __mapsEnsured = true;
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
let __adminLobbyEnsured = false;
async function ensureAdminLobbyTables() {
    if (__adminLobbyEnsured) return;
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
    // Добавляем поле для фиксации порядка игроков в команде (капитан = team_position 1)
    await pool.query(`ALTER TABLE admin_lobby_invitations ADD COLUMN IF NOT EXISTS team_position INTEGER DEFAULT 0`);

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
        
        -- Администраторы лобби (создатель + дополнительные админы в будущем)
        CREATE TABLE IF NOT EXISTS admin_lobby_admins (
            lobby_id INTEGER NOT NULL REFERENCES admin_match_lobbies(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id),
            role VARCHAR(16) DEFAULT 'admin',
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (lobby_id, user_id)
        );
    `);
    __adminLobbyEnsured = true;
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
router.post('/match-lobby', authenticateToken, async (req, res) => {
    await ensureDefaultMapPool();
    await ensureAdminLobbyTables();
    // Разрешаем создавать тестовое лобби только глобальному администратору
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Только администратор может создавать тестовое лобби' });
    }
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
            // Автоматически назначаем создателя админом лобби
            try {
                await client.query(
                    `INSERT INTO admin_lobby_admins(lobby_id, user_id, role)
                     VALUES ($1, $2, 'owner') ON CONFLICT (lobby_id, user_id) DO NOTHING`,
                    [lobby.id, req.user.id]
                );
            } catch (_) {}
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

        // 🛡️ Доступ: админ ИЛИ создатель ИЛИ приглашённый пользователь ИЛИ админ лобби
        if (req.user.role !== 'admin') {
            const invited = await client.query(
                `SELECT 1 FROM admin_lobby_invitations WHERE lobby_id = $1 AND user_id = $2 LIMIT 1`,
                [lobbyId, req.user.id]
            );
            const isCreator = Number(lobby.created_by) === Number(req.user.id);
            const adminLobby = await client.query(`SELECT 1 FROM admin_lobby_admins WHERE lobby_id = $1 AND user_id = $2`, [lobbyId, req.user.id]);
            if (!(invited.rows[0] || isCreator || adminLobby.rows[0])) {
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
                    i.user_id, i.team, i.accepted, i.declined, i.created_at, i.updated_at, i.team_position,
                    u.username, u.avatar_url, u.steam_id
             FROM admin_lobby_invitations i
             JOIN users u ON u.id = i.user_id
             WHERE i.lobby_id = $1
             ORDER BY i.user_id, i.updated_at DESC`,
            [lobbyId]
        );
        console.log('[ADMIN_LOBBY][GET] invites raw', {
            lobbyId: Number(lobbyId),
            rows: invRes.rows.length,
            sample: invRes.rows.slice(0, 3)
        });
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
        // Группируем участников (сортируем по team_position для явной фиксации капитанов)
        const team1_users = invRes.rows
            .filter(r => r.team === 1 && r.accepted)
            .sort((a, b) => (a.team_position || 0) - (b.team_position || 0) || a.id - b.id)
            .map(r => ({ id: r.user_id, username: r.username, avatar_url: r.avatar_url, steam_id: r.steam_id }));
        const team2_users = invRes.rows
            .filter(r => r.team === 2 && r.accepted)
            .sort((a, b) => (a.team_position || 0) - (b.team_position || 0) || a.id - b.id)
            .map(r => ({ id: r.user_id, username: r.username, avatar_url: r.avatar_url, steam_id: r.steam_id }));
        let unassigned_users = invRes.rows
            .filter(r => r.team === null && r.declined === false && (r.accepted === true || Number(r.user_id) === Number(lobby.created_by)))
            .map(r => ({ id: r.user_id, username: r.username, avatar_url: r.avatar_url }));
        console.log('[ADMIN_LOBBY][GET] grouped', {
            lobbyId: Number(lobbyId),
            team1_users_len: team1_users.length,
            team2_users_len: team2_users.length,
            unassigned_users_len: unassigned_users.length,
            creator_id: Number(lobby.created_by),
            creator_in_unassigned: unassigned_users.some(u => Number(u.id) === Number(lobby.created_by)),
            creator_in_team1: team1_users.some(u => Number(u.id) === Number(lobby.created_by)),
            creator_in_team2: team2_users.some(u => Number(u.id) === Number(lobby.created_by))
        });
        // Гарантируем отображение создателя лобби среди "не в команде", если он не в командах
        if (!team1_users.some(u => Number(u.id) === Number(lobby.created_by)) && !team2_users.some(u => Number(u.id) === Number(lobby.created_by))) {
            const ownerRow = invRes.rows.find(r => Number(r.user_id) === Number(lobby.created_by));
            if (ownerRow) {
                if (!unassigned_users.some(u => Number(u.id) === Number(ownerRow.user_id))) {
                    unassigned_users.unshift({ id: ownerRow.user_id, username: ownerRow.username, avatar_url: ownerRow.avatar_url });
                }
            }
        }
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
                 WHERE lobby_id = $1 AND last_seen > (CURRENT_TIMESTAMP - INTERVAL '8 seconds')`,
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
router.post('/match-lobby/:lobbyId/invite', authenticateToken, async (req, res) => {
    await ensureAdminLobbyTables();
    const { lobbyId } = req.params;
    const { user_id, team = null, accept = false } = req.body || {};
    if (!user_id) return res.status(400).json({ success: false, error: 'user_id обязателен' });
    try {
        // Разрешаем: админ или создатель лобби
        const rOwner = await pool.query('SELECT created_by FROM admin_match_lobbies WHERE id = $1', [lobbyId]);
        if (rOwner.rows.length === 0) return res.status(404).json({ success: false, error: 'Лобби не найдено' });
        const isCreator = Number(rOwner.rows[0].created_by) === Number(req.user.id);
        if (!(req.user.role === 'admin' || isCreator)) {
            return res.status(403).json({ success: false, error: 'Нет прав на приглашение' });
        }
        console.log('[ADMIN_LOBBY][INVITE] request', {
            lobbyId: Number(lobbyId),
            inviterId: req.user?.id,
            targetUserId: Number(user_id),
            team,
            accept
        });
        
        // Если назначаем в команду — определяем team_position (порядковый номер)
        let teamPosition = 0;
        if (team !== null && team !== undefined) {
            const teamNum = Number(team);
            const countRes = await pool.query(
                `SELECT COUNT(*) as cnt FROM admin_lobby_invitations 
                 WHERE lobby_id = $1 AND team = $2 AND accepted = TRUE`,
                [lobbyId, teamNum]
            );
            teamPosition = (parseInt(countRes.rows[0]?.cnt) || 0) + 1;
        }
        
        const upsert = await pool.query(
            `INSERT INTO admin_lobby_invitations(lobby_id, user_id, team, accepted, declined, team_position, updated_at)
             VALUES ($1, $2, $3, $4, FALSE, $5, NOW())
             ON CONFLICT (lobby_id, user_id)
             DO UPDATE SET team = EXCLUDED.team, accepted = admin_lobby_invitations.accepted OR EXCLUDED.accepted, declined = FALSE, team_position = EXCLUDED.team_position, updated_at = NOW()`,
            [lobbyId, user_id, (team === null ? null : Number(team)), Boolean(accept), teamPosition]
        );
        const after = await pool.query('SELECT user_id, team, accepted, declined FROM admin_lobby_invitations WHERE lobby_id = $1 AND user_id = $2', [lobbyId, user_id]);
        console.log('[ADMIN_LOBBY][INVITE] upserted', { lobbyId: Number(lobbyId), userId: Number(user_id), row: after.rows[0] });
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
        // Обновляем команду и принимаем. Назначаем team_position, чтобы порядок во фронте был стабильным
        const teamNum = (team === null ? null : Number(team));
        if (teamNum === null) {
            await pool.query(
                `UPDATE admin_lobby_invitations SET team = NULL, accepted = TRUE, team_position = 0 WHERE lobby_id = $1 AND user_id = $2`,
                [lobbyId, req.user.id]
            );
        } else {
            // next position = max(team_position) + 1 среди принятых в этой команде
            const posRes = await pool.query(
                `SELECT COALESCE(MAX(team_position), 0) + 1 AS pos
                 FROM admin_lobby_invitations
                 WHERE lobby_id = $1 AND team = $2 AND accepted = TRUE`,
                [lobbyId, teamNum]
            );
            const nextPos = parseInt(posRes.rows[0]?.pos) || 1;
            await pool.query(
                `UPDATE admin_lobby_invitations
                 SET team = $1, accepted = TRUE,
                     team_position = CASE WHEN COALESCE(team_position, 0) = 0 OR team <> $1 THEN $4 ELSE team_position END
                 WHERE lobby_id = $2 AND user_id = $3`,
                [teamNum, lobbyId, req.user.id, nextPos]
            );
        }
        return res.json({ success: true });
    } catch (e) {
        console.error('Ошибка self-assign', e);
        return res.status(500).json({ success: false, error: 'Не удалось присоединиться' });
    }
});

// Установить формат (админ или создатель лобби)
router.post('/match-lobby/:lobbyId/format', authenticateToken, async (req, res) => {
    await ensureAdminLobbyTables();
    const { lobbyId } = req.params;
    const { format } = req.body || {};
    if (!['bo1','bo3','bo5'].includes(format)) return res.status(400).json({ success: false, error: 'Неверный формат' });
    try {
        // Проверка прав: админ или создатель лобби
        const lobbyCheck = await pool.query('SELECT created_by FROM admin_match_lobbies WHERE id = $1', [lobbyId]);
        if (lobbyCheck.rows.length === 0) return res.status(404).json({ success: false, error: 'Лобби не найдено' });
        const isCreator = Number(lobbyCheck.rows[0].created_by) === Number(req.user.id);
        if (!(req.user.role === 'admin' || isCreator)) {
            return res.status(403).json({ success: false, error: 'Нет прав на изменение формата' });
        }
        
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

// Готовность команд (админ или создатель лобби)
router.post('/match-lobby/:lobbyId/ready', authenticateToken, async (req, res) => {
    await ensureAdminLobbyTables();
    const { lobbyId } = req.params;
    const { team, ready } = req.body || {};
    if (![1,2].includes(Number(team))) return res.status(400).json({ success: false, error: 'team должен быть 1 или 2' });
    const t = Number(team);
    const col = t === 1 ? 'team1_ready' : 'team2_ready';
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Проверка прав: админ или создатель лобби
        const lobbyCheck = await client.query('SELECT created_by FROM admin_match_lobbies WHERE id = $1 FOR UPDATE', [lobbyId]);
        if (lobbyCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'Лобби не найдено' });
        }
        const isCreator = Number(lobbyCheck.rows[0].created_by) === Number(req.user.id);
        if (!(req.user.role === 'admin' || isCreator)) {
            await client.query('ROLLBACK');
            return res.status(403).json({ success: false, error: 'Нет прав на изменение готовности команд' });
        }
        
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
    console.log('[SELECT-MAP] request', { lobbyId, mapName, action, userId: req.user?.id });
    if (!['pick','ban'].includes(action)) return res.status(400).json({ success: false, error: 'action: pick|ban' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const lobRes = await client.query('SELECT * FROM admin_match_lobbies WHERE id = $1 FOR UPDATE', [lobbyId]);
        const lobby = lobRes.rows[0];
        if (!lobby) throw new Error('Лобби не найдено');
        console.log('[SELECT-MAP] lobby status', { status: lobby.status, current_turn: lobby.current_turn_team });
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
                 ORDER BY team_position ASC, id ASC LIMIT 1`,
                [lobbyId, teamTurn]
            );
            const captainUserId = acc.rows[0]?.user_id ? Number(acc.rows[0].user_id) : null;
            console.log('[SELECT-MAP] captain check', { teamTurn, captainUserId, requesterId: req.user.id, isAdmin });
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
        // Сохраняем действие (admin_map_selections)
        await client.query(
            `INSERT INTO admin_map_selections(lobby_id, map_name, action_type, team, action_order)
             VALUES ($1, $2, $3, $4, $5)`,
            [lobbyId, mapName, action, turnTeam, actionIndex + 1]
        );
        // Дублируем в историю veto для будущей страницы матча
        await client.query(
            `INSERT INTO matchzy_pickban_steps(lobby_id, series_type, step_index, action, team_name, team_id, mapname, actor_steamid64)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
                lobbyId,
                lobby.match_format || 'bo1',
                actionIndex + 1,
                action,
                (turnTeam === 1 ? lobby.team1_name : lobby.team2_name) || null,
                turnTeam,
                mapName,
                null
            ]
        );
        // Следующий ход
        const next = determineNextTurnForFormat(lobby.match_format, actionIndex + 1, lobby.first_picker_team);
        if (next.completed) {
            const T0 = Date.now();
            console.log(`⏱️ [T+0ms] Начало генерации конфига и поиска сервера`);
            
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
            
            // Формируем объект players для MatchZy (steam_id: nickname)
            const team1PlayersObj = {};
            const team2PlayersObj = {};
            
            teamRes.rows.forEach(r => {
                if (r.steam_id) {
                    const steamId = String(r.steam_id);
                    const nickname = r.username || 'Player';
                    if (Number(r.team) === 1) {
                        team1PlayersObj[steamId] = nickname;
                    } else if (Number(r.team) === 2) {
                        team2PlayersObj[steamId] = nickname;
                    }
                }
            });

            // Читаем названия команд и формат
            const lobbyFresh = (await client.query('SELECT match_format, team1_name, team2_name FROM admin_match_lobbies WHERE id = $1', [lobbyId])).rows[0];
            const format = lobbyFresh?.match_format || lobby.match_format || 'bo1';
            const numMapsByFormat = { bo1: 1, bo3: 3, bo5: 5 };
            const num_maps = numMapsByFormat[format] || 1;

            // Динамически определяем players_per_team (берем максимум из обеих команд)
            const team1Count = Object.keys(team1PlayersObj).length;
            const team2Count = Object.keys(team2PlayersObj).length;
            const players_per_team = Math.max(team1Count, team2Count, 1);

            // Формируем уникальный matchid (ЧИСЛО для MatchZy!)
            const ts = Date.now().toString().slice(-8); // Последние 8 цифр timestamp
            const matchid = parseInt(`${lobbyId}${ts}`); // ЧИСЛО, не строка!
            const fileName = `${format}-lobby${lobbyId}-${Date.now()}.json`;
            
            const cfg = {
                matchid, // ЧИСЛО для MatchZy
                num_maps,
                maplist,
                skip_veto: true,
                side_type: 'standard',
                players_per_team, // динамическое значение
                team1: { 
                    name: (lobbyFresh?.team1_name && lobbyFresh.team1_name !== 'Команда 1') ? lobbyFresh.team1_name : 'TEAM_A', 
                    players: team1PlayersObj // объект {steam_id: nickname}
                },
                team2: { 
                    name: (lobbyFresh?.team2_name && lobbyFresh.team2_name !== 'Команда 2') ? lobbyFresh.team2_name : 'TEAM_B', 
                    players: team2PlayersObj // объект {steam_id: nickname}
                },
                // Webhook настройки для автоматической отправки статистики
                cvars: {
                    matchzy_remote_log_url: 'https://1337community.com/api/matchzy/match-end',
                    matchzy_remote_log_header_key: 'Authorization',
                    matchzy_remote_log_header_value: 'Bearer 2a262f61e1138fb19445e5aa64c75f9f25bc85581666f00605e3da99245f2f59'
                }
            };

            console.log(`⏱️ [T+${Date.now()-T0}ms] Данные собраны, генерируем JSON файл`);
            
            let configJsonSaved = false;
            let publicUrl = null;
            let fullConfigUrl = null;
            try {
                const path = require('path');
                const fs = require('fs');
                const baseDir = path.join(__dirname, '..', 'lobbies', String(lobbyId));
                fs.mkdirSync(baseDir, { recursive: true });
                const filePath = path.join(baseDir, fileName);
                fs.writeFileSync(filePath, JSON.stringify(cfg, null, 2), 'utf8');
                publicUrl = `/lobby/${lobbyId}/${fileName}`;
                fullConfigUrl = `https://1337community.com${publicUrl}`;
                configJsonSaved = true;
                console.log(`✅ [T+${Date.now()-T0}ms] JSON конфиг сохранен: ${fullConfigUrl} (matchid=${matchid})`);
            } catch (writeErr) {
                console.error('❌ Ошибка записи JSON конфига лобби', writeErr);
            }

            // 🖥️ Поиск свободного сервера и загрузка конфига через RCON (с таймаутом)
            let selectedServer = null;
            let connect = null;
            let gotv = null;

            if (configJsonSaved && fullConfigUrl) {
                try {
                    const rconService = require('../services/rconService');
                    
                    // Получаем список активных серверов
                    const serversResult = await client.query(
                        'SELECT * FROM cs2_servers WHERE is_active = true ORDER BY id ASC'
                    );
                    
                    console.log(`🔍 Поиск свободного сервера среди ${serversResult.rows.length} активных...`);
                    
                    // Поиск свободного сервера (без таймаута - проверяем все серверы)
                        for (const server of serversResult.rows) {
                            try {
                                console.log(`⏳ [T+${Date.now()-T0}ms] Проверка сервера ${server.name} (${server.host}:${server.port})...`);
                                
                                // Проверяем занят ли сервер
                                console.log(`🔍 [T+${Date.now()-T0}ms] Отправка matchzy_is_match_setup...`);
                                
                                const statusResult = await rconService.executeCommand(
                                    server.id,
                                    'matchzy_is_match_setup'
                                );
                                
                                console.log(`📥 [T+${Date.now()-T0}ms] RCON команда вернулась, обрабатываем результат...`);
                                console.log(`📥 [T+${Date.now()-T0}ms] statusResult:`, JSON.stringify(statusResult));
                                
                                const statusResponse = statusResult.response || '';
                                console.log(`📋 [T+${Date.now()-T0}ms] Статус от ${server.name}:`, statusResponse);
                                console.log(`📋 [T+${Date.now()-T0}ms] Тип response:`, typeof statusResponse, 'Длина:', statusResponse.length);
                                
                                // Парсим ответ: "matchzy_is_match_setup = 0" или "matchzy_is_match_setup = 1"
                                const match = statusResponse.match(/matchzy_is_match_setup\s*=\s*(\d+)/i);
                                const matchStatus = match ? match[1] : null;
                                
                                if (!matchStatus) {
                                    console.log(`⚠️ Не удалось распарсить статус от ${server.name}, пропускаем...`);
                                    continue;
                                }
                                
                                const isOccupied = matchStatus === '1';
                                
                                if (isOccupied) {
                                    console.log(`⚠️ Сервер ${server.name} занят (matchzy_is_match_setup=1), пробуем следующий...`);
                                    continue;
                                }
                                
                                console.log(`✅ Сервер ${server.name} свободен (matchzy_is_match_setup=0), загружаем конфиг...`);
                                
                                // Отправляем команду загрузки (НЕ ЖДЕМ ответа - команда выполняется в фоне)
                                rconService.executeCommand(
                                    server.id,
                                    `matchzy_loadmatch_url "${fullConfigUrl}"`
                                ).catch(err => {
                                    console.error(`⚠️ Ошибка загрузки конфига на ${server.name}:`, err.message);
                                });
                                
                                console.log(`✅ [T+${Date.now()-T0}ms] Команда загрузки отправлена на ${server.name}!`);
                                selectedServer = server;
                                
                                console.log(`⏱️ [T+${Date.now()-T0}ms] Формируем ссылки подключения`);
                                
                                // Формируем ссылки подключения
                                const serverPass = server.server_password || '';
                                connect = `steam://connect/${server.host}:${server.port}${serverPass ? '/' + serverPass : ''}`;
                                
                                const gotvHost = server.gotv_host || server.host;
                                const gotvPort = server.gotv_port || server.port;
                                const gotvPass = server.gotv_password || '';
                                gotv = `steam://connect/${gotvHost}:${gotvPort}${gotvPass ? '/' + gotvPass : ''}`;
                                
                                console.log(`✅ Конфиг загружен на сервер ${server.name}!`);
                                console.log(`📡 Connect: ${connect}`);
                                console.log(`📺 GOTV: ${gotv}`);
                                
                                // Обновляем статус сервера
                                await client.query(
                                    'UPDATE cs2_servers SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                                    ['in_use', server.id]
                                );
                                
                                break; // Сервер найден, выходим из цикла
                                
                        } catch (serverError) {
                            console.error(`❌ Ошибка на сервере ${server.name}:`, serverError.message);
                            continue; // Пробуем следующий сервер
                        }
                    }
                    
                    if (!selectedServer) {
                        console.warn('⚠️ Не найдено свободных серверов! Лобби создано без привязки к серверу.');
                    }
                    
                } catch (rconError) {
                    console.error('❌ Ошибка при поиске сервера:', rconError);
                }
            }

            console.log(`⏱️ [T+${Date.now()-T0}ms] Обновляем лобби в БД`);
            
            // Обновляем лобби с данными сервера (если найден)
            const updStatus = await client.query(
                `UPDATE admin_match_lobbies 
                SET status = 'match_created', 
                    server_id = $1, 
                    connect_url = $2, 
                    gotv_url = $3, 
                    updated_at = CURRENT_TIMESTAMP 
                WHERE id = $4 
                RETURNING *`,
                [selectedServer?.id || null, connect || null, gotv || null, lobbyId]
            );
            
            console.log(`⏱️ [T+${Date.now()-T0}ms] Создаем запись матча`);
            
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
                `INSERT INTO matches (
                    source_type, custom_lobby_id, game, tournament_id,
                    team1_id, team2_id, team1_name, team2_name,
                    round, match_number, tournament_match_number,
                    status, created_at,
                    connect_url, gotv_url, maps_data, team1_players, team2_players
                 ) VALUES (
                    'custom', $1, $2, NULL,
                    NULL, NULL, $3, $4,
                    1, 1, 1,
                    'scheduled', NOW(),
                    $5, $6, $7::jsonb, $8::jsonb, $9::jsonb
                 ) RETURNING id`,
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

            // Привязываем лобби к матчу
            await client.query('UPDATE admin_match_lobbies SET match_id = $1 WHERE id = $2', [newMatchId, lobbyId]);

            console.log(`⏱️ [T+${Date.now()-T0}ms] Коммит транзакции`);
            await client.query('COMMIT');
            
            console.log(`⏱️ [T+${Date.now()-T0}ms] Возвращаем ответ клиенту`);
            return res.json({ success: true, completed: true, config_json_url: publicUrl, matchid, maplist, connect, gotv, lobby: updStatus.rows[0], match_id: newMatchId, match_status: 'scheduled' });
        } else {
            const upd = await client.query(
                `UPDATE admin_match_lobbies SET current_turn_team = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
                [next.teamId, lobbyId]
            );
            await client.query('COMMIT');
            console.log('[SELECT-MAP] success (not completed)', { nextTeam: next.teamId });
            return res.json({ success: true, completed: false, lobby: upd.rows[0], selections: await client.query('SELECT * FROM admin_map_selections WHERE lobby_id = $1 ORDER BY action_order', [lobbyId]).then(r => r.rows) });
        }
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ [SELECT-MAP] error', e.message, e.stack);
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
        // Переименовываем команды на «<ник_капитана>__team» при старте пик/бан
        const capRes = await client.query(
            `SELECT i.team, u.username
             FROM admin_lobby_invitations i
             JOIN users u ON u.id = i.user_id
             WHERE i.lobby_id = $1 AND i.accepted = TRUE AND i.team IN (1,2)
             ORDER BY i.team, COALESCE(i.team_position, 0) ASC, i.id ASC`,
            [lobbyId]
        );
        let team1Captain = null;
        let team2Captain = null;
        for (const row of capRes.rows) {
            if (row.team === 1 && !team1Captain) team1Captain = row.username;
            if (row.team === 2 && !team2Captain) team2Captain = row.username;
        }
        const team1Name = team1Captain ? `${team1Captain}_team` : (lobby.team1_name || 'Команда 1');
        const team2Name = team2Captain ? `${team2Captain}_team` : (lobby.team2_name || 'Команда 2');
        const fp = firstPicker === 1 || firstPicker === 2 ? firstPicker : (Math.random() < 0.5 ? 1 : 2);
        const upd = await client.query(
            `UPDATE admin_match_lobbies SET status = 'picking', first_picker_team = $1, current_turn_team = $1, team1_name = $3, team2_name = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
            [fp, lobbyId, team1Name, team2Name]
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

// Завершить кастомный матч: записать итоговый счёт и завершить, уведомить лобби
router.post('/match-lobby/:lobbyId/complete', authenticateToken, async (req, res) => {
    const { lobbyId } = req.params;
    const { score1, score2, winner_team_id } = req.body || {};
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const r = await client.query('SELECT match_id, created_by FROM admin_match_lobbies WHERE id = $1 FOR UPDATE', [lobbyId]);
        if (r.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, error: 'Лобби не найдено' }); }
        const isAdmin = req.user.role === 'admin' || Number(r.rows[0].created_by) === Number(req.user.id);
        if (!isAdmin) { await client.query('ROLLBACK'); return res.status(403).json({ success: false, error: 'Недостаточно прав' }); }
        const matchId = r.rows[0].match_id;
        if (!matchId) { await client.query('ROLLBACK'); return res.status(400).json({ success: false, error: 'Матч ещё не создан' }); }
        await client.query(
            `UPDATE matches SET score1 = $1, score2 = $2, winner_id = $3, status = 'completed' WHERE id = $4`,
            [Number(score1) || 0, Number(score2) || 0, winner_team_id || null, matchId]
        );
        await client.query(`UPDATE admin_match_lobbies SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [lobbyId]);
        await client.query('COMMIT');
        return res.json({ success: true, match_id: matchId, status: 'completed' });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('complete custom match error', e);
        return res.status(500).json({ success: false, error: 'Failed to complete match' });
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

// Очистить лобби (админ или создатель)
router.post('/match-lobby/:lobbyId/clear', authenticateToken, async (req, res) => {
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
        const isCreator = Number(r.rows[0].created_by) === Number(userId);
        if (!(req.user.role === 'admin' || isCreator)) {
            await client.query('ROLLBACK');
            return res.status(403).json({ success: false, error: 'Нет прав на очистку лобби' });
        }
        await client.query('DELETE FROM admin_map_selections WHERE lobby_id = $1', [lobbyId]);
        await client.query('DELETE FROM admin_lobby_invitations WHERE lobby_id = $1', [lobbyId]);
        await client.query('DELETE FROM admin_lobby_presence WHERE lobby_id = $1', [lobbyId]);
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

// ============================================================================
// 🛡️ АНТИЧИТ: УПРАВЛЕНИЕ TRUST SCORES
// ============================================================================

/**
 * GET /api/admin/trust-scores
 * Получить список всех Trust Scores пользователей (только для админов)
 */
router.get('/trust-scores', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { 
            limit = 100, 
            offset = 0, 
            sort = 'score_asc', 
            action = null 
        } = req.query;
        
        // Построение запроса с фильтрами
        let orderBy = 'uts.trust_score ASC, uts.checked_at DESC';
        
        switch (sort) {
            case 'score_desc':
                orderBy = 'uts.trust_score DESC';
                break;
            case 'score_asc':
                orderBy = 'uts.trust_score ASC';
                break;
            case 'recent':
                orderBy = 'uts.checked_at DESC';
                break;
            case 'oldest':
                orderBy = 'uts.checked_at ASC';
                break;
        }
        
        let whereClause = '';
        const queryParams = [];
        
        if (action) {
            whereClause = 'WHERE uts.trust_action = $3';
            queryParams.push(parseInt(limit), parseInt(offset), action);
        } else {
            queryParams.push(parseInt(limit), parseInt(offset));
        }
        
        const query = `
            SELECT 
                uts.*,
                u.username,
                u.email,
                u.is_banned,
                u.ban_reason,
                u.banned_at,
                u.created_at as user_created_at,
                u.steam_url
            FROM user_trust_scores uts
            JOIN users u ON u.id = uts.user_id
            ${whereClause}
            ORDER BY ${orderBy}
            LIMIT $1 OFFSET $2
        `;
        
        const result = await pool.query(query, queryParams);
        
        // Получить общее количество
        const countQuery = action 
            ? 'SELECT COUNT(*) FROM user_trust_scores WHERE trust_action = $1'
            : 'SELECT COUNT(*) FROM user_trust_scores';
        
        const countResult = await pool.query(
            countQuery, 
            action ? [action] : []
        );
        
        const total = parseInt(countResult.rows[0].count);
        
        res.json({
            success: true,
            data: result.rows,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                has_more: (parseInt(offset) + parseInt(limit)) < total
            }
        });
        
    } catch (error) {
        console.error('❌ [Admin] Ошибка получения Trust Scores:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch trust scores' 
        });
    }
});

/**
 * GET /api/admin/trust-scores/stats
 * Получить статистику по Trust Scores (только для админов)
 */
router.get('/trust-scores/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const statsQuery = `
            SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN trust_action = 'HARD_BAN' THEN 1 END) as hard_bans,
                COUNT(CASE WHEN trust_action = 'SOFT_BAN' THEN 1 END) as soft_bans,
                COUNT(CASE WHEN trust_action = 'WATCH_LIST' THEN 1 END) as watch_list,
                COUNT(CASE WHEN trust_action = 'NORMAL' THEN 1 END) as normal,
                COUNT(CASE WHEN trust_action = 'TRUSTED' THEN 1 END) as trusted,
                AVG(trust_score)::INTEGER as avg_score,
                MIN(trust_score) as min_score,
                MAX(trust_score) as max_score,
                COUNT(CASE WHEN vac_bans > 0 THEN 1 END) as users_with_vac,
                COUNT(CASE WHEN game_bans > 0 THEN 1 END) as users_with_game_bans
            FROM user_trust_scores
        `;
        
        const result = await pool.query(statsQuery);
        
        // Получить количество забаненных пользователей
        const bannedQuery = `
            SELECT COUNT(*) as banned_users
            FROM users
            WHERE is_banned = true
        `;
        
        const bannedResult = await pool.query(bannedQuery);
        
        res.json({
            success: true,
            stats: {
                ...result.rows[0],
                banned_users: parseInt(bannedResult.rows[0].banned_users)
            }
        });
        
    } catch (error) {
        console.error('❌ [Admin] Ошибка получения статистики Trust Scores:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch trust scores statistics' 
        });
    }
});

/**
 * POST /api/admin/trust-scores/:userId/recheck
 * Принудительно перепроверить Trust Score пользователя (только для админов)
 */
router.post('/trust-scores/:userId/recheck', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Получить Steam ID пользователя
        const userResult = await pool.query(
            'SELECT id, username, steam_id FROM users WHERE id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }
        
        const user = userResult.rows[0];
        
        if (!user.steam_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'User does not have Steam ID' 
            });
        }
        
        // Перепроверить Trust Score
        const { verifyUserSteamAccount } = require('../services/antiCheat');
        const trustResult = await verifyUserSteamAccount(user.steam_id, user.id);
        
        console.log(`✅ [Admin] Trust Score rechecked for user ${userId}: ${trustResult.score}/100`);
        
        // Если Trust Score критически низкий, предлагаем забанить
        if (trustResult.action === 'HARD_BAN' && !user.is_banned) {
            await pool.query(
                'UPDATE users SET is_banned = true, ban_reason = $1, banned_at = NOW() WHERE id = $2',
                [trustResult.reason, userId]
            );
            
            console.log(`❌ [Admin] User ${userId} auto-banned due to Trust Score recheck`);
        }
        
        res.json({
            success: true,
            trust_result: trustResult,
            user: {
                id: user.id,
                username: user.username,
                steam_id: user.steam_id
            }
        });
        
    } catch (error) {
        console.error('❌ [Admin] Ошибка перепроверки Trust Score:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to recheck trust score' 
        });
    }
});

/**
 * POST /api/admin/users/:userId/ban
 * Забанить пользователя вручную (только для админов)
 */
router.post('/users/:userId/ban', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body;
        
        if (!reason) {
            return res.status(400).json({ 
                success: false, 
                error: 'Ban reason is required' 
            });
        }
        
        await pool.query(
            'UPDATE users SET is_banned = true, ban_reason = $1, banned_at = NOW() WHERE id = $2',
            [reason, userId]
        );
        
        console.log(`❌ [Admin] User ${userId} banned manually by admin ${req.user.id}. Reason: ${reason}`);
        
        res.json({
            success: true,
            message: 'User banned successfully'
        });
        
    } catch (error) {
        console.error('❌ [Admin] Ошибка бана пользователя:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to ban user' 
        });
    }
});

/**
 * POST /api/admin/users/:userId/unban
 * Разбанить пользователя (только для админов)
 */
router.post('/users/:userId/unban', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        
        await pool.query(
            'UPDATE users SET is_banned = false, ban_reason = NULL, banned_at = NULL WHERE id = $1',
            [userId]
        );
        
        console.log(`✅ [Admin] User ${userId} unbanned by admin ${req.user.id}`);
        
        res.json({
            success: true,
            message: 'User unbanned successfully'
        });
        
    } catch (error) {
        console.error('❌ [Admin] Ошибка разбана пользователя:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to unban user' 
        });
    }
});

// ============================================================================
// 🎮 MATCH FEEDBACKS: СТАТИСТИКА И SUSPICIOUS REPORTS
// ============================================================================

/**
 * GET /api/admin/suspicious-players
 * Получить список подозрительных игроков (только для админов)
 */
router.get('/suspicious-players', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { 
            min_cheating_reports = 3,
            max_reputation = 50,
            limit = 50,
            offset = 0,
            sort = 'cheating_desc'
        } = req.query;
        
        let orderBy = 'pr.cheating_reports DESC, pr.reputation_index ASC';
        
        switch (sort) {
            case 'reputation_asc':
                orderBy = 'pr.reputation_index ASC';
                break;
            case 'reputation_desc':
                orderBy = 'pr.reputation_index DESC';
                break;
            case 'cheating_desc':
                orderBy = 'pr.cheating_reports DESC, pr.reputation_index ASC';
                break;
            case 'recent':
                orderBy = 'pr.updated_at DESC';
                break;
        }
        
        const result = await pool.query(`
            SELECT 
                pr.*,
                u.username,
                u.email,
                u.steam_id,
                u.steam_url,
                u.is_banned,
                u.ban_reason,
                uts.trust_score,
                uts.trust_action
            FROM player_reputation pr
            JOIN users u ON u.id = pr.user_id
            LEFT JOIN user_trust_scores uts ON uts.user_id = pr.user_id
            WHERE pr.cheating_reports >= $1
               OR pr.reputation_index <= $2
            ORDER BY ${orderBy}
            LIMIT $3 OFFSET $4
        `, [min_cheating_reports, max_reputation, limit, offset]);
        
        // Получить детальные feedbacks для каждого
        const playersWithDetails = await Promise.all(
            result.rows.map(async (player) => {
                const recentReportsResult = await pool.query(`
                    SELECT 
                        mf.id,
                        mf.fairness_rating,
                        mf.behavior_rating,
                        u.username as reviewer_name,
                        m.id as match_id,
                        t.id as tournament_id,
                        t.name as tournament_name,
                        mf.created_at
                    FROM match_feedback mf
                    JOIN users u ON u.id = mf.reviewer_id
                    JOIN matches m ON m.id = mf.match_id
                    JOIN tournaments t ON t.id = mf.tournament_id
                    WHERE mf.reviewed_id = $1
                      AND (mf.fairness_rating IN ('suspicious', 'cheating') 
                           OR mf.behavior_rating = 'toxic')
                    ORDER BY mf.created_at DESC
                    LIMIT 10
                `, [player.user_id]);
                
                return {
                    ...player,
                    recent_negative_reports: recentReportsResult.rows
                };
            })
        );
        
        const countResult = await pool.query(`
            SELECT COUNT(*) 
            FROM player_reputation pr
            WHERE pr.cheating_reports >= $1
               OR pr.reputation_index <= $2
        `, [min_cheating_reports, max_reputation]);
        
        res.json({
            success: true,
            players: playersWithDetails,
            total: parseInt(countResult.rows[0].count),
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
        
    } catch (error) {
        console.error('❌ [Admin] Ошибка получения suspicious players:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch suspicious players' });
    }
});

/**
 * GET /api/admin/feedback-stats
 * Общая статистика по feedbacks (только для админов)
 */
router.get('/feedback-stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const feedbackStats = await pool.query(`
            SELECT 
                COUNT(*) as total_feedbacks,
                COUNT(DISTINCT reviewer_id) as active_reviewers,
                COUNT(DISTINCT reviewed_id) as players_reviewed,
                COUNT(CASE WHEN fairness_rating = 'cheating' THEN 1 END) as cheating_reports,
                COUNT(CASE WHEN fairness_rating = 'suspicious' THEN 1 END) as suspicious_reports,
                COUNT(CASE WHEN behavior_rating = 'toxic' THEN 1 END) as toxic_reports,
                COUNT(CASE WHEN created_at > CURRENT_DATE THEN 1 END) as today_feedbacks,
                AVG(coins_rewarded)::INTEGER as avg_coins_per_feedback
            FROM match_feedback
        `);
        
        const coinsStats = await pool.query(`
            SELECT 
                COALESCE(SUM(balance), 0) as total_coins_in_circulation,
                COALESCE(SUM(lifetime_earned), 0) as total_coins_earned,
                COALESCE(AVG(balance)::INTEGER, 0) as avg_balance_per_user,
                COUNT(*) as users_with_coins
            FROM user_coins
        `);
        
        const reputationStats = await pool.query(`
            SELECT 
                COUNT(*) as players_with_reputation,
                AVG(reputation_index)::INTEGER as avg_reputation,
                COUNT(CASE WHEN reputation_index >= 80 THEN 1 END) as excellent,
                COUNT(CASE WHEN reputation_index >= 60 AND reputation_index < 80 THEN 1 END) as good,
                COUNT(CASE WHEN reputation_index >= 40 AND reputation_index < 60 THEN 1 END) as average,
                COUNT(CASE WHEN reputation_index < 40 THEN 1 END) as low,
                COUNT(CASE WHEN cheating_reports >= 3 THEN 1 END) as flagged_for_cheating,
                COUNT(CASE WHEN cheating_reports >= 5 THEN 1 END) as critical_cheating
            FROM player_reputation
        `);
        
        const completionStats = await pool.query(`
            SELECT 
                COUNT(*) as total_prompts,
                COUNT(CASE WHEN feedback_given THEN 1 END) as completed,
                ROUND(100.0 * COUNT(CASE WHEN feedback_given THEN 1 END) / NULLIF(COUNT(*), 0), 2) as completion_rate
            FROM match_feedback_pending
        `);
        
        res.json({
            success: true,
            feedback: feedbackStats.rows[0],
            coins: coinsStats.rows[0],
            reputation: reputationStats.rows[0],
            completion: completionStats.rows[0]
        });
        
    } catch (error) {
        console.error('❌ [Admin] Ошибка получения статистики feedbacks:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch feedback stats' });
    }
});

// История матчей пользователя (объединённая): турнирные + кастомные
router.get('/users/:userId/matches', authenticateToken, async (req, res) => {
    const { userId } = req.params;
    const uid = Number(userId);
    if (!Number.isInteger(uid)) return res.status(400).json({ success: false, error: 'Bad userId' });
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(5, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const client = await pool.connect();
    try {
        const sql = `
            WITH custom AS (
                SELECT m.id, m.source_type, m.custom_lobby_id, m.game,
                       m.team1_name, m.team2_name, m.team1_players, m.team2_players,
                       COALESCE(m.score1, 0) AS score1, COALESCE(m.score2, 0) AS score2,
                       m.connect_url, m.gotv_url,
                       m.created_at,
                       NULL::INTEGER AS tournament_id,
                       NULL::TEXT AS tournament_name,
                       'Custom match' AS format_label
                FROM matches m
                WHERE m.source_type = 'custom'
                  AND m.winner_team_id IS NOT NULL
                  AND (
                        EXISTS (
                            SELECT 1 FROM jsonb_array_elements(m.team1_players) AS p
                            WHERE (p->>'user_id')::int = $1
                        ) OR EXISTS (
                            SELECT 1 FROM jsonb_array_elements(m.team2_players) AS p
                            WHERE (p->>'user_id')::int = $1
                        )
                  )
            ), tour AS (
                SELECT m.id, m.source_type, m.custom_lobby_id, m.game,
                       t.name AS team1_name, t2.name AS team2_name,
                       NULL::jsonb AS team1_players, NULL::jsonb AS team2_players,
                       COALESCE(m.score1, 0) AS score1, COALESCE(m.score2, 0) AS score2,
                       m.connect_url, m.gotv_url,
                       m.created_at,
                       m.tournament_id,
                       tn.name AS tournament_name,
                       'Tournament' AS format_label
                FROM matches m
                LEFT JOIN tournament_teams t ON t.id = m.team1_id
                LEFT JOIN tournament_teams t2 ON t2.id = m.team2_id
                LEFT JOIN tournaments tn ON tn.id = m.tournament_id
                WHERE m.source_type = 'tournament'
                  AND m.winner_team_id IS NOT NULL
                  AND (
                       m.team1_id IN (
                            SELECT team_id FROM tournament_team_members WHERE user_id = $1
                       ) OR m.team2_id IN (
                            SELECT team_id FROM tournament_team_members WHERE user_id = $1
                       )
                  )
            ), pms AS (
                SELECT m.id, m.source_type, m.custom_lobby_id, m.game,
                       COALESCE(m.team1_name, t.name) AS team1_name,
                       COALESCE(m.team2_name, t2.name) AS team2_name,
                       NULL::jsonb AS team1_players, NULL::jsonb AS team2_players,
                       COALESCE(m.score1, 0) AS score1, COALESCE(m.score2, 0) AS score2,
                       m.connect_url, m.gotv_url,
                       m.created_at,
                       m.tournament_id,
                       tn.name AS tournament_name,
                       CASE WHEN m.source_type = 'custom' THEN 'Custom match' ELSE 'Tournament' END AS format_label
                FROM player_match_stats p
                JOIN matches m ON m.id = p.match_id
                LEFT JOIN tournament_teams t ON t.id = m.team1_id
                LEFT JOIN tournament_teams t2 ON t2.id = m.team2_id
                LEFT JOIN tournaments tn ON tn.id = m.tournament_id
                WHERE p.user_id = $1
                  AND m.winner_team_id IS NOT NULL
            )
            SELECT * FROM (
                SELECT * FROM custom
                UNION
                SELECT * FROM tour
                UNION
                SELECT * FROM pms
            ) u
            ORDER BY created_at DESC NULLS LAST
            LIMIT $2 OFFSET $3`;
        const r = await client.query(sql, [uid, limit, offset]);
        return res.json({ success: true, items: r.rows, page, limit });
    } catch (e) {
        console.error('user matches error', e);
        return res.status(500).json({ success: false, error: 'Failed to load user matches' });
    } finally {
        client.release();
    }
});

module.exports = router;