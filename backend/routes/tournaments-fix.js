// Временный фикс для endpoint очистки результатов матчей
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, verifyAdminOrCreator } = require('../middleware/auth');
const { broadcastTournamentUpdate } = require('../notifications');

// 🆕 ИСПРАВЛЕННЫЙ МАРШРУТ ДЛЯ ОБНОВЛЕНИЯ РЕЗУЛЬТАТОВ МАТЧА
router.post('/matches/:matchId/result', authenticateToken, async (req, res) => {
    const { matchId } = req.params;
    const { winner_team_id, score1, score2, maps_data } = req.body;
    const userId = req.user.id;

    console.log(`🎯 [tournaments-fix] Обновление результата матча ${matchId}:`, {
        winner_team_id,
        score1,
        score2,
        maps_data: maps_data?.length || 0,
        userId
    });

    try {
        // Преобразуем matchId в число
        const matchIdNum = Number(matchId);

        // Получение данных текущего матча
        const matchResult = await pool.query('SELECT * FROM matches WHERE id = $1', [matchIdNum]);
        if (matchResult.rows.length === 0) {
            console.log(`❌ [tournaments-fix] Матч ${matchId} не найден`);
            return res.status(404).json({ error: 'Матч не найден' });
        }
        const match = matchResult.rows[0];
        const tournamentId = match.tournament_id;

        console.log(`✅ [tournaments-fix] Матч найден: ${match.id}, турнир: ${tournamentId}`);

        // Проверка турнира и прав доступа
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        const tournament = tournamentResult.rows[0];

        // Проверка прав доступа
        if (tournament.created_by !== userId) {
            const adminCheck = await pool.query(
                'SELECT * FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
                [tournamentId, userId]
            );
            if (adminCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Только создатель или администратор может обновлять результаты матча' });
            }
        }

        console.log(`✅ [tournaments-fix] Права доступа проверены для пользователя ${userId}`);

        // Проверка, что winner_team_id является одним из участников матча
        if (winner_team_id && ![match.team1_id, match.team2_id].includes(winner_team_id)) {
            return res.status(400).json({ error: 'Победитель должен быть одним из участников матча' });
        }

        // Обновление результата текущего матча
        console.log(`💾 [tournaments-fix] Обновляем результат матча ${matchIdNum}`);
        await pool.query(
            'UPDATE matches SET winner_team_id = $1, score1 = $2, score2 = $3, maps_data = $4, status = $5 WHERE id = $6',
            [winner_team_id, score1, score2, maps_data ? JSON.stringify(maps_data) : null, 'completed', matchIdNum]
        );

        // Простая логика продвижения победителя в следующий матч
        if (winner_team_id && match.next_match_id) {
            console.log(`🏆 [tournaments-fix] Продвигаем победителя ${winner_team_id} в матч ${match.next_match_id}`);
            
            const nextMatchResult = await pool.query('SELECT * FROM matches WHERE id = $1', [match.next_match_id]);
            if (nextMatchResult.rows.length > 0) {
                const nextMatch = nextMatchResult.rows[0];
                
                // Определяем, в какую позицию добавить победителя
                if (!nextMatch.team1_id) {
                    await pool.query('UPDATE matches SET team1_id = $1 WHERE id = $2', [winner_team_id, nextMatch.id]);
                    console.log(`✅ [tournaments-fix] Победитель помещен в team1 матча ${nextMatch.id}`);
                } else if (!nextMatch.team2_id) {
                    await pool.query('UPDATE matches SET team2_id = $1 WHERE id = $2', [winner_team_id, nextMatch.id]);
                    console.log(`✅ [tournaments-fix] Победитель помещен в team2 матча ${nextMatch.id}`);
                } else {
                    console.log(`⚠️ [tournaments-fix] Обе позиции в следующем матче уже заняты`);
                }
            }
        }

        // Получаем обновлённые данные турнира
        console.log(`📊 [tournaments-fix] Получаем обновленные данные турнира ${tournamentId}`);
        const updatedTournament = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
        const tournamentData = updatedTournament.rows[0];
        
        // Получаем матчи
        const matchesResult = await pool.query(
            'SELECT * FROM matches WHERE tournament_id = $1 ORDER BY round, match_number',
            [tournamentId]
        );
        tournamentData.matches = matchesResult.rows;
        
        // Получаем участников
        const participantsResult = await pool.query(
            'SELECT tp.*, u.avatar_url, u.username FROM tournament_participants tp LEFT JOIN users u ON tp.user_id = u.id WHERE tp.tournament_id = $1',
            [tournamentId]
        );
        tournamentData.participants = participantsResult.rows;
        tournamentData.participant_count = participantsResult.rows.length;

        // 🆕 Для командных турниров загружаем команды с участниками
        let teams = [];
        if (tournament.participant_type === 'team') {
            const teamsRes = await pool.query(
                `SELECT tt.id, tt.tournament_id, tt.name, tt.creator_id
                 FROM tournament_teams tt
                 WHERE tt.tournament_id = $1`,
                [tournamentId]
            );

            teams = await Promise.all(teamsRes.rows.map(async (team) => {
                const membersRes = await pool.query(
                    `SELECT tm.team_id, tm.user_id, tm.participant_id, 
                            tp.name, u.username, u.avatar_url, u.faceit_elo, u.cs2_premier_rank
                     FROM tournament_team_members tm
                     LEFT JOIN tournament_participants tp ON tm.participant_id = tp.id
                     LEFT JOIN users u ON tm.user_id = u.id
                     WHERE tm.team_id = $1`,
                    [team.id]
                );

                return {
                    ...team,
                    members: membersRes.rows
                };
            }));
        }

        tournamentData.teams = teams;
        tournamentData.mixed_teams = teams; // Для обратной совместимости

        // Отправляем обновления всем клиентам
        try {
            broadcastTournamentUpdate(tournamentId, tournamentData);
            console.log(`📡 [tournaments-fix] WebSocket обновления отправлены`);
        } catch (broadcastError) {
            console.error('⚠️ [tournaments-fix] Ошибка при отправке WebSocket обновления:', broadcastError);
        }

        console.log(`🎉 [tournaments-fix] Результат матча ${matchId} успешно обновлен`);
        res.status(200).json({ 
            message: 'Результат обновлён', 
            tournament: tournamentData 
        });

    } catch (err) {
        console.error(`❌ [tournaments-fix] Ошибка обновления результата матча ${matchId}:`, err);
        res.status(500).json({ 
            error: 'Ошибка при обновлении результата матча',
            details: err.message 
        });
    }
});

