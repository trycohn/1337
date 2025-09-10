const pool = require('../../db');
const TournamentService = require('./TournamentService');
const MatchService = require('./MatchService');

/**
 * FullMixService
 * Логика Full Mix (раунды, снапшоты, победитель по числу побед)
 */
class FullMixService {
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
            'SELECT tournament_id, wins_to_win, rating_mode FROM tournament_full_mix_settings WHERE tournament_id = $1',
            [tournamentId]
        );
        if (res.rows.length === 0) return null;
        return res.rows[0];
    }

    static async upsertSettings(tournamentId, { wins_to_win, rating_mode }) {
        const res = await pool.query(
            `INSERT INTO tournament_full_mix_settings (tournament_id, wins_to_win, rating_mode)
             VALUES ($1, COALESCE($2, 3), COALESCE($3, 'random'))
             ON CONFLICT (tournament_id)
             DO UPDATE SET wins_to_win = COALESCE($2, tournament_full_mix_settings.wins_to_win),
                           rating_mode = COALESCE($3, tournament_full_mix_settings.rating_mode),
                           updated_at = NOW()
             RETURNING tournament_id, wins_to_win, rating_mode`,
            [tournamentId, wins_to_win, rating_mode]
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

    static async generateNextRound(tournamentId) {
        const settings = await this.getSettings(tournamentId);
        if (!settings) throw new Error('Настройки Full Mix не найдены');
        const current = await this.getCurrentRound(tournamentId);
        if (current > 0) {
            const completed = await this.isRoundCompleted(tournamentId, current);
            if (!completed) {
                throw new Error(`Раунд ${current} ещё не завершён. Завершите все матчи перед генерацией следующего раунда`);
            }
        }
        const standings = await this.calculateStandings(tournamentId);

        // Проверяем победителя по wins_to_win
        const winners = standings.filter(s => (s.wins || 0) >= settings.wins_to_win);
        if (winners.length > 0) {
            const t = await TournamentService.getTournament(tournamentId);
            await TournamentService.endTournament(tournamentId, t?.created_by);
            return { completed: true, winners, standings };
        }

        const nextRound = current + 1;
        const snapshot = await this.generateRoundSnapshot(tournamentId, nextRound, settings.rating_mode, standings);
        await this.saveSnapshot(tournamentId, nextRound, snapshot);
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
        return { round: roundNumber, round_completed: completed, standings };
    }

    static async calculateStandings(tournamentId) {
        // Корректная агрегация побед/поражений по пользователям
        const res = await pool.query(
            `WITH m AS (
                SELECT id, tournament_id, team1_id, team2_id, winner_team_id
                FROM matches
                WHERE tournament_id = $1 AND status = 'completed' AND winner_team_id IS NOT NULL
            ),
            winners AS (
                SELECT COALESCE(ttm.user_id, tp.user_id) AS user_id
                FROM m
                JOIN tournament_team_members ttm ON ttm.team_id = m.winner_team_id
                LEFT JOIN tournament_participants tp ON tp.id = ttm.participant_id
            ),
            losers AS (
                SELECT COALESCE(ttm.user_id, tp.user_id) AS user_id
                FROM m
                JOIN LATERAL (
                    SELECT CASE WHEN m.winner_team_id = m.team1_id THEN m.team2_id ELSE m.team1_id END AS loser_team_id
                ) l ON true
                JOIN tournament_team_members ttm ON ttm.team_id = l.loser_team_id
                LEFT JOIN tournament_participants tp ON tp.id = ttm.participant_id
            ),
            win_agg AS (
                SELECT user_id, COUNT(*)::int AS wins FROM winners WHERE user_id IS NOT NULL GROUP BY user_id
            ),
            loss_agg AS (
                SELECT user_id, COUNT(*)::int AS losses FROM losers WHERE user_id IS NOT NULL GROUP BY user_id
            ),
            base AS (
                SELECT DISTINCT COALESCE(u.id, tp.user_id) AS user_id, COALESCE(u.username, tp.name) AS username
                FROM tournament_participants tp
                LEFT JOIN users u ON u.id = tp.user_id
                WHERE tp.tournament_id = $1
            )
            SELECT b.user_id, b.username,
                   COALESCE(w.wins, 0) AS wins,
                   COALESCE(l.losses, 0) AS losses
            FROM base b
            LEFT JOIN win_agg w ON w.user_id = b.user_id
            LEFT JOIN loss_agg l ON l.user_id = b.user_id
            ORDER BY wins DESC, losses ASC, LOWER(username) ASC`,
            [tournamentId]
        );
        return res.rows.map(r => ({
            user_id: r.user_id ? parseInt(r.user_id, 10) : null,
            username: r.username,
            wins: parseInt(r.wins || 0, 10),
            losses: parseInt(r.losses || 0, 10)
        }));
    }

    static async generateRoundSnapshot(tournamentId, roundNumber, ratingMode = 'random', standings = null, options = {}) {
        const { ephemeral = false } = options;
        // Эфемерный режим: не пишем в БД, отдаём только расчётные команды/матчи для превью
        if (ephemeral) {
            const participants = await this.getEligibleParticipants(tournamentId, ratingMode, standings);
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
            const participants = await this.getEligibleParticipants(tournamentId, ratingMode, standings);
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
        // Стадия 1: утверждение команд
        if (approveTeams) {
            const preview = await this.getPreview(tournamentId, roundNumber);
            if (!preview || !Array.isArray(preview.preview?.teams)) {
                throw new Error('Черновик составов не найден');
            }
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

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

                // Обновляем снапшот: команды сохранены, матчи не созданы
                const standings = await this.calculateStandings(tournamentId);
                const snapshotToSave = { round: roundNumber, teams: createdTeams, matches: [], standings };
                await client.query(
                    `INSERT INTO full_mix_snapshots (tournament_id, round_number, snapshot, approved_teams, approved_matches)
                     VALUES ($1,$2,$3, TRUE, FALSE)
                     ON CONFLICT (tournament_id, round_number)
                     DO UPDATE SET snapshot = EXCLUDED.snapshot, approved_teams = TRUE, approved_matches = FALSE`,
                    [tournamentId, roundNumber, snapshotToSave]
                );

                // Очищаем превью (на этапе матчей можно создать новое превью для пар)
                await client.query(`DELETE FROM full_mix_previews WHERE tournament_id = $1 AND round_number = $2`, [tournamentId, roundNumber]);

                await client.query('COMMIT');
                return { round: roundNumber, approved_teams: true, approved_matches: false };
            } catch (e) {
                try { await client.query('ROLLBACK'); } catch (_) {}
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
            const preview = await this.getPreview(tournamentId, roundNumber);
            if (!preview || !Array.isArray(preview.preview?.matches) || preview.preview.matches.length === 0) {
                throw new Error('Черновик матчей не найден');
            }

            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                // Удаляем старые матчи данного раунда
                await client.query(`DELETE FROM matches WHERE tournament_id = $1 AND round = $2`, [tournamentId, roundNumber]);

                // Создаём матчи по превью
                const matchPairs = preview.preview.matches; // [{team1_id, team2_id}]
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
                    if (!p.team1_id || !p.team2_id) continue;
                    const ins = await client.query(
                        `INSERT INTO matches (
                            tournament_id, round, match_number, tournament_match_number, team1_id, team2_id, status, bracket_type
                         ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'winner') RETURNING id`,
                        [tournamentId, roundNumber, nextMatchNumberInRound, nextTournamentMatchNumber, p.team1_id, p.team2_id]
                    );
                    createdMatches.push({ id: ins.rows[0].id, team1_id: p.team1_id, team2_id: p.team2_id });
                    nextMatchNumberInRound += 1;
                    nextTournamentMatchNumber += 1;
                }

                // Обновляем снапшот матчами
                const newSnap = { ...(snap.snapshot || {}), matches: createdMatches };
                await client.query(
                    `UPDATE full_mix_snapshots SET snapshot = $3, approved_matches = TRUE WHERE tournament_id = $1 AND round_number = $2`,
                    [tournamentId, roundNumber, newSnap]
                );

                // Удаляем превью матчей
                await client.query(`DELETE FROM full_mix_previews WHERE tournament_id = $1 AND round_number = $2`, [tournamentId, roundNumber]);

                await client.query('COMMIT');
                return { round: roundNumber, approved_teams: true, approved_matches: true };
            } catch (e) {
                try { await client.query('ROLLBACK'); } catch (_) {}
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
        // Парами по порядку, если нечётное число — последняя без пары
        const pairs = [];
        for (let i = 0; i < teams.length; i += 2) {
            const a = teams[i];
            const b = teams[i + 1];
            if (!b) break;
            pairs.push({ team1_id: a.team_id, team2_id: b.team_id });
        }
        return { round: roundNumber, matches: pairs };
    }

    static async getEligibleParticipants(tournamentId, ratingMode, standings) {
        // Все участники турнира, исключений по поражениям нет (победа считается по wins_to_win)
        const res = await pool.query(
            `SELECT tp.id as participant_id, tp.user_id, COALESCE(u.username, tp.name) as username,
                    u.faceit_elo, u.cs2_premier_rank
             FROM tournament_participants tp
             LEFT JOIN users u ON u.id = tp.user_id
             WHERE tp.tournament_id = $1
             ORDER BY tp.id ASC`,
            [tournamentId]
        );
        return res.rows;
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
            `SELECT COUNT(*)::int AS pending
             FROM matches
             WHERE tournament_id = $1 AND round = $2 AND status <> 'completed'`,
            [tournamentId, roundNumber]
        );
        return parseInt(res.rows[0]?.pending || 0, 10) === 0;
    }
}

module.exports = FullMixService;


