const InviteRepository = require('../../repositories/tournament/InviteRepository');
const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
const ParticipantService = require('./ParticipantService');
const { logTournamentEvent } = require('../../utils/tournament/logger');

/**
 * Сервис для работы с инвайт-ссылками турниров
 */
class InviteService {
    /**
     * Создание новой инвайт-ссылки
     */
    static async createInvite(tournamentId, userId, options = {}) {
        const { max_uses = null, expires_in_days = null } = options;

        // Проверяем права доступа
        const hasAccess = await this._checkCreateAccess(tournamentId, userId);
        if (!hasAccess) {
            throw new Error('У вас нет прав для создания приглашений в этот турнир');
        }

        // Проверяем, что турнир закрытый
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }

        if (tournament.access_type !== 'closed') {
            throw new Error('Инвайт-ссылки доступны только для закрытых турниров');
        }

        // Вычисляем дату истечения
        let expires_at = null;
        if (expires_in_days && expires_in_days > 0) {
            expires_at = new Date();
            expires_at.setDate(expires_at.getDate() + expires_in_days);
        }

        // Создаем инвайт
        const invite = await InviteRepository.create({
            tournament_id: tournamentId,
            created_by: userId,
            max_uses,
            expires_at
        });

        // Логируем событие
        await logTournamentEvent(tournamentId, userId, 'invite_created', {
            invite_id: invite.id,
            invite_code: invite.invite_code,
            max_uses,
            expires_at
        });