// Очистка результатов матчей (исправленная версия)
router.post('/:id/clear-match-results', authenticateToken, verifyAdminOrCreator, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        // Проверка турнира и прав доступа
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        
        const tournament = tournamentResult.rows[0];
        console.log(`🔍 Очистка результатов матчей для турнира ${id} пользователем ${userId}`);

        // Выполняем SQL-запрос для сброса результатов матчей
        const updateResult = await pool.query(
            `UPDATE matches 
             SET winner_team_id = NULL, 
                 score1 = 0, 
                 score2 = 0,
                 maps_data = NULL
             WHERE tournament_id = $1 
             RETURNING *`,
            [id]
        );

        console.log(`✅ Очищены результаты ${updateResult.rowCount} матчей для турнира ${id}`);

        // Получаем обновленные данные турнира
        const updatedTournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        const tournamentData = updatedTournamentResult.rows[0];
        
        // Получаем матчи
        const matchesResult = await pool.query(
            'SELECT * FROM matches WHERE tournament_id = $1 ORDER BY round, match_number',
            [id]
        );
        tournamentData.matches = matchesResult.rows;
        
        // Получаем участников
        let participantsQuery;
        if (tournament.participant_type === 'solo') {
            participantsQuery = `
                SELECT tp.*, u.avatar_url, u.username, u.faceit_elo 
                FROM tournament_participants tp 
                LEFT JOIN users u ON tp.user_id = u.id
                WHERE tp.tournament_id = $1
            `;
        } else {
            participantsQuery = `
                SELECT tt.*, u.avatar_url, u.username
                FROM tournament_teams tt
                LEFT JOIN users u ON tt.creator_id = u.id
                WHERE tt.tournament_id = $1
            `;
        }
        
        const participantsResult = await pool.query(participantsQuery, [id]);
        tournamentData.participants = participantsResult.rows;
        tournamentData.participant_count = participantsResult.rowCount;

        // Для командных турниров загружаем команды с участниками
        let teams = [];
        if (tournament.participant_type === 'team') {
            const teamsRes = await pool.query(
                `SELECT tt.id, tt.tournament_id, tt.name, tt.creator_id
                 FROM tournament_teams tt
                 WHERE tt.tournament_id = $1`,
                [id]
            );

            teams = await Promise.all(teamsRes.rows.map(async (team) => {
                const membersRes = await pool.query(
                    `SELECT tm.team_id, tm.user_id, tm.participant_id, 
                            tp.name, u.username, u.avatar_url, u.faceit_elo, u.cs2_premier_rank
                     FROM tournament_team_members tm
                     LEFT JOIN tournament_participants tp ON tm.participant_id = tp.id
                     LEFT JOIN users u ON tm.user_id = u.id
                     WHERE tm.team_id = $1`,
                    [team.id]
                );

                return {
                    ...team,
                    members: membersRes.rows
                };
            }));
        }

        tournamentData.teams = teams;
        tournamentData.mixed_teams = teams; // Для обратной совместимости

        // Уведомляем всех клиентов, просматривающих этот турнир
        try {
            broadcastTournamentUpdate(id, tournamentData);
        } catch (broadcastError) {
            console.error('⚠️ Ошибка при отправке обновления через WebSocket:', broadcastError);
            // Не останавливаем выполнение из-за ошибки WebSocket
        }

        res.status(200).json({ 
            message: `Успешно очищены результаты ${updateResult.rowCount} матчей`,
            tournament: tournamentData
        });
        
    } catch (err) {
        console.error('❌ Ошибка очистки результатов матчей турнира:', err);
        
        // Возвращаем более детальную ошибку
        const errorMessage = err.message || 'Неизвестная ошибка при очистке результатов матчей';
        res.status(500).json({ 
            error: 'Ошибка очистки результатов матчей',
            details: errorMessage,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router; 