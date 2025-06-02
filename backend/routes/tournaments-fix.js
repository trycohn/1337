// Временный фикс для endpoint очистки результатов матчей
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, verifyAdminOrCreator } = require('../middleware/auth');
const { broadcastTournamentUpdate } = require('../notifications');

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