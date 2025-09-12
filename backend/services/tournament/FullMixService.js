const pool = require('../../db');
const TournamentService = require('./TournamentService');
const MatchService = require('./MatchService');

/**
 * FullMixService
 * Логика Full Mix (раунды, снапшоты, победитель по числу побед)
 */
class FullMixService {
    static async getLatestEliminatedIds(tournamentId) {
        try {
            const res = await pool.query(
                `SELECT snapshot->'meta' AS meta
                 FROM full_mix_snapshots
                 WHERE tournament_id = $1
                 ORDER BY round_number DESC
                 LIMIT 3`,
                [tournamentId]
            );
            const ids = new Set();
            for (const row of res.rows || []) {
                const meta = row.meta;
                if (!meta) continue;
                const eliminated = Array.isArray(meta?.eliminated) ? meta.eliminated : [];
                for (const v of eliminated) {
                    const n = parseInt(v, 10);
                    if (Number.isInteger(n)) { ids.add(n); continue; }
                    if (v && typeof v === 'object') {
                        const a = parseInt(v.user_id, 10);
                        const b = parseInt(v.participant_id, 10);
                        if (Number.isInteger(a)) ids.add(a);
                        if (Number.isInteger(b)) ids.add(b);
                    }
                }
            }
            return ids;
        } catch (_) { return new Set(); }
    }
    // ===== PREVIEW API (DB-based cache) =====
    static async savePreview(tournamentId, roundNumber, preview, createdBy = null) {
        await pool.query(
            `INSERT INTO full_mix_previews (tournament_id, round_number, preview, created_by, version, updated_at)
             VALUES ($1,$2,$3,$4,1,NOW())
             ON CONFLICT (tournament_id, round_number)
             DO UPDATE SET preview = EXCLUDED.preview, created_by = EXCLUDED.created_by, version = full_mix_previews.version + 1, updated_at = NOW()`,
            [tournamentId, roundNumber, preview, createdBy]
        );
        const res = await pool.query(
            `SELECT tournament_id, round_number, preview, version, updated_at
             FROM full_mix_previews WHERE tournament_id = $1 AND round_number = $2`,
            [tournamentId, roundNumber]
        );
        return res.rows[0];
    }

    static async getPreview(tournamentId, roundNumber) {
        const res = await pool.query(
            `SELECT tournament_id, round_number, preview, version, updated_at
             FROM full_mix_previews WHERE tournament_id = $1 AND round_number = $2`,
            [tournamentId, roundNumber]
        );
        return res.rows[0] || null;
    }

    static async deletePreview(tournamentId, roundNumber) {
        await pool.query(`DELETE FROM full_mix_previews WHERE tournament_id = $1 AND round_number = $2`, [tournamentId, roundNumber]);
        return true;
    }

    static async getSettings(tournamentId) {
        const res = await pool.query(
            'SELECT tournament_id, wins_to_win, rating_mode, current_round FROM tournament_full_mix_settings WHERE tournament_id = $1',
            [tournamentId]
        );
        if (res.rows.length === 0) return null;
        return res.rows[0];
    }

    static async upsertSettings(tournamentId, { wins_to_win, rating_mode, current_round }) {
        const res = await pool.query(
            `INSERT INTO tournament_full_mix_settings (tournament_id, wins_to_win, rating_mode, current_round)
             VALUES ($1, COALESCE($2, 3), COALESCE($3, 'random'), COALESCE($4, 1))
             ON CONFLICT (tournament_id)
             DO UPDATE SET wins_to_win = COALESCE($2, tournament_full_mix_settings.wins_to_win),
                           rating_mode = COALESCE($3, tournament_full_mix_settings.rating_mode),
                           current_round = COALESCE($4, tournament_full_mix_settings.current_round),
                           updated_at = NOW()
             RETURNING tournament_id, wins_to_win, rating_mode, current_round`,
            [tournamentId, wins_to_win, rating_mode, current_round]
        );
        return res.rows[0];
    }

    static async getCurrentRound(tournamentId) {
        const res = await pool.query(
            'SELECT COALESCE(MAX(round_number), 0) AS round FROM full_mix_snapshots WHERE tournament_id = $1',
            [tournamentId]
        );
        return parseInt(res.rows[0].round, 10);
    }

    static async getSnapshot(tournamentId, roundNumber) {
        const res = await pool.query(
            'SELECT id, tournament_id, round_number, snapshot, approved_teams, approved_matches, created_at FROM full_mix_snapshots WHERE tournament_id = $1 AND round_number = $2',
            [tournamentId, roundNumber]
        );
        return res.rows[0] || null;
    }

    static async listSnapshots(tournamentId) {
        const res = await pool.query(
            'SELECT round_number, approved_teams, approved_matches, created_at FROM full_mix_snapshots WHERE tournament_id = $1 ORDER BY round_number ASC',
            [tournamentId]
        );
        return res.rows;
    }

    static async start(tournamentId, userId, options = {}) {
        // Проверки доступа/статуса
        const tournament = await TournamentService.getTournament(tournamentId);
        if (!tournament) throw new Error('Турнир не найден');
        const mixType = (tournament.mix_type || '').toString().trim().toLowerCase();
        const isFullMixFormat = tournament.format === 'full_mix' || (tournament.format === 'mix' && mixType === 'full');
        if (!isFullMixFormat) throw new Error('Неверный формат турнира для Full Mix');

        const settings = await this.upsertSettings(tournamentId, {
            wins_to_win: options.wins_to_win,
            rating_mode: options.rating_mode || 'random'
        });

        // Генерация Раунда 1
        const roundNumber = 1;
        const snapshot = await this.generateRoundSnapshot(tournamentId, roundNumber, settings.rating_mode);
        await this.saveSnapshot(tournamentId, roundNumber, snapshot);

        return { round: roundNumber, settings, snapshot };
    }

