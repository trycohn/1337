const pool = require('../../db');
const crypto = require('crypto');

/**
 * Repository для работы с инвайт-ссылками турниров
 */
class InviteRepository {
    /**
     * Генерация уникального кода приглашения
     */
    static generateInviteCode() {
        return crypto.randomBytes(16).toString('hex');
    }

    /**
     * Создание новой инвайт-ссылки
     */
    static async create(inviteData) {
        const {
            tournament_id,
            created_by,
            max_uses = null,
            expires_at = null
        } = inviteData;

        const inviteCode = this.generateInviteCode();

        const result = await pool.query(
            `INSERT INTO tournament_invites 
             (tournament_id, created_by, invite_code, max_uses, expires_at)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [tournament_id, created_by, inviteCode, max_uses, expires_at]
        );

        return result.rows[0];
    }

    /**
     * Получение инвайта по коду
     */
    static async getByCode(inviteCode) {
        const result = await pool.query(
            `SELECT 
                ti.*,
                t.name as tournament_name,
                t.status as tournament_status,
                t.access_type,
                t.participant_type,
                u.username as creator_username
             FROM tournament_invites ti
             JOIN tournaments t ON ti.tournament_id = t.id
             JOIN users u ON ti.created_by = u.id
             WHERE ti.invite_code = $1`,
            [inviteCode]
        );

        return result.rows[0] || null;
    }

    /**
     * Получение всех инвайтов турнира
     */
    static async getByTournament(tournamentId) {
        const result = await pool.query(
            `SELECT 
                ti.*,
                u.username as creator_username,
                COUNT(tiu.id) as total_uses
             FROM tournament_invites ti
             JOIN users u ON ti.created_by = u.id
             LEFT JOIN tournament_invite_uses tiu ON ti.id = tiu.invite_id
             WHERE ti.tournament_id = $1
             GROUP BY ti.id, u.username
             ORDER BY ti.created_at DESC`,
            [tournamentId]
        );

        return result.rows;
    }

    /**
     * Проверка валидности инвайта
     */
    static async isValid(inviteCode) {
        const invite = await this.getByCode(inviteCode);

        if (!invite) {
            return { valid: false, reason: 'INVITE_NOT_FOUND' };
        }

        if (!invite.is_active) {
            return { valid: false, reason: 'INVITE_INACTIVE' };
        }

        // Проверка истечения срока
        if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
            return { valid: false, reason: 'INVITE_EXPIRED' };
        }

        // Проверка количества использований
        if (invite.max_uses !== null && invite.current_uses >= invite.max_uses) {
            return { valid: false, reason: 'INVITE_MAX_USES_REACHED' };
        }

        // Проверка статуса турнира
        if (invite.tournament_status !== 'active') {
            return { valid: false, reason: 'TOURNAMENT_NOT_ACTIVE' };
        }

        return { valid: true, invite };
    }

    /**
     * Использование инвайта
     */
    static async useInvite(inviteId, userId, ipAddress = null) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Проверяем, не использовал ли пользователь этот инвайт ранее
            const existingUse = await client.query(
                'SELECT id FROM tournament_invite_uses WHERE invite_id = $1 AND user_id = $2',
                [inviteId, userId]
            );

            if (existingUse.rows.length > 0) {
                await client.query('ROLLBACK');
                return { success: false, reason: 'ALREADY_USED' };
            }

            // Записываем использование
            await client.query(
                `INSERT INTO tournament_invite_uses (invite_id, user_id, ip_address)
                 VALUES ($1, $2, $3)`,
                [inviteId, userId, ipAddress]
            );

            // Увеличиваем счетчик использований
            await client.query(
                'UPDATE tournament_invites SET current_uses = current_uses + 1 WHERE id = $1',
                [inviteId]
            );

            await client.query('COMMIT');
            return { success: true };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Деактивация инвайта
     */
    static async deactivate(inviteId) {
        const result = await pool.query(
            'UPDATE tournament_invites SET is_active = FALSE WHERE id = $1 RETURNING *',
            [inviteId]
        );

        return result.rows[0] || null;
    }

    /**
     * Удаление инвайта
     */
    static async delete(inviteId) {
        const result = await pool.query(
            'DELETE FROM tournament_invites WHERE id = $1 RETURNING *',
            [inviteId]
        );

        return result.rows[0] || null;
    }

    /**
     * Проверка, использовал ли пользователь конкретный инвайт
     */
    static async hasUserUsedInvite(inviteId, userId) {
        const result = await pool.query(
            'SELECT id FROM tournament_invite_uses WHERE invite_id = $1 AND user_id = $2',
            [inviteId, userId]
        );

        return result.rows.length > 0;
    }

    /**
     * Получение статистики использования инвайта
     */
    static async getInviteStats(inviteId) {
        const result = await pool.query(
            `SELECT 
                COUNT(*) as total_uses,
                COUNT(DISTINCT user_id) as unique_users,
                MAX(used_at) as last_used_at
             FROM tournament_invite_uses
             WHERE invite_id = $1`,
            [inviteId]
        );

        return result.rows[0];
    }
}

module.exports = InviteRepository;