        return invite;
    }

    /**
     * Получение инвайта по коду с проверкой валидности
     */
    static async getInviteByCode(inviteCode) {
        const validation = await InviteRepository.isValid(inviteCode);
        
        if (!validation.valid) {
            return { valid: false, reason: validation.reason };
        }

        return { valid: true, invite: validation.invite };
    }

    /**
     * Проверка и валидация инвайта (БЕЗ записи использования)
     */
    static async validateInvite(inviteCode, userId) {
        // Валидация инвайта
        const validation = await InviteRepository.isValid(inviteCode);
        
        if (!validation.valid) {
            const errorMessages = {
                'INVITE_NOT_FOUND': 'Приглашение не найдено',
                'INVITE_INACTIVE': 'Приглашение деактивировано',
                'INVITE_EXPIRED': 'Срок действия приглашения истек',
                'INVITE_MAX_USES_REACHED': 'Достигнуто максимальное количество использований',
                'TOURNAMENT_NOT_ACTIVE': 'Турнир неактивен'
            };
            
            throw new Error(errorMessages[validation.reason] || 'Приглашение недействительно');
        }

        const invite = validation.invite;

        // Проверяем, не участвует ли пользователь уже в турнире
        const ParticipantRepository = require('../../repositories/tournament/ParticipantRepository');
        const pool = require('../../db');
        
        // Для командных турниров проверяем членство в командах
        const tournament = await (require('../../repositories/tournament/TournamentRepository')).getById(invite.tournament_id);
        
        if (tournament.participant_type === 'team') {
            const teamMemberCheck = await pool.query(`
                SELECT ttm.id 
                FROM tournament_team_members ttm
                JOIN tournament_teams tt ON ttm.team_id = tt.id
                WHERE tt.tournament_id = $1 AND ttm.user_id = $2
                LIMIT 1
            `, [invite.tournament_id, userId]);
            
            if (teamMemberCheck.rows.length > 0) {
                throw new Error('Вы уже участвуете в этом турнире');
            }
        } else {
            const existingParticipation = await ParticipantRepository.getUserParticipation(
                invite.tournament_id,
                userId
            );

            if (existingParticipation) {
                throw new Error('Вы уже участвуете в этом турнире');
            }
        }

        return {
            success: true,
            invite,
            tournament: {
                id: invite.tournament_id,
                name: invite.tournament_name,
                participant_type: invite.participant_type
            }
        };
    }

    /**
     * Использование инвайта (только валидация)
     */
    static async useInvite(inviteCode, userId, username, ipAddress = null) {
        console.log(`🔍 [InviteService] Валидация инвайта ${inviteCode} для пользователя ${userId}`);
        
        // Просто валидируем инвайт, НЕ записываем использование
        const result = await this.validateInvite(inviteCode, userId);

        // Проверяем, не было ли недавно записи валидации (защита от спама)
        const pool = require('../../db');
        const recentValidation = await pool.query(
            `SELECT 1 FROM tournament_events 
             WHERE tournament_id = $1 
             AND user_id = $2 
             AND event_type = 'invite_validated'
             AND created_at > NOW() - INTERVAL '10 seconds'
             LIMIT 1`,
            [result.invite.tournament_id, userId]
        );

        // Логируем событие валидации только если не было недавней записи
        if (recentValidation.rows.length === 0) {
            await logTournamentEvent(result.invite.tournament_id, userId, 'invite_validated', {
                invite_id: result.invite.id,
                invite_code: inviteCode,
                user_username: username
            });
            console.log(`✅ [InviteService] Событие валидации записано`);
        } else {
            console.log(`⚠️ [InviteService] Пропускаем повторную запись валидации (была менее 10 сек назад)`);
        }

        return result;
    }

    /**
     * Подтверждение использования инвайта (вызывается ПОСЛЕ успешного вступления)
     */
    static async confirmInviteUse(inviteCode, userId, ipAddress = null) {
        const invite = await InviteRepository.getByCode(inviteCode);
        
        if (!invite) {
            console.warn('⚠️ Инвайт не найден для подтверждения использования');
            return { success: false };
        }

        // Записываем использование инвайта
        const useResult = await InviteRepository.useInvite(invite.id, userId, ipAddress);
        
        if (useResult.success) {
            // Логируем событие
            await logTournamentEvent(invite.tournament_id, userId, 'invite_confirmed', {
                invite_id: invite.id,
                invite_code: inviteCode
            });
        }

        return useResult;
    }

    /**
     * Получение всех инвайтов турнира
     */
    static async getTournamentInvites(tournamentId, userId) {
        // Проверяем права доступа
        const hasAccess = await this._checkViewAccess(tournamentId, userId);
        if (!hasAccess) {
            throw new Error('У вас нет прав для просмотра приглашений этого турнира');
        }

        return await InviteRepository.getByTournament(tournamentId);
    }

    /**
     * Деактивация инвайта
     */
    static async deactivateInvite(inviteId, userId) {
        const invite = await InviteRepository.getByCode(
            (await InviteRepository.getById(inviteId))?.invite_code
        );

        if (!invite) {
            throw new Error('Приглашение не найдено');
        }

        // Проверяем права доступа
        const hasAccess = await this._checkManageAccess(invite.tournament_id, userId);
        if (!hasAccess) {
            throw new Error('У вас нет прав для управления этим приглашением');
        }

        const deactivated = await InviteRepository.deactivate(inviteId);

        // Логируем событие
        await logTournamentEvent(invite.tournament_id, userId, 'invite_deactivated', {
            invite_id: inviteId
        });

        return deactivated;
    }

    /**
     * Удаление инвайта
     */
    static async deleteInvite(inviteId, userId) {
        const invite = await InviteRepository.getById(inviteId);

        if (!invite) {
            throw new Error('Приглашение не найдено');
        }

        // Проверяем права доступа
        const hasAccess = await this._checkManageAccess(invite.tournament_id, userId);
        if (!hasAccess) {
            throw new Error('У вас нет прав для удаления этого приглашения');
        }

        const deleted = await InviteRepository.delete(inviteId);

        // Логируем событие
        await logTournamentEvent(invite.tournament_id, userId, 'invite_deleted', {
            invite_id: inviteId
        });

        return deleted;
    }

    /**
     * Проверка прав на создание инвайтов
     */
    static async _checkCreateAccess(tournamentId, userId) {
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) return false;

        // Создатель турнира может создавать инвайты
        if (tournament.created_by === userId) return true;

        // Проверяем, является ли пользователь администратором турнира
        const admins = await TournamentRepository.getAdmins(tournamentId);
        return admins.some(admin => admin.user_id === userId);
    }

    /**
     * Проверка прав на просмотр инвайтов
     */
    static async _checkViewAccess(tournamentId, userId) {
        return await this._checkCreateAccess(tournamentId, userId);
    }

    /**
     * Проверка прав на управление инвайтами
     */
    static async _checkManageAccess(tournamentId, userId) {
        return await this._checkCreateAccess(tournamentId, userId);
    }

    /**
     * Получение инвайта по ID (внутренний метод)
     */
    static async _getInviteById(inviteId) {
        const result = await InviteRepository.getById(inviteId);
        return result;
    }
}

// Добавляем метод getById для InviteRepository
InviteRepository.getById = async function(inviteId) {
    const pool = require('../../db');
    const result = await pool.query(
        'SELECT * FROM tournament_invites WHERE id = $1',
        [inviteId]
    );
    return result.rows[0] || null;
};

module.exports = InviteService;

