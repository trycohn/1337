// backend/services/tournament/BracketService.js

const { generateBracket } = require('../../bracketGenerator');
const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
const ParticipantRepository = require('../../repositories/tournament/ParticipantRepository');
const MatchRepository = require('../../repositories/tournament/MatchRepository');
const { logTournamentEvent } = require('../../utils/tournament/logger');
const { sendTournamentChatAnnouncement } = require('../../utils/tournament/chatHelpers');
const { broadcastTournamentUpdate } = require('../../notifications');
const pool = require('../../db');

// 🔒 Хранилище времени последних регенераций для debounce защиты
const lastRegenerationTimes = new Map();
const REGENERATION_DEBOUNCE_MS = 2000; // 2 секунды между регенерациями (временно для тестирования)

class BracketService {
    /**
     * Проверка debounce для регенерации
     * @param {number} tournamentId - ID турнира
     * @returns {boolean} - можно ли выполнить регенерацию
     */
    static _checkRegenerationDebounce(tournamentId) {
        const now = Date.now();
        const lastTime = lastRegenerationTimes.get(tournamentId) || 0;
        const timePassed = now - lastTime;
        
        if (timePassed < REGENERATION_DEBOUNCE_MS) {
            const timeLeft = Math.ceil((REGENERATION_DEBOUNCE_MS - timePassed) / 1000);
            throw new Error(`Слишком частая регенерация! Попробуйте через ${timeLeft} секунд.`);
        }
        
        // Обновляем время последней регенерации
        lastRegenerationTimes.set(tournamentId, now);
        
        console.log(`✅ [BracketService] Debounce проверка пройдена для турнира ${tournamentId}`);
        return true;
    }

    /**
     * Генерация турнирной сетки
     */
    static async generateBracket(tournamentId, userId, thirdPlaceMatch = false) {
        console.log(`🥊 BracketService: Генерация турнирной сетки для турнира ${tournamentId}`);

        // Проверка прав доступа
        await this._checkBracketAccess(tournamentId, userId);

        // Получаем турнир
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }

        if (tournament.status !== 'active') {
            throw new Error('Можно генерировать сетку только для активных турниров');
        }

        // Получаем участников или команды в зависимости от формата турнира
        let participantsForBracket;
        let participantCount;
        
        if (tournament.format === 'mix') {
            // Для микс турниров получаем команды
            console.log(`🎯 [generateBracket] Получаем команды для микс турнира ${tournamentId}`);
            const teams = await this._getMixTeams(tournamentId);
            
            // Добавляем защиту от undefined
            if (!teams) {
                console.error(`❌ [generateBracket] Метод _getMixTeams вернул undefined для турнира ${tournamentId}`);
                throw new Error('Не удалось получить команды микс турнира. Возможно команды еще не сформированы.');
            }
            
            if (!Array.isArray(teams)) {
                console.error(`❌ [generateBracket] _getMixTeams вернул не массив:`, typeof teams, teams);
                throw new Error('Некорректный формат данных команд микс турнира');
            }
            
            console.log(`📊 [generateBracket] Получено команд: ${teams.length}`);
            
            if (teams.length < 2) {
                throw new Error('Для генерации сетки микс турнира необходимо минимум 2 команды. Сначала сформируйте команды.');
            }
            participantsForBracket = teams;
            participantCount = teams.length;
            console.log(`📊 Команд в микс турнире: ${teams.length}`);
        } else {
            // Для обычных турниров получаем участников
            const participants = await ParticipantRepository.getByTournamentId(tournamentId);
            if (participants.length < 2) {
                throw new Error('Для генерации сетки необходимо минимум 2 участника');
            }
            participantsForBracket = participants;
            participantCount = participants.length;
            console.log(`📊 Участников в турнире: ${participants.length}`);
        }

