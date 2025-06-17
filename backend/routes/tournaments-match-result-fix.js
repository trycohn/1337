// Временный файл с исправленной функцией обновления результатов матча
// Этот код нужно скопировать в tournaments.js вместо существующей функции

// Обновление результатов матча
router.post('/matches/:matchId/result', authenticateToken, verifyEmailRequired, async (req, res) => {
    const { matchId } = req.params;
    const { winner_team_id, score1, score2, maps_data } = req.body; // 🆕 Добавляем maps_data
    const userId = req.user.id;

    try {
        // Преобразуем matchId в число
        const matchIdNum = Number(matchId);

        // Получение данных текущего матча
        const matchResult = await pool.query('SELECT * FROM matches WHERE id = $1', [matchIdNum]);
        if (matchResult.rows.length === 0) {
            return res.status(404).json({ error: 'Матч не найден' });
        }
        const match = matchResult.rows[0];
        const tournamentId = match.tournament_id; // 🔧 Получаем ID турнира из матча

        // Проверка турнира и прав доступа
        const tournamentResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        const tournament = tournamentResult.rows[0];

        if (tournament.created_by !== userId) {
            const adminCheck = await pool.query(
                'SELECT * FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
                [tournamentId, userId]
            );
            if (adminCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Только создатель или администратор может обновлять результаты матча' });
            }
        }

        // Запрет изменения результата, если следующий матч уже сыгран (есть winner_team_id)
        for (const nextMatchId of [match.next_match_id, match.loser_next_match_id]) {
            if (nextMatchId) {
                const nextRes = await pool.query(
                    'SELECT winner_team_id FROM matches WHERE id = $1',
                    [nextMatchId]
                );
                if (nextRes.rows.length && nextRes.rows[0].winner_team_id) {
                    return res.status(400).json({ error: 'Нельзя изменить результат: следующий матч уже сыгран' });
                }
            }
        }
        
        if (match.winner_team_id && match.winner_team_id === winner_team_id) {
            return res.status(400).json({ error: 'Этот победитель уже установлен' });
        }

        // Проверка, что winner_team_id является одним из участников матча
        if (winner_team_id && ![match.team1_id, match.team2_id].includes(winner_team_id)) {
            return res.status(400).json({ error: 'Победитель должен быть одним из участников матча' });
        }

        // Проверяем, изменились ли данные матча (счет, карты)
        const scoreChanged = match.score1 !== score1 || match.score2 !== score2;
        const mapsChanged = maps_data && Array.isArray(maps_data) && maps_data.length > 0; // 🔧 maps -> maps_data
        
        // Разрешаем обновление, если:
        // 1. Победитель изменился
        // 2. Изменился счет
        // 3. Добавлены/изменены данные о картах
        if (match.winner_team_id === winner_team_id && !scoreChanged && !mapsChanged) {
            return res.status(400).json({ error: 'Результат матча не изменился' });
        }

        // Обновление результата текущего матча (включая maps_data)
        await pool.query(
            'UPDATE matches SET winner_team_id = $1, score1 = $2, score2 = $3, maps_data = $4 WHERE id = $5',
            [winner_team_id, score1, score2, maps_data ? JSON.stringify(maps_data) : null, matchIdNum]
        );

        // Определяем проигравшего
        const loser_team_id = match.team1_id === winner_team_id ? match.team2_id : match.team1_id;

        // Перемещаем победителя в следующий матч, если он есть
        if (winner_team_id && match.next_match_id) {
            const nextMatchResult = await pool.query('SELECT * FROM matches WHERE id = $1', [match.next_match_id]);
            if (nextMatchResult.rows.length > 0) {
                const nextMatch = nextMatchResult.rows[0];
                console.log(`Следующий матч для победителя: ${nextMatch.match_number}`);

                // Определяем, в какую позицию (team1 или team2) добавить победителя
                if (!nextMatch.team1_id) {
                    await pool.query('UPDATE matches SET team1_id = $1 WHERE id = $2', [winner_team_id, nextMatch.id]);
                    console.log(`Победитель (${winner_team_id}) помещен в позицию team1 матча ${nextMatch.match_number}`);
                } else if (!nextMatch.team2_id) {
                    await pool.query('UPDATE matches SET team2_id = $1 WHERE id = $2', [winner_team_id, nextMatch.id]);
                    console.log(`Победитель (${winner_team_id}) помещен в позицию team2 матча ${nextMatch.match_number}`);
                } else {
                    console.log(`Обе позиции в матче ${nextMatch.match_number} уже заняты`);
                }
            }
        }

        // Перемещаем проигравшего в матч за 3-е место, если это полуфинал и есть loser_next_match_id
        if (loser_team_id && match.loser_next_match_id) {
            const loserNextMatchResult = await pool.query('SELECT * FROM matches WHERE id = $1', [match.loser_next_match_id]);
            if (loserNextMatchResult.rows.length > 0) {
                const loserNextMatch = loserNextMatchResult.rows[0];
                console.log(`Матч для проигравшего: ${loserNextMatch.match_number} (матч за 3-е место)`);

                // Определяем, в какую позицию (team1 или team2) добавить проигравшего
                if (!loserNextMatch.team1_id) {
                    await pool.query('UPDATE matches SET team1_id = $1 WHERE id = $2', [loser_team_id, loserNextMatch.id]);
                    console.log(`Проигравший (${loser_team_id}) помещен в позицию team1 матча ${loserNextMatch.match_number}`);
                } else if (!loserNextMatch.team2_id) {
                    await pool.query('UPDATE matches SET team2_id = $1 WHERE id = $2', [loser_team_id, loserNextMatch.id]);
                    console.log(`Проигравший (${loser_team_id}) помещен в позицию team2 матча ${loserNextMatch.match_number}`);
                } else {
                    console.log(`Обе позиции в матче ${loserNextMatch.match_number} уже заняты`);
                }
            }
        }

        // Логика для предварительного раунда (раунд -1)
        if (match.round === -1) {
            // Эта логика уже обработана выше при проверке match.next_match_id
            console.log('Обработан предварительный раунд');
        }

        // Логика для Double Elimination
        if (tournament.format === 'double_elimination') {
            if (match.round !== -1 && match.next_match_id) {
                const nextMatchResult = await pool.query('SELECT * FROM matches WHERE id = $1', [match.next_match_id]);
                if (nextMatchResult.rows.length > 0) {
                    const nextMatch = nextMatchResult.rows[0];

                    // Проверяем, не добавлен ли победитель уже в следующий матч
                    if (nextMatch.team1_id === winner_team_id || nextMatch.team2_id === winner_team_id) {
                        console.log(`Победитель (team ${winner_team_id}) уже добавлен в матч ${nextMatch.id}`);
                    } else if (!nextMatch.team1_id) {
                        await pool.query('UPDATE matches SET team1_id = $1 WHERE id = $2', [winner_team_id, nextMatch.id]);
                    } else if (!nextMatch.team2_id && nextMatch.team1_id !== winner_team_id) {
                        await pool.query('UPDATE matches SET team2_id = $1 WHERE id = $2', [winner_team_id, nextMatch.id]);
                    } else if (nextMatch.team1_id === nextMatch.team2_id) {
                        await pool.query('UPDATE matches SET team2_id = $1 WHERE id = $2', [winner_team_id, nextMatch.id]);
                    } else {
                        const roundMatches = await pool.query(
                            'SELECT * FROM matches WHERE tournament_id = $1 AND round = $2 AND bracket_type = $3',
                            [tournamentId, match.round + 1, 'winner'] // 🔧 id -> tournamentId
                        );
                        const availableMatch = roundMatches.rows.find(m => !m.team2_id && m.team1_id !== winner_team_id);
                        if (availableMatch) {
                            await pool.query('UPDATE matches SET team2_id = $1 WHERE id = $2', [winner_team_id, availableMatch.id]);
                            await pool.query('UPDATE matches SET next_match_id = $1 WHERE id = $2', [availableMatch.id, matchId]);
                        } else {
                            return res.status(400).json({ error: 'Нет доступных мест в верхней сетке' });
                        }
                    }
                }
            }

            // Проигравший переходит в нижнюю сетку или выбывает
            if (loser_team_id) {
                if (match.bracket_type === 'winner') {
                    // Проигравший из верхней сетки переходит в нижнюю
                    let targetLoserRound;
                    const totalWinnerRounds = Math.ceil(Math.log2(6)); // Для 6 участников: 3 раунда (0, 1, 2)
                    const totalLoserRounds = totalWinnerRounds + 1; // 4 раунда (1, 2, 3, 4)

                    if (match.round === -1) {
                        targetLoserRound = 1;
                    } else if (match.round === totalWinnerRounds - 1) {
                        // Проигравший из финала верхней сетки (Round 2) должен попасть в финал нижней сетки (Round 4)
                        targetLoserRound = totalLoserRounds;
                    } else {
                        // Проигравшие из Round 0 верхней сетки -> Round 1 нижней, Round 1 верхней -> Round 2 нижней и т.д.
                        targetLoserRound = match.round + 1;
                    }

                    let loserMatches = await pool.query(
                        'SELECT * FROM matches WHERE tournament_id = $1 AND bracket_type = $2 AND round = $3 AND is_third_place_match = false',
                        [tournamentId, 'loser', targetLoserRound] // 🔧 id -> tournamentId
                    );

                    let availableLoserMatch = loserMatches.rows.find(m => (!m.team1_id || !m.team2_id) && m.team1_id !== loser_team_id && m.team2_id !== loser_team_id);

                    if (!availableLoserMatch) {
                        const maxMatchNumberResult = await pool.query(
                            'SELECT COALESCE(MAX(match_number), 0) as max_match_number FROM matches WHERE tournament_id = $1 AND bracket_type = $2 AND round = $3',
                            [tournamentId, 'loser', targetLoserRound] // 🔧 id -> tournamentId
                        );
                        const maxMatchNumber = maxMatchNumberResult.rows[0].max_match_number;

                        const newMatchResult = await pool.query(
                            'INSERT INTO matches (tournament_id, round, match_number, bracket_type, team1_id, team2_id, match_date) ' +
                            'VALUES ($1, $2, $3, $4, $5, NULL, NOW()) RETURNING *',
                            [tournamentId, targetLoserRound, maxMatchNumber + 1, 'loser', loser_team_id] // 🔧 id -> tournamentId
                        );
                        availableLoserMatch = newMatchResult.rows[0];
                        console.log(`Создан новый матч ${availableLoserMatch.id} в раунде ${targetLoserRound} сетки лузеров для проигравшего (team ${loser_team_id})`);
                    } else {
                        if (!availableLoserMatch.team1_id) {
                            await pool.query('UPDATE matches SET team1_id = $1 WHERE id = $2', [loser_team_id, availableLoserMatch.id]);
                        } else {
                            await pool.query('UPDATE matches SET team2_id = $1 WHERE id = $2', [loser_team_id, availableLoserMatch.id]);
                        }
                        console.log(`Проигравший (team ${loser_team_id}) из раунда ${match.round} верхней сетки добавлен в матч ${availableLoserMatch.id} раунда ${targetLoserRound} сетки лузеров`);
                    }
                } else if (match.bracket_type === 'loser') {
                    // Проигравший из нижней сетки выбывает из турнира
                    console.log(`Проигравший (team ${loser_team_id}) из матча ${match.id} нижней сетки выбывает из турнира`);
                }
            }
        }

        // Получаем обновлённые данные турнира
        const updatedTournament = await pool.query(
            'SELECT t.*, ' +
            '(SELECT COALESCE(json_agg(to_jsonb(tp) || jsonb_build_object(\'avatar_url\', u.avatar_url)), \'[]\') FROM tournament_participants tp LEFT JOIN users u ON tp.user_id = u.id WHERE tp.tournament_id = t.id) as participants, ' +
            '(SELECT COALESCE(json_agg(m.*), \'[]\') FROM matches m WHERE m.tournament_id = t.id) as matches ' +
            'FROM tournaments t WHERE t.id = $1',
            [tournamentId] // 🔧 matchIdNum -> tournamentId
        );

        const tournamentData = updatedTournament.rows[0] || {};
        tournamentData.matches = Array.isArray(tournamentData.matches) && tournamentData.matches[0] !== null 
            ? tournamentData.matches 
            : [];
        tournamentData.participants = Array.isArray(tournamentData.participants) && tournamentData.participants[0] !== null 
            ? tournamentData.participants 
            : [];

        // Отправляем обновления всем клиентам, просматривающим этот турнир
        broadcastTournamentUpdate(tournamentId, tournamentData); // 🔧 matchIdNum -> tournamentId

        console.log('🔍 Match updated for tournament:', tournamentData);
        res.status(200).json({ message: 'Результат обновлён', tournament: tournamentData });
    } catch (err) {
        console.error('❌ Ошибка обновления результатов матча:', err);
        res.status(500).json({ error: err.message });
    }
}); 