    static async generateNextRound(tournamentId, baseRoundNumber = null) {
        const settings = await this.getSettings(tournamentId);
        if (!settings) throw new Error('Настройки Full Mix не найдены');

        // Базовый раунд: либо переданный, либо текущий максимум снапшотов
        const baseRound = Number.isInteger(baseRoundNumber) ? baseRoundNumber : await this.getCurrentRound(tournamentId);
        if (baseRound > 0) {
            const completed = await this.isRoundCompleted(tournamentId, baseRound);
            if (!completed) {
                throw new Error(`Раунд ${baseRound} ещё не завершён. Завершите все матчи перед генерацией следующего раунда`);
            }
        }

        const standings = await this.calculateStandings(tournamentId);
        console.log(`🏁 [FullMix] generateNextRound: baseRound=${baseRound} winsToWin=${settings?.wins_to_win} standings=${standings.length}`);
        const nextRound = baseRound + 1;

        // В обычных раундах (до wins_to_win) никого не исключаем и не определяем финалистов
        const winsToWin = parseInt(settings?.wins_to_win, 10) || 0;
        const atMilestone = winsToWin > 0 && baseRound >= winsToWin;

        // Не создаём команды/матчи автоматически. Создаём пустой снапшот раунда (для кнопки раунда и метаданных),
        // дальнейшее формирование идёт через Черновик (preview -> approve).
        const snapshot = { round: nextRound, teams: [], matches: [], standings, meta: {} };

        if (atMilestone) {
            // Попытка определить TOP финалистов (team_size * 2) или исключить bottom того же размера
            const teamSize = await this.getTeamSize(tournamentId);
            const topCount = Math.max(2 * (parseInt(teamSize, 10) || 5), 2);
            const selection = this.selectFinalistsOrEliminate(standings, topCount);
            console.log(`🏁 [FullMix] selection at milestone: topCount=${topCount} finalists=${selection.finalists?.length||0} eliminated=${selection.eliminated?.length||0}`);
            const finalists = Array.isArray(selection.finalists) ? selection.finalists : [];
            const eliminated = Array.isArray(selection.eliminated) ? selection.eliminated : [];

            if (finalists.length === topCount) {
                snapshot.meta.finalists = finalists;
                snapshot.meta.final_round = true;
            } else if (eliminated.length === topCount) {
                snapshot.meta.eliminated = eliminated;
            } else {
                snapshot.meta.extra_round = true;
            }
        }

        await this.saveSnapshot(tournamentId, nextRound, snapshot);
        console.log(`🏁 [FullMix] next snapshot saved: round=${nextRound} meta=`, snapshot.meta);
        return { completed: false, round: nextRound, snapshot };
    }

    /**
     * Переформирование команд ТЕКУЩЕГО раунда (если составы ещё не подтверждены)
     */
    static async reshuffleRound(tournamentId, roundNumber) {
        // Проверка существования снапшота и статуса approvals
        const snap = await this.getSnapshot(tournamentId, roundNumber);
        if (!snap) throw new Error('Снапшот раунда не найден');
        if (snap.approved_teams) throw new Error('Составы уже подтверждены и не могут быть переформированы');
        const completed = await this.isRoundCompleted(tournamentId, roundNumber);
        if (completed) throw new Error('Раунд уже завершён. Переформирование запрещено.');

        // Удаляем матчи текущего раунда
        await pool.query(`DELETE FROM matches WHERE tournament_id = $1 AND round = $2`, [tournamentId, roundNumber]);

        // Удаляем созданные команды и их участников по id из снапшота
        const teamIds = Array.isArray(snap.snapshot?.teams)
            ? snap.snapshot.teams.map(t => t.team_id).filter(Boolean)
            : [];
        if (teamIds.length > 0) {
            await pool.query(`DELETE FROM tournament_team_members WHERE team_id = ANY($1::int[])`, [teamIds]);
            await pool.query(`DELETE FROM tournament_teams WHERE id = ANY($1::int[])`, [teamIds]);
        }

        // Считаем standings и настройки для повторной генерации
        const settings = await this.getSettings(tournamentId);
        const standings = await this.calculateStandings(tournamentId);

        // Генерируем заново текущий раунд (внутри — собственная транзакция)
        const newSnapshot = await this.generateRoundSnapshot(
            tournamentId,
            roundNumber,
            settings?.rating_mode || 'random',
            standings
        );

        // Сохраняем снапшот (перезаписываем) и сбрасываем approvals
        await pool.query(
            `INSERT INTO full_mix_snapshots (tournament_id, round_number, snapshot, approved_teams, approved_matches)
             VALUES ($1, $2, $3, FALSE, FALSE)
             ON CONFLICT (tournament_id, round_number)
             DO UPDATE SET snapshot = EXCLUDED.snapshot, approved_teams = FALSE, approved_matches = FALSE`,
            [tournamentId, roundNumber, newSnapshot]
        );

        return { round: roundNumber, snapshot: newSnapshot };
    }