        // Проверяем, есть ли уже матчи
        const existingMatchCount = await MatchRepository.getCountByTournamentId(tournamentId);
        if (existingMatchCount > 0) {
            console.log(`🔍 [generateBracket] Сетка уже существует для турнира ${tournamentId} (${existingMatchCount} матчей). Возвращаем существующую сетку.`);
            
            // Получаем существующие матчи
            const existingMatches = await MatchRepository.getByTournamentId(tournamentId);
            const updatedTournament = await TournamentRepository.getByIdWithCreator(tournamentId);
            
            return {
                success: true,
                matches: existingMatches,
                totalMatches: existingMatches.length,
                message: `Турнирная сетка уже сгенерирована: ${existingMatches.length} матчей`,
                tournament: updatedTournament,
                existing: true // Флаг что сетка уже существовала
            };
        }

        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Генерируем сетку с помощью bracketGenerator
            const bracketData = await generateBracket(
                tournament.format,
                tournamentId,
                participantsForBracket,
                thirdPlaceMatch
            );

            console.log(`🎯 Сгенерирована сетка: ${bracketData.matches.length} матчей`);
            
            // Проверяем, что сетка была сгенерирована корректно
            if (!bracketData.matches || bracketData.matches.length === 0) {
                throw new Error('Не удалось создать турнирную сетку - сгенерировано 0 матчей');
            }

            // Логируем событие создания сетки
            await logTournamentEvent(tournamentId, userId, 'bracket_generated', {
                matchesCount: bracketData.matches.length,
                format: tournament.format,
                thirdPlaceMatch
            });

            // Сохраняем матчи в базу данных
            const savedMatches = [];
            for (const match of bracketData.matches) {
                const matchResult = await client.query(`
                    INSERT INTO matches (
                        tournament_id, round, match_number,
                        team1_id, team2_id, next_match_id, loser_next_match_id,
                        is_third_place_match, bracket_type, target_slot
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    RETURNING *
                `, [
                    tournamentId,
                    match.round,
                    match.match_number,
                    match.team1_id || null,
                    match.team2_id || null,
                    match.next_match_id || null,
                    match.loser_next_match_id || null,
                    match.is_third_place_match || false,
                    match.bracket_type || 'main',
                    match.target_slot || null
                ]);

                savedMatches.push(matchResult.rows[0]);
            }

            // Обновляем связи между матчами
            await this._updateMatchLinks(client, savedMatches, bracketData.matches);

            await client.query('COMMIT');

            // Отправляем уведомления
            try {
                await broadcastTournamentUpdate(tournamentId);
                await sendTournamentChatAnnouncement(
                    tournamentId, 
                    `🥊 Турнирная сетка сгенерирована! Создано ${bracketData.matches.length} матчей.`,
                    'system',
                    userId
                );
            } catch (notificationError) {
                console.error('⚠️ Ошибка отправки уведомлений:', notificationError.message);
                // Не прерываем выполнение из-за ошибок уведомлений
            }

            // Получаем обновленные данные турнира
            const updatedTournament = await TournamentRepository.getByIdWithCreator(tournamentId);

            console.log(`✅ BracketService: Турнирная сетка успешно сгенерирована для турнира ${tournamentId}`);

