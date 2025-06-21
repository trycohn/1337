const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Настройка multer для загрузки аватаров команд
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/team-avatars');
        try {
            await fs.mkdir(uploadPath, { recursive: true });
            cb(null, uploadPath);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'team_' + req.user.id + '_' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Неподдерживаемый тип файла'));
        }
    }
});

// Получить все команды пользователя
router.get('/my-teams', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const query = `
            SELECT 
                ut.id,
                ut.name,
                ut.description,
                ut.captain_id,
                ut.avatar_url,
                ut.is_permanent,
                ut.tournament_id,
                ut.created_at,
                CASE WHEN ut.captain_id = $1 THEN true ELSE false END as is_captain,
                (
                    SELECT COUNT(*) 
                    FROM user_team_members utm 
                    WHERE utm.team_id = ut.id
                ) as member_count,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', utm.user_id,
                            'username', u.username,
                            'avatar_url', u.avatar_url,
                            'role', utm.role,
                            'joined_at', utm.joined_at
                        ) ORDER BY utm.joined_at
                    ) FILTER (WHERE utm.user_id IS NOT NULL),
                    '[]'::json
                ) as members
            FROM user_teams ut
            LEFT JOIN user_team_members utm ON ut.id = utm.team_id
            LEFT JOIN users u ON utm.user_id = u.id
            WHERE ut.id IN (
                SELECT team_id 
                FROM user_team_members 
                WHERE user_id = $1
            )
            GROUP BY ut.id
            ORDER BY ut.created_at DESC
        `;
        
        const result = await pool.query(query, [userId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Ошибка при получении команд:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создать новую команду
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name, description, is_permanent = true, tournament_id = null } = req.body;
        const captain_id = req.user.id;
        
        // Валидация
        if (!name || name.length > 20 || name.length < 1) {
            return res.status(400).json({ error: 'Название команды должно быть от 1 до 20 символов' });
        }
        
        // Проверяем, нет ли уже команды с таким названием у пользователя
        const existingTeam = await pool.query(
            'SELECT id FROM user_teams WHERE captain_id = $1 AND name = $2',
            [captain_id, name]
        );
        
        if (existingTeam.rows.length > 0) {
            return res.status(400).json({ error: 'У вас уже есть команда с таким названием' });
        }
        
        // Создаем команду
        const teamResult = await pool.query(
            'INSERT INTO user_teams (name, description, captain_id, is_permanent, tournament_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, description, captain_id, is_permanent, tournament_id]
        );
        
        const team = teamResult.rows[0];
        
        // Добавляем капитана как участника команды
        await pool.query(
            'INSERT INTO user_team_members (team_id, user_id, role) VALUES ($1, $2, $3)',
            [team.id, captain_id, 'captain']
        );
        
        // Получаем полную информацию о команде
        const fullTeamInfo = await pool.query(`
            SELECT 
                ut.*,
                true as is_captain,
                1 as member_count,
                json_agg(
                    json_build_object(
                        'id', u.id,
                        'username', u.username,
                        'avatar_url', u.avatar_url,
                        'role', 'captain',
                        'joined_at', NOW()
                    )
                ) as members
            FROM user_teams ut
            LEFT JOIN users u ON u.id = ut.captain_id
            WHERE ut.id = $1
            GROUP BY ut.id
        `, [team.id]);
        
        res.status(201).json(fullTeamInfo.rows[0]);
    } catch (error) {
        console.error('Ошибка при создании команды:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Загрузить аватар команды
router.post('/:teamId/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
    try {
        const { teamId } = req.params;
        const userId = req.user.id;
        
        // Проверяем, является ли пользователь капитаном команды
        const team = await pool.query(
            'SELECT * FROM user_teams WHERE id = $1 AND captain_id = $2',
            [teamId, userId]
        );
        
        if (team.rows.length === 0) {
            return res.status(403).json({ error: 'Только капитан команды может изменять аватар' });
        }
        
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' });
        }
        
        const avatarUrl = `/api/uploads/team-avatars/${req.file.filename}`;
        
        // Удаляем старый аватар если есть
        const oldAvatar = team.rows[0].avatar_url;
        if (oldAvatar) {
            const oldAvatarPath = path.join(__dirname, '../uploads/team-avatars', path.basename(oldAvatar));
            try {
                await fs.unlink(oldAvatarPath);
            } catch (error) {
                console.log('Старый аватар не найден или уже удален');
            }
        }
        
        // Обновляем URL аватара в базе данных
        await pool.query(
            'UPDATE user_teams SET avatar_url = $1 WHERE id = $2',
            [avatarUrl, teamId]
        );
        
        res.json({ avatar_url: avatarUrl });
    } catch (error) {
        console.error('Ошибка при загрузке аватара команды:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Пригласить пользователя в команду
router.post('/:teamId/invite', authenticateToken, async (req, res) => {
    try {
        const { teamId } = req.params;
        const { userId: invitedUserId, message } = req.body;
        const inviterId = req.user.id;
        
        // Проверяем, является ли пользователь капитаном команды
        const team = await pool.query(
            'SELECT * FROM user_teams WHERE id = $1 AND captain_id = $2',
            [teamId, inviterId]
        );
        
        if (team.rows.length === 0) {
            return res.status(403).json({ error: 'Только капитан команды может приглашать участников' });
        }
        
        // Проверяем, существует ли приглашаемый пользователь
        const invitedUser = await pool.query(
            'SELECT * FROM users WHERE id = $1',
            [invitedUserId]
        );
        
        if (invitedUser.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        // Проверяем, не является ли пользователь уже участником команды
        const existingMember = await pool.query(
            'SELECT * FROM user_team_members WHERE team_id = $1 AND user_id = $2',
            [teamId, invitedUserId]
        );
        
        if (existingMember.rows.length > 0) {
            return res.status(400).json({ error: 'Пользователь уже состоит в команде' });
        }
        
        // Проверяем, нет ли уже активного приглашения
        const existingInvitation = await pool.query(
            'SELECT * FROM user_team_invitations WHERE team_id = $1 AND invited_user_id = $2 AND status = $3',
            [teamId, invitedUserId, 'pending']
        );
        
        if (existingInvitation.rows.length > 0) {
            return res.status(400).json({ error: 'Приглашение уже отправлено' });
        }
        
        // Создаем приглашение
        const invitation = await pool.query(`
            INSERT INTO user_team_invitations (team_id, inviter_id, invited_user_id, message)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [teamId, inviterId, invitedUserId, message]);
        
        // Создаем уведомление для приглашенного пользователя
        await pool.query(`
            INSERT INTO notifications (user_id, message, type, team_invitation_id, created_at)
            VALUES ($1, $2, $3, $4, NOW())
        `, [
            invitedUserId,
            `Вас пригласили в команду "${team.rows[0].name}"`,
            'team_invitation',
            invitation.rows[0].id
        ]);
        
        res.status(201).json(invitation.rows[0]);
    } catch (error) {
        console.error('Ошибка при отправке приглашения:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Ответить на приглашение в команду
router.post('/invitations/:invitationId/respond', authenticateToken, async (req, res) => {
    try {
        const { invitationId } = req.params;
        const { status } = req.body; // 'accepted' или 'rejected'
        const userId = req.user.id;
        
        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Неверный статус ответа' });
        }
        
        // Проверяем, существует ли приглашение и предназначено ли оно для текущего пользователя
        const invitation = await pool.query(`
            SELECT uti.*, ut.name as team_name, ut.captain_id
            FROM user_team_invitations uti
            JOIN user_teams ut ON uti.team_id = ut.id
            WHERE uti.id = $1 AND uti.invited_user_id = $2 AND uti.status = 'pending'
        `, [invitationId, userId]);
        
        if (invitation.rows.length === 0) {
            return res.status(404).json({ error: 'Приглашение не найдено или уже обработано' });
        }
        
        const inv = invitation.rows[0];
        
        // Обновляем статус приглашения
        await pool.query(
            'UPDATE user_team_invitations SET status = $1, responded_at = NOW() WHERE id = $2',
            [status, invitationId]
        );
        
        if (status === 'accepted') {
            // Добавляем пользователя в команду
            await pool.query(
                'INSERT INTO user_team_members (team_id, user_id, role) VALUES ($1, $2, $3)',
                [inv.team_id, userId, 'member']
            );
            
            // Уведомляем капитана о принятии приглашения
            await pool.query(`
                INSERT INTO notifications (user_id, message, type, created_at)
                VALUES ($1, $2, $3, NOW())
            `, [
                inv.captain_id,
                `${req.user.username} принял приглашение в команду "${inv.team_name}"`,
                'team_invitation_accepted'
            ]);
        } else {
            // Уведомляем капитана об отклонении приглашения
            await pool.query(`
                INSERT INTO notifications (user_id, message, type, created_at)
                VALUES ($1, $2, $3, NOW())
            `, [
                inv.captain_id,
                `${req.user.username} отклонил приглашение в команду "${inv.team_name}"`,
                'team_invitation_rejected'
            ]);
        }
        
        res.json({ message: `Приглашение ${status === 'accepted' ? 'принято' : 'отклонено'}` });
    } catch (error) {
        console.error('Ошибка при ответе на приглашение:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить приглашения пользователя в команды
router.get('/invitations', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const invitations = await pool.query(`
            SELECT 
                uti.*,
                ut.name as team_name,
                ut.avatar_url as team_avatar,
                u.username as inviter_username,
                u.avatar_url as inviter_avatar
            FROM user_team_invitations uti
            JOIN user_teams ut ON uti.team_id = ut.id
            JOIN users u ON uti.inviter_id = u.id
            WHERE uti.invited_user_id = $1 AND uti.status = 'pending'
            ORDER BY uti.created_at DESC
        `, [userId]);
        
        res.json(invitations.rows);
    } catch (error) {
        console.error('Ошибка при получении приглашений:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Передать капитанство
router.post('/:teamId/transfer-captaincy', authenticateToken, async (req, res) => {
    try {
        const { teamId } = req.params;
        const { newCaptainId } = req.body;
        const currentCaptainId = req.user.id;
        
        // Проверяем, является ли пользователь капитаном команды
        const team = await pool.query(
            'SELECT * FROM user_teams WHERE id = $1 AND captain_id = $2',
            [teamId, currentCaptainId]
        );
        
        if (team.rows.length === 0) {
            return res.status(403).json({ error: 'Только капитан команды может передать капитанство' });
        }
        
        // Проверяем, является ли новый капитан участником команды
        const newCaptain = await pool.query(
            'SELECT * FROM user_team_members WHERE team_id = $1 AND user_id = $2',
            [teamId, newCaptainId]
        );
        
        if (newCaptain.rows.length === 0) {
            return res.status(400).json({ error: 'Новый капитан должен быть участником команды' });
        }
        
        // Начинаем транзакцию
        await pool.query('BEGIN');
        
        try {
            // Обновляем капитана команды
            await pool.query(
                'UPDATE user_teams SET captain_id = $1 WHERE id = $2',
                [newCaptainId, teamId]
            );
            
            // Обновляем роли участников
            await pool.query(
                'UPDATE user_team_members SET role = $1 WHERE team_id = $2 AND user_id = $3',
                ['member', teamId, currentCaptainId]
            );
            
            await pool.query(
                'UPDATE user_team_members SET role = $1 WHERE team_id = $2 AND user_id = $3',
                ['captain', teamId, newCaptainId]
            );
            
            await pool.query('COMMIT');
            
            // Уведомляем нового капитана
            await pool.query(`
                INSERT INTO notifications (user_id, message, type, created_at)
                VALUES ($1, $2, $3, NOW())
            `, [
                newCaptainId,
                `Вы назначены капитаном команды "${team.rows[0].name}"`,
                'team_captain_assigned'
            ]);
            
            res.json({ message: 'Капитанство успешно передано' });
        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Ошибка при передаче капитанства:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удалить участника из команды
router.delete('/:teamId/members/:userId', authenticateToken, async (req, res) => {
    try {
        const { teamId, userId } = req.params;
        const captainId = req.user.id;
        
        // Проверяем, является ли пользователь капитаном команды
        const team = await pool.query(
            'SELECT * FROM user_teams WHERE id = $1 AND captain_id = $2',
            [teamId, captainId]
        );
        
        if (team.rows.length === 0) {
            return res.status(403).json({ error: 'Только капитан команды может удалять участников' });
        }
        
        // Нельзя удалить себя (капитана)
        if (userId == captainId) {
            return res.status(400).json({ error: 'Капитан не может удалить себя из команды' });
        }
        
        // Удаляем участника
        const result = await pool.query(
            'DELETE FROM user_team_members WHERE team_id = $1 AND user_id = $2',
            [teamId, userId]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Участник не найден в команде' });
        }
        
        res.json({ message: 'Участник удален из команды' });
    } catch (error) {
        console.error('Ошибка при удалении участника:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Покинуть команду
router.post('/:teamId/leave', authenticateToken, async (req, res) => {
    try {
        const { teamId } = req.params;
        const userId = req.user.id;
        
        // Проверяем, является ли пользователь участником команды
        const membership = await pool.query(
            'SELECT * FROM user_team_members WHERE team_id = $1 AND user_id = $2',
            [teamId, userId]
        );
        
        if (membership.rows.length === 0) {
            return res.status(404).json({ error: 'Вы не состоите в этой команде' });
        }
        
        // Проверяем, не является ли пользователь капитаном
        const team = await pool.query(
            'SELECT * FROM user_teams WHERE id = $1 AND captain_id = $2',
            [teamId, userId]
        );
        
        if (team.rows.length > 0) {
            return res.status(400).json({ error: 'Капитан не может покинуть команду. Передайте капитанство другому участнику или удалите команду.' });
        }
        
        // Удаляем участника из команды
        await pool.query(
            'DELETE FROM user_team_members WHERE team_id = $1 AND user_id = $2',
            [teamId, userId]
        );
        
        res.json({ message: 'Вы покинули команду' });
    } catch (error) {
        console.error('Ошибка при выходе из команды:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удалить команду
router.delete('/:teamId', authenticateToken, async (req, res) => {
    try {
        const { teamId } = req.params;
        const captainId = req.user.id;
        
        // Проверяем, является ли пользователь капитаном команды
        const team = await pool.query(
            'SELECT * FROM user_teams WHERE id = $1 AND captain_id = $2',
            [teamId, captainId]
        );
        
        if (team.rows.length === 0) {
            return res.status(403).json({ error: 'Только капитан команды может удалить команду' });
        }
        
        // Удаляем аватар команды если есть
        if (team.rows[0].avatar_url) {
            const avatarPath = path.join(__dirname, '../uploads/team-avatars', path.basename(team.rows[0].avatar_url));
            try {
                await fs.unlink(avatarPath);
            } catch (error) {
                console.log('Аватар команды не найден или уже удален');
            }
        }
        
        // Удаляем команду (каскадное удаление удалит участников и приглашения)
        await pool.query('DELETE FROM user_teams WHERE id = $1', [teamId]);
        
        res.json({ message: 'Команда удалена' });
    } catch (error) {
        console.error('Ошибка при удалении команды:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Поиск пользователей для приглашения
router.get('/search-users', authenticateToken, async (req, res) => {
    try {
        const { query, teamId } = req.query;
        
        if (!query || query.length < 2) {
            return res.json([]);
        }
        
        // Ищем пользователей, исключая уже состоящих в команде
        const users = await pool.query(`
            SELECT id, username, avatar_url
            FROM users 
            WHERE username ILIKE $1 
            AND id != $2
            AND id NOT IN (
                SELECT user_id 
                FROM user_team_members 
                WHERE team_id = $3
            )
            AND id NOT IN (
                SELECT invited_user_id 
                FROM user_team_invitations 
                WHERE team_id = $3 AND status = 'pending'
            )
            LIMIT 10
        `, [`%${query}%`, req.user.id, teamId]);
        
        res.json(users.rows);
    } catch (error) {
        console.error('Ошибка при поиске пользователей:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить команды пользователя для участия в турнире
router.get('/for-tournament/:tournamentId', authenticateToken, async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const userId = req.user.id;
        
        // Получаем постоянные команды пользователя
        const permanentTeams = await pool.query(`
            SELECT 
                ut.id,
                ut.name,
                ut.avatar_url,
                ut.is_permanent,
                (
                    SELECT COUNT(*) 
                    FROM user_team_members utm 
                    WHERE utm.team_id = ut.id
                ) as member_count
            FROM user_teams ut
            WHERE ut.captain_id = $1 
            AND ut.is_permanent = true
            ORDER BY ut.created_at DESC
        `, [userId]);
        
        // Получаем разовые команды для этого турнира
        const temporaryTeams = await pool.query(`
            SELECT 
                ut.id,
                ut.name,
                ut.avatar_url,
                ut.is_permanent,
                (
                    SELECT COUNT(*) 
                    FROM user_team_members utm 
                    WHERE utm.team_id = ut.id
                ) as member_count
            FROM user_teams ut
            WHERE ut.captain_id = $1 
            AND ut.is_permanent = false
            AND ut.tournament_id = $2
            ORDER BY ut.created_at DESC
        `, [userId, tournamentId]);
        
        res.json({
            permanent: permanentTeams.rows,
            temporary: temporaryTeams.rows
        });
    } catch (error) {
        console.error('Ошибка при получении команд для турнира:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;