    static async completeRound(tournamentId, roundNumber) {
        const completed = await this.isRoundCompleted(tournamentId, roundNumber);
        const standings = await this.calculateStandings(tournamentId);
        // Если раунд завершён — автоинкремент current_round в настройках
        if (completed) {
            await pool.query(
                `UPDATE tournament_full_mix_settings
                 SET current_round = GREATEST(COALESCE(current_round, 1) + 1, $2)
                 WHERE tournament_id = $1`,
                [tournamentId, roundNumber + 1]
            );
            // Создаём пустой снапшот следующего раунда (без команд и матчей), чтобы черновик мог с ним работать
            // и определяем исход (финалисты/выбывшие/доп.раунд) на рубеже wins_to_win
            let nextRoundInfo = null;
            try {
                const settings = await this.getSettings(tournamentId);
                const winsToWin = parseInt(settings?.wins_to_win, 10) || 0;
                const reachedMilestone = winsToWin > 0 && roundNumber >= winsToWin;
                const next = await this.generateNextRound(tournamentId, roundNumber);
                if (reachedMilestone && next && next.snapshot && next.snapshot.meta) {
                    const meta = next.snapshot.meta || {};
                    let outcome = null;
                    let finalists = Array.isArray(meta.finalists) ? meta.finalists.map(x => parseInt(x, 10)).filter(Boolean) : [];
                    let eliminated = Array.isArray(meta.eliminated) ? meta.eliminated.map(x => parseInt(x, 10)).filter(Boolean) : [];
                    if (finalists.length > 0) outcome = 'finalists';
                    else if (eliminated.length > 0) outcome = 'eliminated';
                    else if (meta.extra_round) outcome = 'extra_round';

                    // Обогащаем именами
                    let nameMap = new Map();
                    if (finalists.length > 0 || eliminated.length > 0) {
                        const ids = [...new Set([...finalists, ...eliminated])];
                        if (ids.length > 0) {
                            const res = await pool.query(
                                `SELECT tp.id AS participant_id, tp.user_id, COALESCE(u.username, tp.name) AS username
                                 FROM tournament_participants tp
                                 LEFT JOIN users u ON u.id = tp.user_id
                                 WHERE tp.tournament_id = $1 AND (tp.user_id = ANY($2::int[]) OR tp.id = ANY($2::int[]))`,
                                [tournamentId, ids]
                            );
                            for (const r of res.rows || []) {
                                if (r.user_id != null) nameMap.set(parseInt(r.user_id, 10), r.username);
                                if (r.participant_id != null) nameMap.set(parseInt(r.participant_id, 10), r.username);
                            }
                        }
                    }
                    nextRoundInfo = {
                        outcome,
                        finalists: finalists.map(id => ({ user_id: id, username: nameMap.get(id) || null })),
                        eliminated: eliminated.map(id => ({ user_id: id, username: nameMap.get(id) || null }))
                    };
                    console.log('🏁 [FullMix] next_round_info:', nextRoundInfo);
                }
            } catch (_) {
                // Фолбэк: даже если генерация следующего раунда не удалась, попробуем вычислить исход напрямую
                try {
                    const settings = await this.getSettings(tournamentId);
                    const winsToWin = parseInt(settings?.wins_to_win, 10) || 0;
                    const reachedMilestone = winsToWin > 0 && roundNumber >= winsToWin;
                    if (reachedMilestone) {
                        const teamSize = await this.getTeamSize(tournamentId);
                        const topCount = Math.max(2 * (parseInt(teamSize, 10) || 5), 2);
                        const selection = this.selectFinalistsOrEliminate(standings, topCount);
                        const finalists = Array.isArray(selection.finalists) ? selection.finalists : [];
                        const eliminated = Array.isArray(selection.eliminated) ? selection.eliminated : [];
                        let outcome = null;
                        if (finalists.length === topCount) outcome = 'finalists';
                        else if (eliminated.length === topCount) outcome = 'eliminated';
                        else outcome = 'extra_round';

                        // Обогащаем именами
                        let nameMap = new Map();
                        const ids = [...new Set([...finalists, ...eliminated])];
                        if (ids.length > 0) {
                            const res = await pool.query(
                                `SELECT tp.id AS participant_id, tp.user_id, COALESCE(u.username, tp.name) AS username
                                 FROM tournament_participants tp
                                 LEFT JOIN users u ON u.id = tp.user_id
                                 WHERE tp.tournament_id = $1 AND (tp.user_id = ANY($2::int[]) OR tp.id = ANY($2::int[]))`,
                                [tournamentId, ids]
                            );
                            for (const r of res.rows || []) {
                                if (r.user_id != null) nameMap.set(parseInt(r.user_id, 10), r.username);
                                if (r.participant_id != null) nameMap.set(parseInt(r.participant_id, 10), r.username);
                            }
                        }
                        nextRoundInfo = {
                            outcome,
                            finalists: finalists.map(id => ({ user_id: id, username: nameMap.get(id) || null })),
                            eliminated: eliminated.map(id => ({ user_id: id, username: nameMap.get(id) || null }))
                        };
                        console.log('🏁 [FullMix] fallback next_round_info:', nextRoundInfo);
                    }
                } catch (_) {}
            }
            return { round: roundNumber, round_completed: completed, standings, next_round_info: nextRoundInfo };
        }
        return { round: roundNumber, round_completed: completed, standings };
    }

    static async calculateStandings(tournamentId) {
        console.log(`📊 [FullMix] calculateStandings for tournament ${tournamentId}`);
        const res = await pool.query(
            `WITH m AS (
                SELECT id, tournament_id, team1_id, team2_id, winner_team_id
                FROM matches
                WHERE tournament_id = $1 AND winner_team_id IS NOT NULL
            ),
            winners AS (
                SELECT ttm.participant_id AS participant_id
                FROM m
                JOIN tournament_team_members ttm ON ttm.team_id = m.winner_team_id
                WHERE ttm.participant_id IS NOT NULL
            ),
            losers AS (
                SELECT ttm.participant_id AS participant_id
                FROM m
                JOIN LATERAL (
                    SELECT CASE WHEN m.winner_team_id = m.team1_id THEN m.team2_id ELSE m.team1_id END AS loser_team_id
                ) l ON true
                JOIN tournament_team_members ttm ON ttm.team_id = l.loser_team_id
                WHERE ttm.participant_id IS NOT NULL
            ),
            win_agg AS (
                SELECT participant_id, COUNT(*)::int AS wins FROM winners GROUP BY participant_id
            ),
            loss_agg AS (
                SELECT participant_id, COUNT(*)::int AS losses FROM losers GROUP BY participant_id
            ),
            base AS (
                SELECT tp.id AS participant_id,
                       COALESCE(u.id, tp.user_id) AS user_id,
                       COALESCE(u.username, tp.name) AS username
                FROM tournament_participants tp
                LEFT JOIN users u ON u.id = tp.user_id
                WHERE tp.tournament_id = $1
            )
            SELECT b.participant_id,
                   COALESCE(b.user_id, b.participant_id) AS uid,
                   b.user_id,
                   b.username,
                   COALESCE(w.wins, 0) AS wins,
                   COALESCE(l.losses, 0) AS losses
            FROM base b
            LEFT JOIN win_agg w ON w.participant_id = b.participant_id
            LEFT JOIN loss_agg l ON l.participant_id = b.participant_id
            ORDER BY wins DESC, losses ASC, LOWER(username) ASC`,
            [tournamentId]
        );
        const rows = res.rows.map(r => ({
            participant_id: r.participant_id ? parseInt(r.participant_id, 10) : null,
            user_id: r.uid ? parseInt(r.uid, 10) : null,
            username: r.username,
            wins: parseInt(r.wins || 0, 10),
            losses: parseInt(r.losses || 0, 10)
        }));
        console.log(`📊 [FullMix] standings rows: ${rows.length}`);
        return rows;
    }

