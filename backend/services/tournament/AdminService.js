// backend/services/tournament/AdminService.js

const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
const { logTournamentEvent } = require('../../utils/tournament/logger');
const { sendTournamentChatAnnouncement } = require('../../utils/tournament/chatHelpers');
const { sendNotification } = require('../../notifications');
const pool = require('../../db');

class AdminService {
    /**
     * Запрос на администрирование турнира
     */
    static async requestAdmin(tournamentId, userId, username) {
        console.log(`🛡️ AdminService: Запрос админки для турнира ${tournamentId} от пользователя ${userId}`);
        
        // TODO: Реализовать запрос администрирования
        throw new Error('AdminService временно недоступен. Используйте старый API.');
    }

    /**
     * Ответ на запрос администрирования
     */
    static async respondToAdminRequest(tournamentId, requesterId, action, userId) {
        console.log(`✅ AdminService: Ответ на запрос админки для турнира ${tournamentId}`);
        
        // TODO: Реализовать ответ на запрос
        throw new Error('AdminService временно недоступен. Используйте старый API.');
    }

    /**
     * Удаление администратора
     */
    static async removeAdmin(tournamentId, adminUserId, requesterId) {
        console.log(`🗑️ AdminService: Удаление администратора ${adminUserId} из турнира ${tournamentId}`);

        // Проверяем права на удаление
        await this._checkRemoveAdminAccess(tournamentId, requesterId, adminUserId);

        // Проверяем что пользователь действительно является администратором
        const adminCheck = await pool.query(
            'SELECT * FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
            [tournamentId, adminUserId]
        );

        if (adminCheck.rows.length === 0) {
            throw new Error('Пользователь не является администратором турнира');
        }

        // Удаляем из администраторов
        await pool.query(
            'DELETE FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
            [tournamentId, adminUserId]
        );

        // Получаем данные для уведомлений
        const tournament = await TournamentRepository.getById(tournamentId);
        const removedAdmin = await pool.query('SELECT username FROM users WHERE id = $1', [adminUserId]);
        const removedUsername = removedAdmin.rows[0]?.username || 'Неизвестный';

        // Отправляем уведомление удаленному администратору
        const notificationMessage = `Вы больше не являетесь администратором турнира "${tournament.name}"`;
        await pool.query(
            'INSERT INTO notifications (user_id, message, type, tournament_id) VALUES ($1, $2, $3, $4)',
            [adminUserId, notificationMessage, 'admin_removed', tournamentId]
        );

        sendNotification(adminUserId, {
            user_id: adminUserId,
            message: notificationMessage,
            type: 'admin_removed',
            tournament_id: tournamentId,
            created_at: new Date().toISOString()
        });

        // Логируем событие
        await logTournamentEvent(tournamentId, requesterId, 'admin_removed', {
            removed_user_id: adminUserId,
            removed_username: removedUsername
        });

        console.log('✅ AdminService: Администратор успешно удален');
    }

