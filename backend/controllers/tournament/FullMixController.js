const { asyncHandler } = require('../../utils/asyncHandler');
const FullMixService = require('../../services/tournament/FullMixService');

class FullMixController {
    static start = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const { wins_to_win, rating_mode } = req.body || {};
        const result = await FullMixService.start(tournamentId, req.user.id, { wins_to_win, rating_mode });
        res.json({ success: true, ...result });
    });

    static generateNext = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const result = await FullMixService.generateNextRound(tournamentId);
        res.json({ success: true, ...result });
    });

    static reshuffle = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const round = parseInt(req.params.round);
        const result = await FullMixService.reshuffleRound(tournamentId, round);
        res.json({ success: true, ...result });
    });

    static completeRound = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const { round } = req.body || {};
        const r = parseInt(round);
        const isCompleted = await FullMixService.isRoundCompleted(tournamentId, r);
        if (!isCompleted) {
            return res.status(400).json({ success: false, error: 'Раунд не может быть завершён: нет матчей или есть незавершённые матчи.' });
        }
        const result = await FullMixService.completeRound(tournamentId, r);
        res.json({ success: true, ...result });
    });

    static standings = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const standings = await FullMixService.calculateStandings(tournamentId);
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.set('Vary', 'Authorization');
        res.status(200).json({ success: true, standings });
    });

    static snapshots = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const items = await FullMixService.listSnapshots(tournamentId);

        // 🔒 Скрываем составы/матчи черновиков для не-админов
        let isAdminOrCreator = false;
        try {
            const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
            const tournament = await TournamentRepository.getById(tournamentId);
            const userId = req.user?.id;
            const isCreator = !!(userId && tournament && tournament.created_by === userId);
            let isAdmin = false;
            if (userId) {
                isAdmin = await TournamentRepository.isAdmin(tournamentId, userId);
            }
            isAdminOrCreator = isCreator || isAdmin;
        } catch (_) {
            isAdminOrCreator = false;
        }

        if (!isAdminOrCreator) {
            const sanitized = items.map(it => {
                if (it && it.approved_teams !== true) {
                    // На этом эндпоинте у нас нет payload snapshot; задача — только список, так что ничего не меняем
                    return it; // список раундов безопасен (без команд)
                }
                return it;
            });
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
            res.set('Vary', 'Authorization');
            return res.status(200).json({ success: true, items: sanitized });
        }

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.set('Vary', 'Authorization');
        res.status(200).json({ success: true, items });
    });

    static getRound = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const round = parseInt(req.params.round);
        const item = await FullMixService.getSnapshot(tournamentId, round);

        // Обогащаем снапшот именами команд для матчей (автоматически на чтении)
        try {
            if (item && item.snapshot) {
                const snap = item.snapshot;
                const matches = Array.isArray(snap.matches) ? snap.matches : [];
                const teams = Array.isArray(snap.teams) ? snap.teams : [];
                const needNames = matches.some(m => !m.team1_name || !m.team2_name);
                const teamsNeedNames = teams.some(t => !t.name);
                if (needNames || teamsNeedNames) {
                    const db = require('../../db');
                    const { rows } = await db.query(
                        `SELECT id, name FROM tournament_teams WHERE tournament_id = $1 AND (round_number = $2 OR id = ANY($3::int[]))`,
                        [tournamentId, round, matches.flatMap(m => [m.team1_id, m.team2_id]).filter(v => Number.isInteger(v))]
                    );
                    const idToName = new Map((rows || []).map(r => [r.id, r.name]));
                    // Обновляем имена команд внутри снапшота (не пишем в БД, только отдача)
                    if (teamsNeedNames) {
                        item.snapshot.teams = teams.map(t => ({
                            ...t,
                            name: t.name || idToName.get(t.team_id || t.id) || t.name || null,
                        }));
                    }
                    if (needNames) {
                        item.snapshot.matches = matches.map(m => ({
                            ...m,
                            team1_name: m.team1_name || idToName.get(m.team1_id) || null,
                            team2_name: m.team2_name || idToName.get(m.team2_id) || null,
                        }));
                    }
                }
            }
        } catch (e) {
            // Мягко игнорируем ошибки обогащения, чтобы не ломать отдачу снапшота
        }

        // 🔒 Скрываем составы/матчи черновика для не-админов до подтверждения
        if (item && item.approved_teams !== true) {
            let isAdminOrCreator = false;
            try {
                const t = await FullMixService.getSettings(tournamentId) // dummy to keep await chain
                ;
            } catch (_) {}
            try {
                const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
                const tournament = await TournamentRepository.getById(tournamentId);
                const userId = req.user?.id;
                const isCreator = !!(userId && tournament && tournament.created_by === userId);
                let isAdmin = false;
                if (userId) {
                    isAdmin = await TournamentRepository.isAdmin(tournamentId, userId);
                }
                isAdminOrCreator = isCreator || isAdmin;
            } catch (_) {
                isAdminOrCreator = false;
            }

            if (!isAdminOrCreator) {
                const cloned = { ...item };
                const snap = cloned.snapshot || {};
                cloned.snapshot = { ...snap, teams: [], matches: [] };
                res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
                res.set('Pragma', 'no-cache');
                res.set('Expires', '0');
                // публичная отдача: не варьируем по авторизации
                res.set('ETag', `W/"fm-${tournamentId}-${round}-anon-${Date.now()}"`);
                return res.status(200).json({ success: true, item: cloned });
            }
        }

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        // публичная отдача: не варьируем по авторизации
        res.set('ETag', `W/"fm-${tournamentId}-${round}-${req.user?.id || 'anon'}-${Date.now()}"`);
        res.status(200).json({ success: true, item });
    });

    static approve = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const round = parseInt(req.params.round);
        const { approveTeams, approveMatches } = req.body || {};
        const result = await FullMixService.approveRound(tournamentId, round, { approveTeams, approveMatches });
        res.json({ success: true, ...result });
    });

    static settings = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        if (req.method === 'GET') {
            const settings = await FullMixService.getSettings(tournamentId);
            return res.json({ success: true, settings });
        }
        if (req.method === 'PUT') {
            const { wins_to_win, rating_mode, current_round } = req.body || {};
            const settings = await FullMixService.upsertSettings(tournamentId, { wins_to_win, rating_mode, current_round });
            return res.json({ success: true, settings });
        }
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    });

    // ===== PREVIEW endpoints =====
    static createPreview = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const round = parseInt(req.params.round);
        const userId = req.user?.id || null;
        const { mode } = req.body || {}; // mode: 'teams' | 'matches'; default 'teams'
        // Защиты: нельзя переформировать в завершённом раунде
        const roundCompleted = await FullMixService.isRoundCompleted(tournamentId, round);
        if (roundCompleted) {
            return res.status(400).json({ success: false, error: 'Раунд завершён. Переформирование запрещено.' });
        }
        const snap = await FullMixService.getSnapshot(tournamentId, round);
        // Для SE/DE: генерим только составы для фиксированных команд, матчи не формируем
        if (await FullMixService.isSEorDEBracket(tournamentId)) {
            const standings = await FullMixService.calculateStandings(tournamentId);
            const snapshot = await FullMixService.generateRosterPreviewForFixedTeams(tournamentId, round, standings);
            const saved = await FullMixService.savePreview(tournamentId, round, snapshot, userId);
            return res.json({ success: true, item: saved });
        }
        if (mode === 'matches') {
            if (snap && snap.approved_matches === true) {
                return res.status(400).json({ success: false, error: 'Матчи уже подтверждены. Переформирование запрещено.' });
            }
            if (!snap || snap.approved_teams !== true) {
                return res.status(400).json({ success: false, error: 'Сначала подтвердите составы команд.' });
            }
            // Сгенерировать превью матчей по уже подтверждённым командам
            const mp = await FullMixService.generateMatchesPreviewFromSnapshot(tournamentId, round);
            const saved = await FullMixService.savePreview(tournamentId, round, mp, userId);
            return res.json({ success: true, item: saved });
        }
        // mode === 'teams' (или по умолчанию)
        if (snap && snap.approved_teams === true) {
            return res.status(400).json({ success: false, error: 'Составы уже подтверждены. Переформирование запрещено.' });
        }
        const settings = await FullMixService.getSettings(tournamentId);
        const standings = await FullMixService.calculateStandings(tournamentId);
        const snapshot = await FullMixService.generateRoundSnapshot(
            tournamentId,
            round,
            settings?.rating_mode || 'random',
            standings,
            { ephemeral: true }
        );
        const saved = await FullMixService.savePreview(tournamentId, round, snapshot, userId);
        res.json({ success: true, item: saved });
    });

    static getPreview = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const round = parseInt(req.params.round);
        // 🔒 Только админ/создатель имеет доступ к preview
        const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
        const tournament = await TournamentRepository.getById(tournamentId);
        const userId = req.user?.id;
        const isCreator = !!(userId && tournament && tournament.created_by === userId);
        let isAdmin = false;
        if (userId) {
            isAdmin = await TournamentRepository.isAdmin(tournamentId, userId);
        }
        const isAdminOrCreator = isCreator || isAdmin;
        if (!isAdminOrCreator) return res.status(403).json({ success: false, error: 'Forbidden' });

        const item = await FullMixService.getPreview(tournamentId, round);
        res.json({ success: true, item });
    });

    static deletePreview = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const round = parseInt(req.params.round);
        await FullMixService.deletePreview(tournamentId, round);
        res.json({ success: true });
    });

    // ===== ELIMINATED (admin endpoints) =====
    static getEliminated = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        // Формат проверки: только Full Mix
        const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
        const t = await TournamentRepository.getById(tournamentId);
        if (!t) return res.status(404).json({ success: false, error: 'Турнир не найден' });
        const mixType = (t.mix_type || '').toString().trim().toLowerCase();
        const isFullMixFormat = t.format === 'full_mix' || (t.format === 'mix' && mixType === 'full');
        if (!isFullMixFormat) return res.status(400).json({ success: false, error: 'Доступно только для Full Mix' });

        const items = await FullMixService.getEliminatedDetailed(tournamentId);
        res.json({ success: true, items });
    });

    static addEliminated = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
        const t = await TournamentRepository.getById(tournamentId);
        if (!t) return res.status(404).json({ success: false, error: 'Турнир не найден' });
        const mixType = (t.mix_type || '').toString().trim().toLowerCase();
        const isFullMixFormat = t.format === 'full_mix' || (t.format === 'mix' && mixType === 'full');
        if (!isFullMixFormat) return res.status(400).json({ success: false, error: 'Доступно только для Full Mix' });
        if (!['active', 'in_progress'].includes((t.status || '').toLowerCase())) {
            return res.status(400).json({ success: false, error: 'Операция доступна только для активного турнира' });
        }

        const { user_ids = [], participant_ids = [] } = req.body || {};
        const ids = [];
        if (Array.isArray(user_ids)) ids.push(...user_ids);
        if (Array.isArray(participant_ids)) ids.push(...participant_ids);
        if (ids.length === 0) return res.status(400).json({ success: false, error: 'Не переданы идентификаторы' });

        await FullMixService.addEliminated(tournamentId, ids);

        // Широковещательно оповестим клиентов
        try {
            const { broadcastToTournament } = require('../../socketio-server');
            broadcastToTournament(tournamentId, 'fullmix_eliminated_updated', { added: ids, removed: [] });
        } catch (_) {}
        const items = await FullMixService.getEliminatedDetailed(tournamentId);
        res.json({ success: true, items });
    });

    static deleteEliminated = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
        const t = await TournamentRepository.getById(tournamentId);
        if (!t) return res.status(404).json({ success: false, error: 'Турнир не найден' });
        const mixType = (t.mix_type || '').toString().trim().toLowerCase();
        const isFullMixFormat = t.format === 'full_mix' || (t.format === 'mix' && mixType === 'full');
        if (!isFullMixFormat) return res.status(400).json({ success: false, error: 'Доступно только для Full Mix' });

        const { user_ids = [], participant_ids = [] } = req.body || {};
        const ids = [];
        if (Array.isArray(user_ids)) ids.push(...user_ids);
        if (Array.isArray(participant_ids)) ids.push(...participant_ids);
        if (ids.length === 0) return res.status(400).json({ success: false, error: 'Не переданы идентификаторы' });

        await FullMixService.removeEliminated(tournamentId, ids);
        try {
            const { broadcastToTournament } = require('../../socketio-server');
            broadcastToTournament(tournamentId, 'fullmix_eliminated_updated', { added: [], removed: ids });
        } catch (_) {}
        const items = await FullMixService.getEliminatedDetailed(tournamentId);
        res.json({ success: true, items });
    });

    // Восстановление удалённых ранее участников в список исключённых
    static recoverEliminated = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
        const t = await TournamentRepository.getById(tournamentId);
        if (!t) return res.status(404).json({ success: false, error: 'Турнир не найден' });
        const mixType = (t.mix_type || '').toString().trim().toLowerCase();
        const isFullMixFormat = t.format === 'full_mix' || (t.format === 'mix' && mixType === 'full');
        if (!isFullMixFormat) return res.status(400).json({ success: false, error: 'Доступно только для Full Mix' });

        const result = await FullMixService.recoverRemovedParticipants(tournamentId);
        try {
            const { broadcastToTournament } = require('../../socketio-server');
            if (result.added_count > 0) {
                broadcastToTournament(tournamentId, 'fullmix_eliminated_updated', { added: result.added_ids, removed: [] });
            }
        } catch (_) {}
        const items = await FullMixService.getEliminatedDetailed(tournamentId);
        res.json({ success: true, recovered: result, items });
    });

    // 🆕 РЕДРАФТ СОСТАВОВ ДЛЯ СЛЕДУЮЩЕГО РАУНДА (SE/DE)
    static redraft = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const roundNumber = parseInt(req.params.round);
        
        console.log(`🔄 [FullMixController.redraft] Редрафт составов для турнира ${tournamentId}, раунд ${roundNumber}`);
        
        const result = await FullMixService.redraftRosterForNextRound(tournamentId, roundNumber);
        
        // Отправляем WebSocket обновление
        try {
            const { broadcastToTournament } = require('../../socketio-server');
            broadcastToTournament(tournamentId, 'fullmix_rosters_updated', { 
                tournamentId, 
                round: roundNumber,
                teams: result.teams,
                confirmed: false
            });
        } catch (_) {}
        
        res.json({ 
            success: true, 
            message: `Составы команд переформированы для раунда ${roundNumber}. Требуется подтверждение.`,
            ...result 
        });
    });

    // 🆕 ПОДТВЕРЖДЕНИЕ СОСТАВОВ РАУНДА (SE/DE)
    static confirmRosters = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const roundNumber = parseInt(req.params.round);
        
        console.log(`✅ [FullMixController.confirmRosters] Подтверждение составов раунда ${roundNumber}`);
        
        const result = await FullMixService.confirmRoundRosters(tournamentId, roundNumber);
        
        // Отправляем WebSocket обновление
        try {
            const { broadcastToTournament } = require('../../socketio-server');
            broadcastToTournament(tournamentId, 'fullmix_rosters_confirmed', { 
                tournamentId, 
                round: roundNumber,
                confirmed: true
            });
        } catch (_) {}
        
        res.json({ 
            success: true, 
            message: `Составы раунда ${roundNumber} подтверждены`,
            ...result 
        });
    });
}


module.exports = FullMixController;