    static rankStandings(standings) {
        // Сортировка: wins DESC, losses ASC, username ASC
        return [...standings].sort((a, b) => {
            if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
            if ((a.losses || 0) !== (b.losses || 0)) return (a.losses || 0) - (b.losses || 0);
            return (a.username || '').localeCompare(b.username || '');
        });
    }

    static selectFinalistsOrEliminate(standings, topSize = 10) {
        const ranked = this.rankStandings(standings);
        if (!Array.isArray(ranked) || ranked.length === 0) return { finalists: [], eliminated: [] };
        if (ranked.length <= topSize) {
            return { finalists: ranked.map(s => s.user_id), eliminated: [] };
        }

        // Попытка выбрать ТОП лучших ровно topSize без ничьих на границе
        const topK = ranked.slice(0, topSize);
        const topBoundary = topK[topK.length - 1];
        const nextAfterTop = ranked[topSize];
        const noTieAtTopBoundary = !nextAfterTop
            || (nextAfterTop.wins < topBoundary.wins)
            || (nextAfterTop.wins === topBoundary.wins && (nextAfterTop.losses > topBoundary.losses));
        if (noTieAtTopBoundary) {
            return { finalists: topK.map(s => s.user_id), eliminated: [] };
        }

        // Попытка выбрать ТОП худших ровно topSize без ничьих на границе
        const reversed = [...ranked].reverse();
        const bottomK = reversed.slice(0, topSize);
        const bottomBoundary = bottomK[bottomK.length - 1];
        const nextAfterBottom = reversed[topSize];
        const noTieAtBottomBoundary = !nextAfterBottom
            || (nextAfterBottom.wins > bottomBoundary.wins)
            || (nextAfterBottom.wins === bottomBoundary.wins && (nextAfterBottom.losses < bottomBoundary.losses));
        if (noTieAtBottomBoundary) {
            return { finalists: [], eliminated: bottomK.map(s => s.user_id) };
        }

        return { finalists: [], eliminated: [] };
    }

    static async generateRoundSnapshot(tournamentId, roundNumber, ratingMode = 'random', standings = null, options = {}) {
        const { ephemeral = false, eligibleUserIds = null } = options;
        // Эфемерный режим: не пишем в БД, отдаём только расчётные команды/матчи для превью
        if (ephemeral) {
            let participants = await this.getEligibleParticipants(tournamentId, ratingMode, standings);
            if (Array.isArray(eligibleUserIds) && eligibleUserIds.length > 0) {
                const allow = new Set(eligibleUserIds.map(id => parseInt(id, 10)));
                participants = participants.filter(p => allow.has(parseInt(p.user_id, 10)));
            }
            const teamSize = await this.getTeamSize(tournamentId);
            const formed = this.formTeams(participants, ratingMode, teamSize);
            const previewTeams = formed.map((t, idx) => ({
                team_index: t.team_index || (idx + 1),
                name: `R${roundNumber}-Team ${t.team_index || (idx + 1)}`,
                members: t.members || []
            }));
            const currentStandings = standings || await this.calculateStandings(tournamentId);
            return { round: roundNumber, teams: previewTeams, matches: [], standings: currentStandings };
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // Получаем пул участников
            let participants = await this.getEligibleParticipants(tournamentId, ratingMode, standings);
            if (Array.isArray(eligibleUserIds) && eligibleUserIds.length > 0) {
                const allow = new Set(eligibleUserIds.map(id => parseInt(id, 10)));
                participants = participants.filter(p => allow.has(parseInt(p.user_id, 10)));
            }
            const teamSize = await this.getTeamSize(tournamentId);
            const teams = this.formTeams(participants, ratingMode, teamSize);
            const createdTeams = await this.createTeamsForRound(tournamentId, roundNumber, teams, ratingMode, client);
            const matches = await this.createRoundMatches(tournamentId, roundNumber, createdTeams, client);
            await client.query('COMMIT');
            const currentStandings = standings || await this.calculateStandings(tournamentId);
            return { round: roundNumber, teams: createdTeams, matches, standings: currentStandings };
        } catch (e) {
            try { await client.query('ROLLBACK'); } catch (_) {}
            throw e;
        } finally {
            client.release();
        }
    }

    static async saveSnapshot(tournamentId, roundNumber, snapshot) {
        await pool.query(
            `INSERT INTO full_mix_snapshots (tournament_id, round_number, snapshot)
             VALUES ($1, $2, $3)
             ON CONFLICT (tournament_id, round_number)
             DO UPDATE SET snapshot = EXCLUDED.snapshot`,
            [tournamentId, roundNumber, snapshot]
        );
    }