            return {
                success: true,
                matches: bracketData.matches,
                totalMatches: bracketData.matches.length,
                message: `Турнирная сетка успешно сгенерирована: ${bracketData.matches.length} матчей`,
                tournament: updatedTournament
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ BracketService: Ошибка генерации сетки:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Регенерация турнирной сетки (с перемешиванием)
     */
    static async regenerateBracket(tournamentId, userId, shuffle = false, thirdPlaceMatch = false) {
        console.log(`🔄 BracketService: Регенерация турнирной сетки для турнира ${tournamentId} (shuffle: ${shuffle})`);

        // 🔒 Проверка debounce защиты от частых регенераций
        this._checkRegenerationDebounce(tournamentId);

        // Проверка прав доступа
        await this._checkBracketAccess(tournamentId, userId);

        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }

        if (tournament.status !== 'active') {
            throw new Error('Можно регенерировать сетку только для активных турниров');
        }

        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Удаляем существующие матчи
            const deletedMatches = await client.query(
                'DELETE FROM matches WHERE tournament_id = $1 RETURNING id',
                [tournamentId]
            );

            console.log(`🗑️ Удалено ${deletedMatches.rows.length} старых матчей`);

            await client.query('COMMIT');

            // Генерируем новую сетку
            const result = await this.generateBracket(tournamentId, userId, thirdPlaceMatch);

            // Отправляем объявление в чат
            await sendTournamentChatAnnouncement(
                tournamentId,
                `🔄 Турнирная сетка перегенерирована! ${shuffle ? 'Участники перемешаны. ' : ''}Ссылка на сетку: /tournaments/${tournamentId}`,
                'system',
                userId
            );

            // Логируем событие
            await logTournamentEvent(tournamentId, userId, 'bracket_regenerated', {
                shuffle: shuffle,
                deleted_matches: deletedMatches.rows.length,
                new_matches: result.matches.length
            });

            console.log('✅ BracketService: Турнирная сетка успешно регенерирована');
            return {
                ...result,
                message: `Турнирная сетка перегенерирована${shuffle ? ' с перемешиванием участников' : ''}`
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ BracketService: Ошибка регенерации сетки:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Очистка результатов матчей (сброс турнира)
     */
    static async clearMatchResults(tournamentId, userId) {
        console.log(`🧹 BracketService: Очистка результатов матчей турнира ${tournamentId}`);

        // Проверка прав доступа
        await this._checkBracketAccess(tournamentId, userId);

        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Сбрасываем результаты всех матчей
            const resetResult = await client.query(`
                UPDATE matches 
                SET winner_team_id = NULL, score1 = NULL, score2 = NULL, maps_data = NULL 
                WHERE tournament_id = $1
                RETURNING id
            `, [tournamentId]);

            // Возвращаем участников в начальные позиции
            await this._resetMatchParticipants(client, tournamentId);

            await client.query('COMMIT');

            // Отправляем объявление в чат
            await sendTournamentChatAnnouncement(
                tournamentId,
                `🧹 Результаты всех матчей сброшены. Турнир готов к перепроведению. Ссылка: /tournaments/${tournamentId}`,
                'system',
                userId
            );

            // Логируем событие
            await logTournamentEvent(tournamentId, userId, 'match_results_cleared', {
                cleared_matches: resetResult.rows.length
            });

            // Получаем обновленные данные
            const updatedTournament = await TournamentRepository.getByIdWithCreator(tournamentId);
            broadcastTournamentUpdate(tournamentId, updatedTournament);

            console.log('✅ BracketService: Результаты матчей очищены');
            return {
                message: 'Результаты всех матчей успешно сброшены',
                tournament: updatedTournament,
                cleared_matches: resetResult.rows.length
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ BracketService: Ошибка очистки результатов:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Получение турнирной сетки
     */
    static async getBracket(tournamentId) {
        console.log(`📋 BracketService: Получение турнирной сетки ${tournamentId}`);

        const matches = await MatchRepository.getByTournamentId(tournamentId);
        
        // Группируем матчи по раундам
        const bracket = matches.reduce((acc, match) => {
            if (!acc[match.round]) {
                acc[match.round] = [];
            }
            acc[match.round].push(match);
            return acc;
        }, {});

        // Сортируем матчи внутри каждого раунда по match_number
        Object.keys(bracket).forEach(round => {
            bracket[round].sort((a, b) => (a.match_number || 0) - (b.match_number || 0));
        });

        return bracket;
    }

    /**
     * Обновление связей между матчами после генерации
     * @private
     */
    static async _updateMatchLinks(client, savedMatches, originalMatches) {
        console.log('🔗 Обновление связей между матчами...');

        // Создаем мапинг старых ID на новые
        const idMapping = {};
        originalMatches.forEach((original, index) => {
            if (original.temp_id) {
                idMapping[original.temp_id] = savedMatches[index].id;
            }
        });

        // Обновляем связи
        for (let i = 0; i < savedMatches.length; i++) {
            const match = savedMatches[i];
            const original = originalMatches[i];

            let nextMatchId = null;
            let loserNextMatchId = null;

            if (original.next_match_temp_id && idMapping[original.next_match_temp_id]) {
                nextMatchId = idMapping[original.next_match_temp_id];
            }

            if (original.loser_next_match_temp_id && idMapping[original.loser_next_match_temp_id]) {
                loserNextMatchId = idMapping[original.loser_next_match_temp_id];
            }

            if (nextMatchId || loserNextMatchId) {
                await client.query(
                    'UPDATE matches SET next_match_id = $1, loser_next_match_id = $2 WHERE id = $3',
                    [nextMatchId, loserNextMatchId, match.id]
                );
            }
        }
    }

    /**
     * Сброс участников матчей в начальные позиции
     * @private
     */
    static async _resetMatchParticipants(client, tournamentId) {
        console.log('🔄 Сброс участников в начальные позиции...');

        // Получаем турнир для определения формата
        const tournament = await TournamentRepository.getById(tournamentId);
        
        let participants;
        if (tournament.format === 'mix') {
            // Для микс турниров получаем команды
            participants = await this._getMixTeams(tournamentId);
        } else {
            // Для обычных турниров получаем участников
            participants = await ParticipantRepository.getByTournamentId(tournamentId);
        }
        
        // Получаем матчи первого раунда
        const firstRoundMatches = await client.query(
            'SELECT * FROM matches WHERE tournament_id = $1 AND round = 1 ORDER BY position',
            [tournamentId]
        );

        // Очищаем все матчи от участников кроме первого раунда
        await client.query(
            'UPDATE matches SET team1_id = NULL, team2_id = NULL WHERE tournament_id = $1 AND round > 1',
            [tournamentId]
        );

        // Заполняем первый раунд участниками
        for (let i = 0; i < firstRoundMatches.rows.length && i * 2 < participants.length; i++) {
            const match = firstRoundMatches.rows[i];
            const participant1 = participants[i * 2];
            const participant2 = participants[i * 2 + 1] || null;

            await client.query(
                'UPDATE matches SET team1_id = $1, team2_id = $2 WHERE id = $3',
                [participant1.id, participant2?.id, match.id]
            );
        }
    }

    /**
     * Получение команд микс турнира в формате, совместимом с генератором сетки
     * @private
     */
    static async _getMixTeams(tournamentId) {
        console.log(`🏆 [_getMixTeams] Получение команд микс турнира ${tournamentId}`);

        try {
            const teamsQuery = await pool.query(`
                SELECT 
                    tt.id,
                    tt.name,
                    COUNT(ttm.user_id) as members_count,
                    ARRAY_AGG(
                        JSON_BUILD_OBJECT(
                            'id', u.id,
                            'username', u.username,
                            'avatar_url', u.avatar_url
                        ) ORDER BY ttm.id
                    ) as members
                FROM tournament_teams tt
                LEFT JOIN tournament_team_members ttm ON tt.id = ttm.team_id
                LEFT JOIN users u ON ttm.user_id = u.id
                WHERE tt.tournament_id = $1
                GROUP BY tt.id, tt.name
                ORDER BY tt.id
            `, [tournamentId]);

            console.log(`🔍 [_getMixTeams] SQL запрос выполнен, найдено строк: ${teamsQuery.rows.length}`);
            
            if (teamsQuery.rows.length === 0) {
                console.warn(`⚠️ [_getMixTeams] Не найдено команд для турнира ${tournamentId}`);
                return [];
            }

            const teams = teamsQuery.rows.map(team => ({
                id: team.id,
                name: team.name,
                members: team.members.filter(member => member.id !== null)
            }));

            console.log(`✅ [_getMixTeams] Обработано команд: ${teams.length}`);
            teams.forEach((team, index) => {
                console.log(`   📋 Команда ${index + 1}: "${team.name}" (ID: ${team.id}, участников: ${team.members.length})`);
            });

            return teams;

        } catch (error) {
            console.error(`❌ [_getMixTeams] Ошибка при получении команд турнира ${tournamentId}:`, error);
            throw error;
        }
    }

    /**
     * Проверка прав доступа для операций с сеткой
     * @private
     */
    static async _checkBracketAccess(tournamentId, userId) {
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }

        if (tournament.created_by !== userId) {
            const isAdmin = await TournamentRepository.isAdmin(tournamentId, userId);
            if (!isAdmin) {
                throw new Error('Только создатель или администратор может управлять турнирной сеткой');
            }
        }
    }
}

module.exports = BracketService; 