    /**
     * Приглашение администратора турнира
     */
    static async inviteAdmin(tournamentId, inviterId, inviteeId) {
        console.log(`🛡️ AdminService: Приглашение администратора ${inviteeId} в турнир ${tournamentId}`);

        // Проверяем права приглашающего
        await this._checkInviteAdminAccess(tournamentId, inviterId);

        // Проверяем существование приглашаемого пользователя
        const userResult = await pool.query(
            'SELECT id, username FROM users WHERE id = $1',
            [inviteeId]
        );

        if (userResult.rows.length === 0) {
            throw new Error('Пользователь не найден');
        }

        const invitee = userResult.rows[0];

        // Проверяем, не является ли уже администратором
        const existingAdmin = await pool.query(
            'SELECT id FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
            [tournamentId, inviteeId]
        );

        if (existingAdmin.rows.length > 0) {
            throw new Error('Пользователь уже является администратором турнира');
        }

        // Проверяем наличие активного приглашения
        const existingInvitation = await pool.query(
            'SELECT id FROM admin_invitations WHERE tournament_id = $1 AND invitee_id = $2 AND status = $3 AND expires_at > NOW()',
            [tournamentId, inviteeId, 'pending']
        );

        if (existingInvitation.rows.length > 0) {
            throw new Error('Пользователю уже отправлено активное приглашение');
        }

        // Получаем данные турнира
        const tournament = await TournamentRepository.getById(tournamentId);

        // Создаем приглашение
        const invitationResult = await pool.query(`
            INSERT INTO admin_invitations 
            (tournament_id, inviter_id, invitee_id, permissions, expires_at) 
            VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')
            RETURNING id
        `, [
            tournamentId,
            inviterId,
            inviteeId,
            JSON.stringify({
                manage_matches: true,
                manage_participants: true,
                invite_admins: false
            })
        ]);

        const invitationId = invitationResult.rows[0].id;

        // Отправляем уведомление приглашаемому
        const notificationMessage = `Вас пригласили стать администратором турнира "${tournament.name}". Приглашение действительно 7 дней.`;
        await pool.query(
            'INSERT INTO notifications (user_id, message, type, tournament_id, admin_invitation_id) VALUES ($1, $2, $3, $4, $5)',
            [inviteeId, notificationMessage, 'admin_invitation', tournamentId, invitationId]
        );

        // Отправляем уведомление через WebSocket
        sendNotification(inviteeId, {
            user_id: inviteeId,
            message: notificationMessage,
            type: 'admin_invitation',
            tournament_id: tournamentId,
            admin_invitation_id: invitationId,
            created_at: new Date().toISOString()
        });

        // Логируем событие
        await logTournamentEvent(tournamentId, inviterId, 'admin_invited', {
            invitee_id: inviteeId,
            invitee_username: invitee.username,
            invitation_id: invitationId
        });

        console.log('✅ AdminService: Приглашение администратора отправлено');
        return {
            message: `Приглашение отправлено пользователю ${invitee.username}`,
            invitationId
        };
    }