    static async approveRound(tournamentId, roundNumber, { approveTeams = false, approveMatches = false } = {}) {
        console.log(`🧩 [FullMix] approveRound: t=${tournamentId} r=${roundNumber} flags: {teams:${approveTeams}, matches:${approveMatches}}`);
        // Стадия 1: утверждение команд
        if (approveTeams) {
            const completed = await this.isRoundCompleted(tournamentId, roundNumber);
            if (completed) throw new Error('Раунд уже завершён. Подтверждение составов недоступно.');
            const preview = await this.getPreview(tournamentId, roundNumber);
            if (!preview || !Array.isArray(preview.preview?.teams)) {
                throw new Error('Черновик составов не найден');
            }
            console.log(`🧩 [FullMix] approveTeams: teams in preview = ${preview.preview.teams.length}`);
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                // Читаем текущий снапшот, чтобы сохранить meta (finalists/eliminated/extra_round)
                let prevMeta = {};
                try {
                    const prev = await client.query('SELECT snapshot FROM full_mix_snapshots WHERE tournament_id = $1 AND round_number = $2', [tournamentId, roundNumber]);
                    prevMeta = prev?.rows?.[0]?.snapshot?.meta || {};
                } catch (_) { prevMeta = {}; }

                // Удаляем матчи и команды этого раунда (если были)
                await client.query(`DELETE FROM matches WHERE tournament_id = $1 AND round = $2`, [tournamentId, roundNumber]);
                const toDelete = await client.query(
                    `SELECT id FROM tournament_teams WHERE tournament_id = $1 AND name LIKE $2`,
                    [tournamentId, `R${roundNumber}-%`]
                );
                const teamIds = (toDelete.rows || []).map(r => r.id);
                if (teamIds.length > 0) {
                    await client.query(`DELETE FROM tournament_team_members WHERE team_id = ANY($1::int[])`, [teamIds]);
                    await client.query(`DELETE FROM tournament_teams WHERE id = ANY($1::int[])`, [teamIds]);
                }

                const settings = await this.getSettings(tournamentId);
                const teamsSpec = preview.preview.teams.map((t, idx) => ({ team_index: idx + 1, members: t.members || [] }));
                const createdTeams = await this.createTeamsForRound(
                    tournamentId,
                    roundNumber,
                    teamsSpec,
                    settings?.rating_mode || 'random',
                    client
                );
                console.log(`🧩 [FullMix] approveTeams: created DB teams = ${createdTeams.length}`);

                // Обновляем снапшот: команды сохранены, матчи не созданы
                const standings = await this.calculateStandings(tournamentId);
                const snapshotToSave = { round: roundNumber, teams: createdTeams, matches: [], standings, meta: prevMeta };
                await client.query(
                    `INSERT INTO full_mix_snapshots (tournament_id, round_number, snapshot, approved_teams, approved_matches)
                     VALUES ($1,$2,$3, TRUE, FALSE)
                     ON CONFLICT (tournament_id, round_number)
                     DO UPDATE SET snapshot = EXCLUDED.snapshot, approved_teams = TRUE, approved_matches = FALSE`,
                    [tournamentId, roundNumber, snapshotToSave]
                );
                const chk = await client.query('SELECT approved_teams, approved_matches, jsonb_array_length((snapshot->>\'teams\')::jsonb) AS tcnt FROM full_mix_snapshots WHERE tournament_id=$1 AND round_number=$2', [tournamentId, roundNumber]);
                console.log(`🧩 [FullMix] approveTeams: saved snapshot check =`, chk.rows[0]);

                // Не удаляем превью, чтобы фронт мог сразу сгенерировать пары матчей (mode: 'matches')

                await client.query('COMMIT');
                return { round: roundNumber, approved_teams: true, approved_matches: false };
            } catch (e) {
                try { await client.query('ROLLBACK'); } catch (_) {}
                console.error('❌ [FullMix] approveTeams error:', e.stack || e.message || e);
                throw e;
            } finally {
                client.release();
            }
        }

