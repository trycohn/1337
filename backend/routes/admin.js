const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const nodemailer = require('nodemailer');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
// =============================
//  Глобальный дефолтный маппул
// =============================

// Получить текущий дефолтный маппул (для админов)
router.get('/default-map-pool', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT map_name, display_order
             FROM default_map_pool
             ORDER BY display_order ASC, id ASC`
        );
        res.json({ success: true, maps: result.rows });
    } catch (err) {
        console.error('Ошибка получения дефолтного маппула:', err);
        res.status(500).json({ success: false, error: 'Не удалось получить дефолтный маппул' });
    }
});

// Обновить дефолтный маппул (замена всего набора)
router.put('/default-map-pool', authenticateToken, requireAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const { maps } = req.body; // ожидаем массив строк в нужном порядке
        if (!Array.isArray(maps) || maps.length === 0) {
            return res.status(400).json({ success: false, error: 'Требуется непустой массив карт' });
        }

        await client.query('BEGIN');
        await client.query('DELETE FROM default_map_pool');

        let order = 1;
        for (const raw of maps) {
            const key = String(raw).toLowerCase().replace(/^de[_-]?/, '');
            await client.query(
                `INSERT INTO default_map_pool (map_name, display_order)
                 VALUES ($1, $2)
                 ON CONFLICT (map_name) DO UPDATE SET display_order = EXCLUDED.display_order`,
                [key, order]
            );
            order += 1;
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Дефолтный маппул обновлён' });
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
    limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
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


// Middleware для проверки роли администратора
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Доступ запрещен. Требуются права администратора' });
    }
    next();
};

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

module.exports = router; 