    /**
     * Принятие приглашения администратора
     */
    static async acceptAdminInvitation(tournamentId, userId) {
        console.log(`🤝 AdminService: Принятие приглашения администратора ${userId} в турнир ${tournamentId}`);

        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Находим активное приглашение
            const invitationResult = await client.query(`
                SELECT ai.*, t.name as tournament_name, t.created_by
                FROM admin_invitations ai
                JOIN tournaments t ON ai.tournament_id = t.id
                WHERE ai.tournament_id = $1 
                AND ai.invitee_id = $2 
                AND ai.status = 'pending' 
                AND ai.expires_at > NOW()
            `, [tournamentId, userId]);

            if (invitationResult.rows.length === 0) {
                throw new Error('Активное приглашение не найдено или истекло');
            }

            const invitation = invitationResult.rows[0];

            // Проверяем, не является ли уже администратором
            const existingAdmin = await client.query(
                'SELECT id FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
                [tournamentId, userId]
            );

            if (existingAdmin.rows.length === 0) {
                // Добавляем пользователя в администраторы
                await client.query(
                    'INSERT INTO tournament_admins (tournament_id, user_id, permissions, assigned_by, assigned_at) VALUES ($1, $2, $3, $4, NOW())',
                    [
                        tournamentId, 
                        userId, 
                        invitation.permissions || JSON.stringify({manage_matches: true, manage_participants: true, invite_admins: false}),
                        invitation.inviter_id
                    ]
                );
            }

            // Обновляем статус приглашения
            await client.query(
                'UPDATE admin_invitations SET status = $1, responded_at = NOW() WHERE id = $2',
                ['accepted', invitation.id]
            );

            await client.query('COMMIT');

            // Получаем имя пользователя
            const user = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
            const username = user.rows[0]?.username || 'Неизвестный';

            // Отправляем уведомление создателю турнира
            const creatorNotification = `${username} принял приглашение стать администратором турнира "${invitation.tournament_name}"`;
            await pool.query(
                'INSERT INTO notifications (user_id, message, type, tournament_id) VALUES ($1, $2, $3, $4)',
                [invitation.created_by, creatorNotification, 'admin_accepted', tournamentId]
            );

            sendNotification(invitation.created_by, {
                user_id: invitation.created_by,
                message: creatorNotification,
                type: 'admin_accepted',
                tournament_id: tournamentId,
                created_at: new Date().toISOString()
            });

            // Отправляем объявление в чат турнира
            await sendTournamentChatAnnouncement(
                tournamentId,
                `${username} стал администратором турнира "${invitation.tournament_name}"`
            );

            // Логируем событие
            await logTournamentEvent(tournamentId, userId, 'admin_invitation_accepted', {
                admin_username: username
            });

            console.log('✅ AdminService: Приглашение администратора принято');
            return {
                message: 'Вы успешно стали администратором турнира',
                tournament_name: invitation.tournament_name
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Отклонение приглашения администратора
     */
    static async declineAdminInvitation(tournamentId, userId) {
        console.log(`❌ AdminService: Отклонение приглашения администратора ${userId} в турнир ${tournamentId}`);

        // Находим активное приглашение
        const invitationResult = await pool.query(`
            SELECT ai.*, t.name as tournament_name, t.created_by, u.username as inviter_username
            FROM admin_invitations ai
            JOIN tournaments t ON ai.tournament_id = t.id
            JOIN users u ON ai.inviter_id = u.id
            WHERE ai.tournament_id = $1 
            AND ai.invitee_id = $2 
            AND ai.status = 'pending' 
            AND ai.expires_at > NOW()
        `, [tournamentId, userId]);

        if (invitationResult.rows.length === 0) {
            throw new Error('Активное приглашение не найдено или истекло');
        }

        const invitation = invitationResult.rows[0];

        // Обновляем статус приглашения
        await pool.query(
            'UPDATE admin_invitations SET status = $1, responded_at = NOW() WHERE id = $2',
            ['declined', invitation.id]
        );

        // Получаем имя отклонившего
        const user = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
        const username = user.rows[0]?.username || 'Неизвестный';

        // Отправляем уведомление создателю турнира
        const creatorNotification = `${username} отклонил приглашение стать администратором турнира "${invitation.tournament_name}"`;
        await pool.query(
            'INSERT INTO notifications (user_id, message, type, tournament_id) VALUES ($1, $2, $3, $4)',
            [invitation.created_by, creatorNotification, 'admin_declined', tournamentId]
        );

        sendNotification(invitation.created_by, {
            user_id: invitation.created_by,
            message: creatorNotification,
            type: 'admin_declined',
            tournament_id: tournamentId,
            created_at: new Date().toISOString()
        });

        // Логируем событие
        await logTournamentEvent(tournamentId, userId, 'admin_invitation_declined', {
            declined_username: username,
            invitation_id: invitation.id
        });

        console.log('✅ AdminService: Приглашение администратора отклонено');
        return {
            message: 'Приглашение отклонено',
            tournament_name: invitation.tournament_name
        };
    }

    /**
     * Получение списка администраторов турнира
     */
    static async getAdmins(tournamentId) {
        console.log(`📋 AdminService: Получение администраторов турнира ${tournamentId}`);

        const adminResult = await pool.query(`
            SELECT 
                ta.user_id,
                ta.permissions,
                ta.assigned_at,
                u.username,
                u.avatar_url,
                u.email
            FROM tournament_admins ta
            JOIN users u ON ta.user_id = u.id
            WHERE ta.tournament_id = $1
            ORDER BY ta.assigned_at ASC
        `, [tournamentId]);

        return adminResult.rows;
    }

    /**
     * Получение приглашений администраторов
     */
    static async getAdminInvitations(tournamentId) {
        console.log(`📧 AdminService: Получение приглашений администраторов турнира ${tournamentId}`);

        const invitationsResult = await pool.query(`
            SELECT 
                ai.*,
                u_inviter.username as inviter_username,
                u_invitee.username as invitee_username,
                u_invitee.avatar_url as invitee_avatar
            FROM admin_invitations ai
            JOIN users u_inviter ON ai.inviter_id = u_inviter.id
            JOIN users u_invitee ON ai.invitee_id = u_invitee.id
            WHERE ai.tournament_id = $1
            ORDER BY ai.created_at DESC
        `, [tournamentId]);

        return invitationsResult.rows;
    }

    /**
     * Проверка прав на приглашение администраторов
     * @private
     */
    static async _checkInviteAdminAccess(tournamentId, userId) {
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }

        // Только создатель турнира может приглашать администраторов
        if (tournament.created_by !== userId) {
            throw new Error('Только создатель турнира может приглашать администраторов');
        }
    }

    /**
     * Проверка прав на удаление администратора
     * @private
     */
    static async _checkRemoveAdminAccess(tournamentId, requesterId, adminUserId) {
        if (requesterId === adminUserId) {
            throw new Error('Нельзя удалить самого себя из администраторов');
        }

        await this._checkInviteAdminAccess(tournamentId, requesterId);
    }

    /**
     * Получение статуса запроса на администрирование
     */
    static async getAdminRequestStatus(tournamentId, userId) {
        console.log(`📊 AdminService: Получение статуса запроса администрирования для турнира ${tournamentId}, пользователь ${userId}`);
        
        // Проверяем, является ли пользователь уже администратором
        const isAdmin = await TournamentRepository.isAdmin(tournamentId, userId);
        if (isAdmin) {
            return 'accepted';
        }
        
        // Проверяем запрос на администрирование
        const requestResult = await pool.query(
            'SELECT status FROM admin_requests WHERE tournament_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1',
            [tournamentId, userId]
        );
        
        if (requestResult.rows.length > 0) {
            return requestResult.rows[0].status;
        }
        
        return null;
    }

    /**
     * Очистка истекших приглашений
     */
    static async cleanupExpiredInvitations() {
        console.log(`🧹 AdminService: Очистка истекших приглашений администраторов`);
        
        const result = await pool.query(
            'UPDATE admin_invitations SET status = $1 WHERE status = $2 AND expires_at <= NOW()',
            ['expired', 'pending']
        );
        
        const expiredCount = result.rowCount;
        console.log(`✅ Очищено ${expiredCount} истекших приглашений`);
        
        return {
            success: true,
            message: `Очищено ${expiredCount} истекших приглашений`,
            expiredCount: expiredCount
        };
    }

    /**
     * Получение статистики приглашений администраторов
     */
    static async getInvitationStats() {
        console.log(`📈 AdminService: Получение статистики приглашений администраторов`);
        
        // Статистика по статусам
        const statsResult = await pool.query(`
            SELECT 
                status,
                COUNT(*) as count,
                COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired_count
            FROM admin_invitations 
            GROUP BY status
            ORDER BY status
        `);
        
        // Общая статистика
        const totalResult = await pool.query('SELECT COUNT(*) as total FROM admin_invitations');
        const activeResult = await pool.query(`
            SELECT COUNT(*) as active 
            FROM admin_invitations 
            WHERE status = 'pending' AND expires_at > NOW()
        `);
        
        return {
            success: true,
            stats: {
                total: parseInt(totalResult.rows[0].total),
                active: parseInt(activeResult.rows[0].active),
                by_status: statsResult.rows.map(row => ({
                    status: row.status,
                    count: parseInt(row.count),
                    expired_count: parseInt(row.expired_count)
                }))
            }
        };
    }
}

module.exports = AdminService; 