        // Стадия 2: утверждение матчей (требует approved_teams)
        if (approveMatches) {
            const snap = await this.getSnapshot(tournamentId, roundNumber);
            if (!snap || snap.approved_teams !== true) {
                throw new Error('Составы команд не подтверждены');
            }
            const completed = await this.isRoundCompleted(tournamentId, roundNumber);
            if (completed) throw new Error('Раунд уже завершён. Подтверждение матчей недоступно.');
            let preview = await this.getPreview(tournamentId, roundNumber);
            if (!preview || !Array.isArray(preview.preview?.matches)) {
                // Fallback: если превью матчей нет — сгенерировать пары на лету из снапшота
                const mp = await this.generateMatchesPreviewFromSnapshot(tournamentId, roundNumber);
                preview = { preview: mp };
            }
            // Если после генерации всё равно нет пар — создадим случайные пары из списка команд снапшота
            if (!Array.isArray(preview.preview.matches) || preview.preview.matches.length === 0) {
                const teamsList = Array.isArray(snap.snapshot?.teams) ? [...snap.snapshot.teams] : [];
                for (let i = teamsList.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [teamsList[i], teamsList[j]] = [teamsList[j], teamsList[i]];
                }
                const pairs = [];
                for (let i = 0; i < teamsList.length; i += 2) {
                    const a = teamsList[i];
                    const b = teamsList[i + 1];
                    if (!a || !b) break;
                    pairs.push({ team1_id: a.team_id, team2_id: b.team_id, team1_name: a.name, team2_name: b.name });
                }
                preview.preview.matches = pairs;
            }
            console.log(`🧩 [FullMix] approveMatches: pairs = ${preview.preview.matches.length}`);

            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                // Удаляем старые матчи данного раунда
                await client.query(`DELETE FROM matches WHERE tournament_id = $1 AND round = $2`, [tournamentId, roundNumber]);

                // Создаём матчи по превью
                const matchPairs = preview.preview.matches; // [{team1_id, team2_id}] или иные варианты ключей
                const previewTeams = Array.isArray(preview.preview?.teams) ? preview.preview.teams : [];
                const snapTeams = Array.isArray(snap.snapshot?.teams) ? snap.snapshot.teams : [];
                const nameToId = new Map();
                const norm = (s) => s ? s.toString().trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9\s-]/g, '') : '';
                const minorm = (s) => norm(s).replace(/[\s-]/g, '');
                for (const t of [...previewTeams, ...snapTeams]) {
                    const id = t.team_id != null ? parseInt(t.team_id, 10) : null;
                    if (!Number.isInteger(id)) continue;
                    const n1 = norm(t.name || '');
                    const n2 = minorm(t.name || '');
                    if (n1) nameToId.set(n1, id);
                    if (n2) nameToId.set(n2, id);
                }
                // Маппинг имён команд к фактическим DB id для данного раунда (R{round}-Team N)
                const dbTeamsRes = await client.query(
                    `SELECT id, name FROM tournament_teams WHERE tournament_id = $1 AND name LIKE $2`,
                    [tournamentId, `R${roundNumber}-%`]
                );
                const dbNameToId = new Map();
                const dbIndexToId = new Map();
                for (const row of dbTeamsRes.rows || []) {
                    const n1 = norm(row.name || '');
                    const n2 = minorm(row.name || '');
                    if (n1) dbNameToId.set(n1, row.id);
                    if (n2) dbNameToId.set(n2, row.id);
                    const m = /team\s*(\d+)/i.exec(row.name || '');
                    if (m) {
                        const idx = parseInt(m[1], 10);
                        if (Number.isInteger(idx)) dbIndexToId.set(idx, row.id);
                    }
                }
                const createdMatches = [];

                // Глобальные счётчики
                const tmRes = await client.query(
                    `SELECT COALESCE(MAX(tournament_match_number), 0) AS max FROM matches WHERE tournament_id = $1`,
                    [tournamentId]
                );
                let nextTournamentMatchNumber = parseInt(tmRes.rows[0]?.max || 0, 10) + 1;

                const mrRes = await client.query(
                    `SELECT COALESCE(MAX(match_number), 0) AS max FROM matches WHERE tournament_id = $1 AND round = $2`,
                    [tournamentId, roundNumber]
                );
                let nextMatchNumberInRound = parseInt(mrRes.rows[0]?.max || 0, 10) + 1;

                for (const p of matchPairs) {
                    // Нормализация ключей и приведение к числу, поддержка пар по именам
                    let t1 = p.team1_id ?? p.team1Id ?? p.t1 ?? (p.team1 && (p.team1.team_id ?? p.team1.id)) ?? null;
                    let t2 = p.team2_id ?? p.team2Id ?? p.t2 ?? (p.team2 && (p.team2.team_id ?? p.team2.id)) ?? null;
                    if (t1 == null && (p.team1_name || p.team1Name)) {
                        const raw = (p.team1_name || p.team1Name);
                        const k1 = norm(raw);
                        const k2 = minorm(raw);
                        t1 = nameToId.get(k1) ?? nameToId.get(k2) ?? dbNameToId.get(k1) ?? dbNameToId.get(k2) ?? null;
                        if (t1 == null) {
                            // Попробуем распарсить индекс команды из строки вида R1-Team 5
                            const m = /team\s*(\d+)/i.exec(raw.toString());
                            if (m) {
                                const idx = parseInt(m[1], 10);
                                // По индексу найдём в снапшоте
                                const matchByIndex = [...snapTeams, ...previewTeams].find(tt => /team\s*(\d+)/i.test(tt.name || '') && parseInt(/team\s*(\d+)/i.exec(tt.name || '')[1], 10) === idx);
                                if (matchByIndex && matchByIndex.team_id != null) t1 = parseInt(matchByIndex.team_id, 10);
                                if (t1 == null && dbIndexToId.has(idx)) t1 = dbIndexToId.get(idx);
                            }
                        }
                    }
                    if (t2 == null && (p.team2_name || p.team2Name)) {
                        const raw = (p.team2_name || p.team2Name);
                        const k1 = norm(raw);
                        const k2 = minorm(raw);
                        t2 = nameToId.get(k1) ?? nameToId.get(k2) ?? dbNameToId.get(k1) ?? dbNameToId.get(k2) ?? null;
                        if (t2 == null) {
                            const m = /team\s*(\d+)/i.exec(raw.toString());
                            if (m) {
                                const idx = parseInt(m[1], 10);
                                const matchByIndex = [...snapTeams, ...previewTeams].find(tt => /team\s*(\d+)/i.test(tt.name || '') && parseInt(/team\s*(\d+)/i.exec(tt.name || '')[1], 10) === idx);
                                if (matchByIndex && matchByIndex.team_id != null) t2 = parseInt(matchByIndex.team_id, 10);
                                if (t2 == null && dbIndexToId.has(idx)) t2 = dbIndexToId.get(idx);
                            }
                        }
                    }
                    const team1Id = t1 != null ? parseInt(t1, 10) : null;
                    const team2Id = t2 != null ? parseInt(t2, 10) : null;
                    if (!(Number.isInteger(team1Id) && Number.isInteger(team2Id))) {
                        console.warn('⚠️ [FullMix] approveMatches: skip invalid pair after normalize', p);
                        continue;
                    }
                    const ins = await client.query(
                        `INSERT INTO matches (
                            tournament_id, round, match_number, tournament_match_number, team1_id, team2_id, status, bracket_type
                         ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'winner') RETURNING id`,
                        [tournamentId, roundNumber, nextMatchNumberInRound, nextTournamentMatchNumber, team1Id, team2Id]
                    );
                    createdMatches.push({ id: ins.rows[0].id, team1_id: team1Id, team2_id: team2Id });
                    nextMatchNumberInRound += 1;
                    nextTournamentMatchNumber += 1;
                }
                // Если из превью ничего не вставили — создадим пары напрямую из снапшота
                if (createdMatches.length === 0) {
                    console.warn('⚠️ [FullMix] approveMatches: preview pairs unusable, generating from snapshot');
                    const teamsList = Array.isArray(snap.snapshot?.teams) ? snap.snapshot.teams : [];
                    for (let i = 0; i < teamsList.length; i += 2) {
                        const a = teamsList[i];
                        const b = teamsList[i + 1];
                        if (!a || !b) break;
                        // Разрешаем имена в фактические DB id
                        const aK1 = norm(a.name || '');
                        const aK2 = minorm(a.name || '');
                        const bK1 = norm(b.name || '');
                        const bK2 = minorm(b.name || '');
                        const aId = dbNameToId.get(aK1) ?? dbNameToId.get(aK2) ?? a.team_id;
                        const bId = dbNameToId.get(bK1) ?? dbNameToId.get(bK2) ?? b.team_id;
                        if (!(Number.isInteger(aId) && Number.isInteger(bId))) {
                            console.warn('⚠️ [FullMix] approveMatches: skip snapshot pair due to missing DB ids', { a: a.name, b: b.name });
                            continue;
                        }
                        const ins = await client.query(
                            `INSERT INTO matches (
                                tournament_id, round, match_number, tournament_match_number, team1_id, team2_id, status, bracket_type
                             ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'winner') RETURNING id`,
                            [tournamentId, roundNumber, nextMatchNumberInRound, nextTournamentMatchNumber, aId, bId]
                        );
                        createdMatches.push({ id: ins.rows[0].id, team1_id: aId, team2_id: bId });
                        nextMatchNumberInRound += 1;
                        nextTournamentMatchNumber += 1;
                    }
                }
                console.log(`🧩 [FullMix] approveMatches: created DB matches = ${createdMatches.length}`);

                // Обновляем снапшот матчами с именами команд для корректного отображения на фронте
                const idToName = new Map((dbTeamsRes.rows || []).map(r => [r.id, r.name]));
                const matchesNamed = createdMatches.map(m => ({
                    ...m,
                    team1_name: idToName.get(m.team1_id) || null,
                    team2_name: idToName.get(m.team2_id) || null,
                }));
                // Сохраняем meta из существующего снапшота (не затираем информацию об eliminated/finalists)
                let prevMeta = {};
                try {
                    prevMeta = snap?.snapshot?.meta || {};
                } catch (_) { prevMeta = {}; }
                const newSnap = { round: roundNumber, teams: snap.snapshot?.teams || [], matches: matchesNamed, standings: snap.snapshot?.standings || [], meta: prevMeta };
                await client.query(
                    `UPDATE full_mix_snapshots SET snapshot = $3, approved_matches = TRUE WHERE tournament_id = $1 AND round_number = $2`,
                    [tournamentId, roundNumber, newSnap]
                );
                const chk = await client.query('SELECT approved_teams, approved_matches, jsonb_array_length((snapshot->>\'matches\')::jsonb) AS mcnt FROM full_mix_snapshots WHERE tournament_id=$1 AND round_number=$2', [tournamentId, roundNumber]);
                console.log(`🧩 [FullMix] approveMatches: saved snapshot check =`, chk.rows[0]);

                // Очищаем превью после подтверждения матчей
                await client.query(`DELETE FROM full_mix_previews WHERE tournament_id = $1 AND round_number = $2`, [tournamentId, roundNumber]);

                await client.query('COMMIT');

                // 🔔 Broadcast: матчи подтверждены → обновить сетку у всех клиентов
                try {
                    const { broadcastToTournament } = require('../../socketio-server');
                    broadcastToTournament(tournamentId, 'fullmix_round_completed', { round: roundNumber, type: 'matches_approved' });
                } catch (_) {}
                return { round: roundNumber, approved_teams: true, approved_matches: true };
            } catch (e) {
                try { await client.query('ROLLBACK'); } catch (_) {}
                console.error('❌ [FullMix] approveMatches error:', e.stack || e.message || e);
                throw e;
            } finally {
                client.release();
            }
        }

        return { round: roundNumber };
    }

    static async generateMatchesPreviewFromSnapshot(tournamentId, roundNumber) {
        const snap = await this.getSnapshot(tournamentId, roundNumber);
        if (!snap || snap.approved_teams !== true) {
            throw new Error('Составы команд не подтверждены');
        }
        const teams = Array.isArray(snap.snapshot?.teams) ? snap.snapshot.teams : [];
        // Случайная перестановка команд (Fisher–Yates), затем пары по последовательности
        const shuffled = [...teams];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const pairs = [];
        for (let i = 0; i < shuffled.length; i += 2) {
            const a = shuffled[i];
            const b = shuffled[i + 1];
            if (!b) break;
            pairs.push({ team1_id: a.team_id, team2_id: b.team_id, team1_name: a.name || null, team2_name: b.name || null });
        }
        // Вернём полный список команд для превью матчей (с участниками), чтобы слева отображались составы
        const teamRefs = shuffled.map(t => ({ team_id: t.team_id, name: t.name || null, members: Array.isArray(t.members) ? t.members : [] }));
        return { round: roundNumber, teams: teamRefs, matches: pairs };
    }

    static async getEligibleParticipants(tournamentId, ratingMode, standings) {
        // Базовый пул участников
        const res = await pool.query(
            `SELECT tp.id as participant_id, tp.user_id, COALESCE(u.username, tp.name) as username,
                    u.faceit_elo, u.cs2_premier_rank
             FROM tournament_participants tp
             LEFT JOIN users u ON u.id = tp.user_id
             WHERE tp.tournament_id = $1
             ORDER BY tp.id ASC`,
            [tournamentId]
        );

        // Исключаем выбывших только на рубеже wins_to_win и далее, чтобы не сломать превью до рубежа
        try {
            const settings = await this.getSettings(tournamentId);
            const current = await this.getCurrentRound(tournamentId);
            const winsToWin = parseInt(settings?.wins_to_win, 10) || 0;
            const atOrAfterMilestone = winsToWin > 0 && current >= winsToWin;
            if (!atOrAfterMilestone) return res.rows;
            const eliminatedSet = await this.getLatestEliminatedIds(tournamentId);
            if (eliminatedSet.size === 0) return res.rows;
            return res.rows.filter(r => {
                const uid = r.user_id != null ? parseInt(r.user_id, 10) : null;
                const pid = r.participant_id != null ? parseInt(r.participant_id, 10) : null;
                return !( (uid != null && eliminatedSet.has(uid)) || (pid != null && eliminatedSet.has(pid)) );
            });
        } catch (_) {
            return res.rows;
        }
    }

    static formTeams(participants, ratingMode, perTeam) {
        const shuffled = [...participants];
        if (ratingMode === 'random') {
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
        } else {
            // rating: сортируем по убыванию faceit_elo, snake-раздача по командам
            shuffled.sort((a, b) => (b.faceit_elo || 0) - (a.faceit_elo || 0));
            const numTeams = Math.max(1, Math.floor(shuffled.length / perTeam));
            const buckets = Array.from({ length: numTeams }, () => []);
            for (let i = 0; i < numTeams * perTeam && i < shuffled.length; i++) {
                const block = Math.floor(i / numTeams);
                const pos = i % numTeams;
                const idx = block % 2 === 0 ? pos : (numTeams - 1 - pos);
                buckets[idx].push(shuffled[i]);
            }
            // Добавляем остаток игроков по одному в команды
            for (let i = numTeams * perTeam; i < shuffled.length; i++) {
                buckets[i % numTeams].push(shuffled[i]);
            }
            return buckets
                .filter(team => team.length >= 2)
                .map((members, idx) => ({ team_index: idx + 1, members }));
        }

        const teams = [];
        let index = 0;
        while (index < shuffled.length) {
            const chunk = shuffled.slice(index, index + perTeam);
            if (chunk.length >= 2) teams.push(chunk);
            index += perTeam;
        }
        return teams.map((members, idx) => ({ team_index: idx + 1, members }));
    }

    static async createRoundMatches(tournamentId, roundNumber, createdTeams, client = pool) {
        // Создаём матчи по парам команд с корректной нумерацией
        const matches = [];

        // Глобальный сквозной номер матча по турниру
        const tmRes = await client.query(
            `SELECT COALESCE(MAX(tournament_match_number), 0) AS max FROM matches WHERE tournament_id = $1`,
            [tournamentId]
        );
        let nextTournamentMatchNumber = parseInt(tmRes.rows[0]?.max || 0, 10) + 1;

        // Номер матча в рамках раунда
        const mrRes = await client.query(
            `SELECT COALESCE(MAX(match_number), 0) AS max FROM matches WHERE tournament_id = $1 AND round = $2`,
            [tournamentId, roundNumber]
        );
        let nextMatchNumberInRound = parseInt(mrRes.rows[0]?.max || 0, 10) + 1;

        for (let i = 0; i < createdTeams.length; i += 2) {
            const teamA = createdTeams[i];
            const teamB = createdTeams[i + 1];
            if (!teamB) break;

            const res = await client.query(
                `INSERT INTO matches (
                    tournament_id, round, match_number, tournament_match_number, team1_id, team2_id, status, bracket_type
                 ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'winner') RETURNING id`,
                [
                    tournamentId,
                    roundNumber,
                    nextMatchNumberInRound,
                    nextTournamentMatchNumber,
                    teamA.team_id,
                    teamB.team_id
                ]
            );

            matches.push({ id: res.rows[0].id, team1_id: teamA.team_id, team2_id: teamB.team_id });
            nextMatchNumberInRound += 1;
            nextTournamentMatchNumber += 1;
        }
        return matches;
    }

    static async getTeamSize(tournamentId) {
        const res = await pool.query('SELECT team_size FROM tournaments WHERE id = $1', [tournamentId]);
        const size = parseInt(res.rows[0]?.team_size || 5, 10);
        return [2,3,4,5].includes(size) ? size : 5;
    }

    static chooseCaptain(members, ratingMode) {
        if (!Array.isArray(members) || members.length === 0) return null;
        if (ratingMode === 'rating') {
            let best = members[0];
            for (const m of members) {
                if ((m.faceit_elo || 0) > (best.faceit_elo || 0)) best = m;
            }
            return best;
        }
        // random среди авторизованных, иначе любой
        const authorized = members.filter(m => m.user_id);
        const poolCandidates = authorized.length > 0 ? authorized : members;
        return poolCandidates[Math.floor(Math.random() * poolCandidates.length)];
    }

    static async createTeamsForRound(tournamentId, roundNumber, teams, ratingMode, client = pool) {
        const created = [];
        for (const t of teams) {
            const name = `R${roundNumber}-Team ${t.team_index}`;
            const teamRes = await client.query(
                `INSERT INTO tournament_teams (tournament_id, name, creator_id)
                 VALUES ($1, $2, NULL) RETURNING id`,
                [tournamentId, name]
            );
            const teamId = teamRes.rows[0].id;
            const captain = this.chooseCaptain(t.members, ratingMode);
            const captainUserId = captain?.user_id || null;
            const captainRating = captain?.faceit_elo || null;
            for (const m of t.members) {
                await client.query(
                    `INSERT INTO tournament_team_members (team_id, user_id, participant_id, is_captain, captain_rating)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [teamId, m.user_id || null, m.participant_id || null, !!(captainUserId && m.user_id === captainUserId), captainRating]
                );
            }
            created.push({ team_id: teamId, name, members: t.members });
        }
        return created;
    }

    static async isRoundCompleted(tournamentId, roundNumber) {
        const res = await pool.query(
            `SELECT 
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE (status <> 'completed' AND (winner_team_id IS NULL)))::int AS pending
             FROM matches
             WHERE tournament_id = $1 AND round = $2`,
            [tournamentId, roundNumber]
        );
        const total = parseInt(res.rows[0]?.total || 0, 10);
        const pending = parseInt(res.rows[0]?.pending || 0, 10);
        // Раунд считается завершённым ТОЛЬКО если есть хотя бы один матч и нет незавершённых
        return total > 0 && pending === 0;
    }
}

module.exports = FullMixService;


