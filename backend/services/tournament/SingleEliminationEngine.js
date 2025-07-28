/**
 * ⚡ ДВИЖОК SINGLE ELIMINATION
 * 
 * Основной движок для генерации турнирной сетки Single Elimination
 * с поддержкой различных типов распределения и максимальной валидацией
 */

const { BracketMath } = require('../../utils/tournament/bracketMath');
const { SeedingFactory, SEEDING_TYPES } = require('../../utils/tournament/seedingAlgorithms');
const pool = require('../../db');

/**
 * 🏆 Основной класс движка Single Elimination
 */
class SingleEliminationEngine {
    
    /**
     * 🎯 Генерация полной турнирной сетки
     * @param {number} tournamentId - ID турнира
     * @param {Array} participants - Массив участников или команд
     * @param {Object} options - Опции генерации
     * @returns {Object} - Результат генерации с матчами и метаданными
     */
    static async generateBracket(tournamentId, participants, options = {}) {
        const startTime = Date.now();
        console.log(`⚡ [SingleEliminationEngine] Начало генерации турнирной сетки для турнира ${tournamentId}`);
        console.log(`👥 [SingleEliminationEngine] Получено участников: ${participants.length}`);
        
        try {
            // 1. Валидация входных данных
            this._validateInput(tournamentId, participants, options);
            
            // 2. Расчет математических параметров - используем ВСЕХ участников
            const bracketMath = BracketMath.calculateSingleEliminationParams(
                participants.length,  // 🔧 ИСПРАВЛЕНО: используем реальное количество участников
                { thirdPlaceMatch: options.thirdPlaceMatch || false }
            );
            
            console.log(`📊 Математические параметры для ${participants.length} участников:`, {
                originalParticipants: bracketMath.originalParticipantCount,
                actualParticipants: bracketMath.actualParticipants,
                excludedParticipants: bracketMath.excludedParticipants,
                needsPreliminaryRound: bracketMath.needsPreliminaryRound,
                preliminaryMatches: bracketMath.preliminaryMatches,
                preliminaryParticipants: bracketMath.preliminaryParticipants,
                directAdvancers: bracketMath.directAdvancers,
                totalMatches: bracketMath.totalMatches,
                rounds: bracketMath.rounds
            });
            
            // 3. Применение алгоритма распределения - используем ВСЕХ участников без ограничений
            const seedingType = options.seedingType || SEEDING_TYPES.RANDOM;
            console.log(`🎲 Применяем распределение типа ${seedingType} для ${participants.length} участников`);
            
            const seededParticipants = SeedingFactory.createSeeding(
                seedingType,
                participants, // Все участники
                participants.length, // 🔧 КРИТИЧЕСКИ ВАЖНО: передаем именно participants.length, а НЕ bracketMath.actualParticipants
                options.seedingOptions || {}
            );
            
            // 🔧 ДОБАВЛЯЕМ ПРОВЕРКУ: убеждаемся что не потеряли участников
            if (seededParticipants.length !== participants.length) {
                console.error(`❌ КРИТИЧЕСКАЯ ОШИБКА: Потеряли участников!`);
                console.error(`   Было: ${participants.length}, стало: ${seededParticipants.length}`);
                throw new Error(`Потерян ${participants.length - seededParticipants.length} участник(ов) при распределении`);
            }
            
            console.log(`✅ Распределение участников: тип ${seedingType}, количество ${seededParticipants.length} (сохранены ВСЕ)`);
            
            // 4. Генерация структуры матчей с поддержкой bye-проходов
            const matches = await this._generateMatches(
                tournamentId,
                seededParticipants,
                bracketMath,
                options
            );
            
            // 5. Финальная валидация
            const validationResult = this._validateGeneratedBracket(matches, bracketMath);
            if (!validationResult.isValid) {
                throw new Error(`Валидация сетки не прошла: ${validationResult.errors.join(', ')}`);
            }
            
            const duration = Date.now() - startTime;
            console.log(`✅ [SingleEliminationEngine] Сетка успешно сгенерирована за ${duration}ms`);
            console.log(`🎉 ИТОГ: Использовано ${seededParticipants.length} из ${participants.length} участников (потерь: 0)`);
            
            return {
                success: true,
                matches,
                excludedParticipants: [], // 🔧 ИСПРАВЛЕНО: больше не исключаем участников
                bracketMath,
                seedingInfo: {
                    type: seedingType,
                    participantsUsed: seededParticipants.length,
                    participantsExcluded: 0, // 🔧 ИСПРАВЛЕНО: никого не исключаем
                    participantsOriginal: participants.length // 🆕 ДОБАВЛЕНО: исходное количество
                },
                generationTime: duration,
                generatedAt: new Date().toISOString()
            };
            
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [SingleEliminationEngine] Ошибка генерации (${duration}ms):`, error.message);
            
            return {
                success: false,
                error: error.message,
                generationTime: duration,
                generatedAt: new Date().toISOString()
            };
        }
    }
    
    /**
     * 🔧 Генерация матчей для турнирной сетки
     * @param {number} tournamentId - ID турнира
     * @param {Array} participants - Распределенные участники
     * @param {Object} bracketMath - Математические параметры
     * @param {Object} options - Опции генерации
     * @returns {Array} - Массив сгенерированных матчей
     */
    static async _generateMatches(tournamentId, participants, bracketMath, options) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            console.log(`🏗️ [НОВАЯ АРХИТЕКТУРА] Создание полной турнирной сетки с предустановленными связями`);
            console.log(`📊 Параметры: ${participants.length} участников, ${bracketMath.totalMatches} матчей, ${bracketMath.rounds} раундов`);
            
            // 🆕 ШАГ 1: Создаем ВСЕ матчи турнира (пустые, без участников), включая матч за третье место
            const allMatches = await this._createAllTournamentMatches(client, tournamentId, bracketMath);
            console.log(`✅ Создано ${allMatches.length} матчей для всего турнира`);
            
            // 🆕 ШАГ 2: Устанавливаем ВСЕ связи next_match_id и loser_next_match_id между матчами
            await this._establishAllConnections(client, allMatches, participants, bracketMath);
            console.log(`🔗 Установлены все связи между матчами`);
            
            // 🆕 ШАГ 3: Размещаем участников ТОЛЬКО в стартовых матчах
            await this._placeParticipantsInStartingMatches(client, allMatches, participants, bracketMath);
            console.log(`👥 Участники размещены в стартовых матчах`);
            
            await client.query('COMMIT');
            
            console.log(`🎉 [НОВАЯ АРХИТЕКТУРА] Полная турнирная сетка создана: ${allMatches.length} матчей`);
            return allMatches;
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
    
    /**
     * 🆕 ШАГ 1: Создание ВСЕХ матчей турнира (пустых)
     * @param {Object} client - Клиент БД
     * @param {number} tournamentId - ID турнира  
     * @param {Object} bracketMath - Математические параметры
     * @returns {Array} - Все матчи турнира
     */
    static async _createAllTournamentMatches(client, tournamentId, bracketMath) {
        console.log(`🏗️ [createAllTournamentMatches] Создание структуры турнира`);
        
        const allMatches = [];
        const matchPromises = [];
        
        // Определяем стартовый раунд и количество раундов
        const startRound = bracketMath.needsPreliminaryRound ? 0 : 1;
        const totalRounds = bracketMath.needsPreliminaryRound ? bracketMath.mainRounds : bracketMath.rounds;
        
        console.log(`📊 Создаем раунды ${startRound} - ${totalRounds}`);
        
        // Создаем матчи для каждого раунда
        for (let round = startRound; round <= totalRounds; round++) {
            let matchesInRound;
            
            if (round === 0) {
                // Предварительный раунд
                matchesInRound = bracketMath.preliminaryMatches;
            } else if (round === 1) {
                // Первый основной раунд
                matchesInRound = bracketMath.firstRoundMatches;
            } else {
                // Последующие раунды: формула 2^(totalRounds - round)
                matchesInRound = Math.pow(2, totalRounds - round);
            }
            
            console.log(`🔧 Раунд ${round}: создаем ${matchesInRound} матчей`);
            
            // Создаем матчи для текущего раунда
            for (let matchNumber = 1; matchNumber <= matchesInRound; matchNumber++) {
                
                // 🆕 ОПРЕДЕЛЯЕМ ТИП МАТЧА: финальный, полуфинальный или обычный
                let bracketType = 'winner';
                
                // Финальный матч = последний раунд (totalRounds) и единственный матч в раунде
                if (round === totalRounds && matchesInRound === 1) {
                    bracketType = 'final';
                    console.log(`🏆 Матч ${matchNumber} в раунде ${round} помечен как ФИНАЛЬНЫЙ матч (за 1-е место)`);
                }
                // 🔧 ИСПРАВЛЕННАЯ ЛОГИКА: Полуфинальные матчи только при достаточном количестве участников
                // Полуфинал = предпоследний раунд с 2 матчами И участников >= 8 (настоящий полуфинал)
                else if (round === totalRounds - 1 && matchesInRound === 2 && bracketMath.originalParticipants >= 8) {
                    bracketType = 'semifinal';
                    console.log(`🥈 Матч ${matchNumber} в раунде ${round} помечен как ПОЛУФИНАЛЬНЫЙ матч`);
                }
                // 🔧 АЛЬТЕРНАТИВА: В малых турнирах предпоследний раунд остается обычным матчем
                else if (round === totalRounds - 1 && matchesInRound === 2 && bracketMath.originalParticipants < 8) {
                    bracketType = 'winner'; // Остается обычным матчем
                    console.log(`🎯 Матч ${matchNumber} в раунде ${round} - обычный матч (турнир слишком мал для полуфинала)`);
                }
                
                const matchData = {
                    tournament_id: tournamentId,
                    round: round,
                    match_number: matchNumber,
                    team1_id: null, // Будет заполнено позже для стартовых матчей
                    team2_id: null, // Будет заполнено позже для стартовых матчей
                    status: 'pending',
                    bracket_type: bracketType // 🆕 Используем определенный тип матча
                };
                
                const matchPromise = this._insertMatch(client, matchData);
                matchPromises.push(matchPromise);
            }
        }
        
        // Выполняем все вставки параллельно
        const insertedMatches = await Promise.all(matchPromises);
        allMatches.push(...insertedMatches);
        
        // 🔧 ДОБАВЛЯЕМ: Создание матча за 3-е место (если нужен)
        if (bracketMath.hasThirdPlaceMatch) {
            console.log(`🥉 Создаем матч за 3-е место в раунде ${totalRounds}`);
            
            const thirdPlaceMatchData = {
                tournament_id: tournamentId,
                round: totalRounds, // Тот же раунд, что и финал
                match_number: 0, // Меньший номер для отображения перед финалом
                team1_id: null, // Будет заполнено проигравшими полуфинала
                team2_id: null,
                status: 'pending',
                bracket_type: 'placement'
            };
            
            const thirdPlaceMatch = await this._insertMatch(client, thirdPlaceMatchData);
            allMatches.push(thirdPlaceMatch);
            
            console.log(`✅ Матч за 3-е место создан: ID ${thirdPlaceMatch.id}, раунд ${totalRounds}, match_number 0`);
        }
        
        // Сортируем матчи по раунду и номеру для удобства
        allMatches.sort((a, b) => {
            if (a.round !== b.round) return a.round - b.round;
            return a.match_number - b.match_number;
        });
        
        console.log(`✅ Создана структура турнира: ${allMatches.length} матчей`);
        return allMatches;
    }
    
    /**
     * 🆕 ШАГ 2: Установка ВСЕХ связей next_match_id
     * @param {Object} client - Клиент БД
     * @param {Array} allMatches - Все матчи турнира
     * @param {Object} bracketMath - Математические параметры
     */
    static async _establishAllConnections(client, allMatches, participants, bracketMath) {
        console.log(`🔗 [establishAllConnections] Установка всех связей между матчами`);
        
        const updatePromises = [];
        
        // 🔧 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Исключаем матчи за 3-е место и полуфинальные матчи из стандартной логики связывания
        // Финальные матчи исключаем для всех турниров, так как связи устанавливаются явно в секции матча за 3-е место
        const standardMatches = allMatches.filter(match => {
            if (match.bracket_type === 'placement') return false; // Всегда исключаем матчи за 3-е место
            if (match.bracket_type === 'semifinal') return false; // Всегда исключаем настоящие полуфинальные матчи
            if (match.bracket_type === 'final') return false; // Исключаем финал для всех турниров - связи устанавливаются явно
            return true;
        });
        
        console.log(`🔧 Исключены специальные матчи: используем ${standardMatches.length} из ${allMatches.length} матчей для стандартных связей`);
        console.log(`🔧 Финальные связи устанавливаются явно в секции матча за 3-е место`);
        
        // Группируем ТОЛЬКО стандартные матчи по раундам
        const matchesByRound = {};
        standardMatches.forEach(match => {
            if (!matchesByRound[match.round]) {
                matchesByRound[match.round] = [];
            }
            matchesByRound[match.round].push(match);
        });
        
        // Определяем диапазон раундов
        const startRound = bracketMath.needsPreliminaryRound ? 0 : 1;
        const totalRounds = bracketMath.needsPreliminaryRound ? bracketMath.mainRounds : bracketMath.rounds;
        
        console.log(`🔗 Связываем раунды ${startRound} - ${totalRounds - 1} с их следующими раундами (без матчей за 3-е место)`);
        
        // Связываем каждый раунд со следующим
        for (let round = startRound; round < totalRounds; round++) {
            const currentRoundMatches = matchesByRound[round] || [];
            let nextRoundMatches = matchesByRound[round + 1] || [];
            
            // 🆕 ИСПРАВЛЕНИЕ: Если следующий раунд пуст, но это может быть финальный раунд, включаем финальные матчи
            if (nextRoundMatches.length === 0 && round + 1 <= totalRounds) {
                const finalMatches = allMatches.filter(match => 
                    match.round === round + 1 && match.bracket_type === 'final'
                );
                if (finalMatches.length > 0) {
                    nextRoundMatches = finalMatches;
                    console.log(`🔧 Для связывания раунда ${round} включены финальные матчи: ${finalMatches.length} шт.`);
                }
            }
            
            console.log(`🔗 Раунд ${round} -> Раунд ${round + 1}: ${currentRoundMatches.length} -> ${nextRoundMatches.length} матчей`);
            
            if (round === 0 && bracketMath.needsPreliminaryRound) {
                // 🔧 ИСПРАВЛЕННАЯ ЛОГИКА для предварительного раунда
                await this._linkPreliminaryToFirstRound_v3(client, currentRoundMatches, nextRoundMatches, participants, bracketMath, updatePromises);
            } else {
                // 🔧 СТАНДАРТНАЯ ЛОГИКА для основных раундов
                await this._linkStandardRounds(client, currentRoundMatches, nextRoundMatches, updatePromises);
            }
        }
        
        // 🔧 НОВАЯ ЛОГИКА: Связываем полуфинальные матчи с матчем за 3-е место
        if (bracketMath.hasThirdPlaceMatch) {
            console.log(`🥉 Устанавливаем связи полуфинальных матчей с матчем за 3-е место`);
            
            // Находим матч за третье место
            const thirdPlaceMatch = allMatches.find(match => match.bracket_type === 'placement');
            
            // 🔧 УЛУЧШЕННАЯ ЛОГИКА: Находим матчи предпоследнего раунда
            // В больших турнирах (8+ участников) - это полуфинальные матчи (bracket_type = 'semifinal')
            // В малых турнирах (< 8 участников) - это обычные матчи предпоследнего раунда
            let semifinalMatches;
            
            if (bracketMath.originalParticipants >= 8) {
                // Большие турниры: ищем явно помеченные полуфинальные матчи
                semifinalMatches = allMatches.filter(match => match.bracket_type === 'semifinal');
                console.log(`🔍 Большой турнир: найдены полуфинальные матчи: ${semifinalMatches.length} шт. (по bracket_type = 'semifinal')`);
            } else {
                // Малые турниры: ищем матчи предпоследнего раунда с bracket_type = 'winner'
                const semifinalRound = totalRounds - 1;
                semifinalMatches = allMatches.filter(match => 
                    match.round === semifinalRound && 
                    match.bracket_type === 'winner'
                );
                console.log(`🔍 Малый турнир: найдены матчи предпоследнего раунда: ${semifinalMatches.length} шт. в раунде ${semifinalRound} (bracket_type = 'winner')`);
            }
            
            if (thirdPlaceMatch && semifinalMatches.length === 2) {
                console.log(`🎯 Матч за 3-е место: ID ${thirdPlaceMatch.id}, раунд ${thirdPlaceMatch.round}, match_number ${thirdPlaceMatch.match_number}`);
                
                // Устанавливаем loser_next_match_id для каждого матча предпоследнего раунда
                for (const semifinalMatch of semifinalMatches) {
                    const updatePromise = client.query(
                        'UPDATE matches SET loser_next_match_id = $1 WHERE id = $2',
                        [thirdPlaceMatch.id, semifinalMatch.id]
                    );
                    updatePromises.push(updatePromise);
                    
                    console.log(`🔗 Матч ${semifinalMatch.id} (M${semifinalMatch.match_number}) (проигравший) -> Матч за 3-е место ${thirdPlaceMatch.id}`);
                }
                
                // 🆕 ДОПОЛНИТЕЛЬНО: Устанавливаем связи с финалом только для настоящих полуфинальных матчей
                if (bracketMath.originalParticipants >= 8) {
                    const finalMatch = allMatches.find(match => match.bracket_type === 'final');
                    if (finalMatch) {
                        console.log(`🏆 Найден финальный матч: ID ${finalMatch.id}, раунд ${finalMatch.round}`);
                        
                        for (const semifinalMatch of semifinalMatches) {
                            const updatePromise = client.query(
                                'UPDATE matches SET next_match_id = $1 WHERE id = $2',
                                [finalMatch.id, semifinalMatch.id]
                            );
                            updatePromises.push(updatePromise);
                            
                            console.log(`🔗 Полуфинал ${semifinalMatch.id} (M${semifinalMatch.match_number}) (победитель) -> Финал ${finalMatch.id}`);
                        }
                    } else {
                        console.error(`❌ Финальный матч не найден!`);
                    }
                } else {
                    // 🔧 ИСПРАВЛЕНО: В малых турнирах также явно устанавливаем связи с финалом
                    const finalMatch = allMatches.find(match => match.bracket_type === 'final');
                    if (finalMatch) {
                        console.log(`🏆 Малый турнир: найден финальный матч ID ${finalMatch.id}, раунд ${finalMatch.round}`);
                        
                        for (const semifinalMatch of semifinalMatches) {
                            const updatePromise = client.query(
                                'UPDATE matches SET next_match_id = $1 WHERE id = $2',
                                [finalMatch.id, semifinalMatch.id]
                            );
                            updatePromises.push(updatePromise);
                            
                            console.log(`🔗 Матч ${semifinalMatch.id} (M${semifinalMatch.match_number}) (победитель) -> Финал ${finalMatch.id}`);
                        }
                    } else {
                        console.error(`❌ Финальный матч не найден в малом турнире!`);
                    }
                }
            } else {
                if (!thirdPlaceMatch) {
                    console.error(`❌ Матч за 3-е место не найден!`);
                }
                if (semifinalMatches.length !== 2) {
                    console.error(`❌ Неверное количество матчей предпоследнего раунда: ${semifinalMatches.length}, ожидалось: 2`);
                }
            }
        }
        
        // Выполняем все обновления связей
        if (updatePromises.length > 0) {
            await Promise.all(updatePromises);
            console.log(`✅ Установлено ${updatePromises.length} связей между матчами`);
        }
    }
    
    /**
     * 🔧 ИСПРАВЛЕННАЯ ФУНКЦИЯ: Связывание предварительного раунда с первым раундом (v4)
     * Новая логика: учитывает что DirectAdvancers заполняют ВСЕ позиции в первом раунде последовательно
     * @private
     */
    static async _linkPreliminaryToFirstRound_v3(client, preliminaryMatches, firstRoundMatches, participants, bracketMath, updatePromises) {
        console.log(`🎯 [linkPreliminaryToFirstRound_v4] ${preliminaryMatches.length} предварительных -> ${firstRoundMatches.length} первого раунда`);
        console.log(`📊 DirectAdvancers: ${bracketMath.directAdvancers}, Preliminary participants: ${bracketMath.preliminaryParticipants}`);
        
        // 🔧 ШАГ 1: Определяем план размещения DirectAdvancers в первом раунде (соответствует логике в _placeParticipantsInStartingMatches)
        const directAdvancers = participants.slice(0, bracketMath.directAdvancers);
        console.log(`👥 DirectAdvancers: ${directAdvancers.map(p => p.name || p.id).join(', ')}`);
        
        // 🔧 ШАГ 2: Рассчитываем размещение DirectAdvancers по новой логике
        // DirectAdvancers заполняют позиции: team1, team2, team1 следующего матча, team2 следующего матча и т.д.
        const occupancyPlan = [];
        let directAdvancerIndex = 0;
        
        for (let matchIndex = 0; matchIndex < firstRoundMatches.length; matchIndex++) {
            const match = firstRoundMatches[matchIndex];
            const plan = {
                matchId: match.id,
                matchNumber: match.match_number,
                team1_directAdvancer: null,
                team2_directAdvancer: null,
                team1_needsWinner: false,
                team2_needsWinner: false
            };
            
            // Заполняем team1_id DirectAdvancer'ом (если есть)
            if (directAdvancerIndex < directAdvancers.length) {
                plan.team1_directAdvancer = directAdvancers[directAdvancerIndex];
                directAdvancerIndex++;
            } else {
                plan.team1_needsWinner = true;
            }
            
            // Заполняем team2_id DirectAdvancer'ом (если есть)
            if (directAdvancerIndex < directAdvancers.length) {
                plan.team2_directAdvancer = directAdvancers[directAdvancerIndex];
                directAdvancerIndex++;
            } else {
                plan.team2_needsWinner = true;
            }
            
            occupancyPlan.push(plan);
            
            console.log(`🎯 Матч ${match.id} (M${match.match_number}):`);
            console.log(`   Team1: ${plan.team1_directAdvancer ? plan.team1_directAdvancer.name || plan.team1_directAdvancer.id : 'Нужен победитель предварительного'}`);
            console.log(`   Team2: ${plan.team2_directAdvancer ? plan.team2_directAdvancer.name || plan.team2_directAdvancer.id : 'Нужен победитель предварительного'}`);
        }
        
        // 🔧 ШАГ 3: Связываем предварительные матчи со свободными позициями
        let preliminaryMatchIndex = 0;
        
        for (let matchIndex = 0; matchIndex < occupancyPlan.length && preliminaryMatchIndex < preliminaryMatches.length; matchIndex++) {
            const plan = occupancyPlan[matchIndex];
            
            // Проверяем team2_id (сначала заполняем team2, потом team1 если нужно)
            if (plan.team2_needsWinner && preliminaryMatchIndex < preliminaryMatches.length) {
                const preliminaryMatch = preliminaryMatches[preliminaryMatchIndex];
                
                const updateQuery = 'UPDATE matches SET next_match_id = $1 WHERE id = $2';
                const updatePromise = client.query(updateQuery, [plan.matchId, preliminaryMatch.id]);
                updatePromises.push(updatePromise);
                
                console.log(`🎯 Предварительный матч ${preliminaryMatch.id} (M${preliminaryMatch.match_number}) -> Первый раунд матч ${plan.matchId} (M${plan.matchNumber}) [team2_id]`);
                
                preliminaryMatchIndex++;
            }
            
            // Проверяем team1_id (если все еще есть предварительные матчи)
            if (plan.team1_needsWinner && preliminaryMatchIndex < preliminaryMatches.length) {
                const preliminaryMatch = preliminaryMatches[preliminaryMatchIndex];
                
                const updateQuery = 'UPDATE matches SET next_match_id = $1 WHERE id = $2';
                const updatePromise = client.query(updateQuery, [plan.matchId, preliminaryMatch.id]);
                updatePromises.push(updatePromise);
                
                console.log(`🎯 Предварительный матч ${preliminaryMatch.id} (M${preliminaryMatch.match_number}) -> Первый раунд матч ${plan.matchId} (M${plan.matchNumber}) [team1_id]`);
                
                preliminaryMatchIndex++;
            }
        }
        
        // 🔧 ШАГ 4: Проверяем что все предварительные матчи связаны
        if (preliminaryMatchIndex !== preliminaryMatches.length) {
            console.error(`❌ ОШИБКА: Связано ${preliminaryMatchIndex} из ${preliminaryMatches.length} предварительных матчей`);
            throw new Error(`Не удалось связать все предварительные матчи: связано ${preliminaryMatchIndex} из ${preliminaryMatches.length}`);
        }
        
        console.log(`✅ Связано ${preliminaryMatches.length} предварительных матчей с первым раундом (учтены DirectAdvancers)`);
    }
    
    /**
     * 🔧 Связывание стандартных раундов
     * @private
     */
    static async _linkStandardRounds(client, currentRoundMatches, nextRoundMatches, updatePromises) {
        console.log(`🔗 [linkStandardRounds] ${currentRoundMatches.length} -> ${nextRoundMatches.length} матчей`);
        
        // 🔧 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: В финальном раунду может быть матч за 3-е место
        // Исключаем его из стандартного связывания, направляем только в финальный матч
        const validNextMatches = nextRoundMatches.filter(match => match.bracket_type !== 'placement');
        
        if (validNextMatches.length !== nextRoundMatches.length) {
            console.log(`🔧 Исключен матч за 3-е место из стандартного связывания: ${validNextMatches.length} из ${nextRoundMatches.length} матчей`);
        }
        
        // Стандартная логика: каждые 2 матча текущего раунда ведут к 1 матчу следующего раунда
        for (let i = 0; i < currentRoundMatches.length; i++) {
            const currentMatch = currentRoundMatches[i];
            const nextMatchIndex = Math.floor(i / 2);
            const nextMatch = validNextMatches[nextMatchIndex]; // Используем отфильтрованные матчи
            
            if (nextMatch) {
                const updatePromise = client.query(
                    'UPDATE matches SET next_match_id = $1 WHERE id = $2',
                    [nextMatch.id, currentMatch.id]
                );
                updatePromises.push(updatePromise);
                
                console.log(`🔗 Матч ${currentMatch.id} (R${currentMatch.round}M${currentMatch.match_number}) -> Матч ${nextMatch.id} (R${nextMatch.round}M${nextMatch.match_number}) [${nextMatch.bracket_type}]`);
            } else {
                console.warn(`⚠️ Не найден целевой матч для ${currentMatch.id} (index: ${nextMatchIndex})`);
            }
        }
    }
    
    /**
     * 🆕 ШАГ 3: Размещение участников в стартовых матчах
     * @param {Object} client - Клиент БД
     * @param {Array} allMatches - Все матчи турнира
     * @param {Array} participants - Участники турнира
     * @param {Object} bracketMath - Математические параметры
     */
    static async _placeParticipantsInStartingMatches(client, allMatches, participants, bracketMath) {
        console.log(`👥 [placeParticipantsInStartingMatches] Размещение ${participants.length} участников`);
        console.log(`📊 BracketMath: directAdvancers=${bracketMath.directAdvancers}, preliminaryParticipants=${bracketMath.preliminaryParticipants}`);
        
        // 🔧 ДОБАВЛЯЕМ ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ УЧАСТНИКОВ
        console.log(`📋 Список всех участников для размещения:`);
        participants.forEach((p, index) => {
            console.log(`   ${index + 1}. ID: ${p.id}, Name: ${p.name || p.username || 'Unknown'}`);
        });
        
        // 🔧 ИСКЛЮЧАЕМ специальные матчи из логики размещения участников
        // Финальные матчи исключаем для всех турниров, участники размещаются только в обычных матчах
        const standardMatches = allMatches.filter(match => {
            if (match.bracket_type === 'placement') return false; // Всегда исключаем матчи за 3-е место
            if (match.bracket_type === 'semifinal') return false; // Всегда исключаем настоящие полуфинальные матчи
            if (match.bracket_type === 'final') return false; // Исключаем финал для всех турниров
            return true;
        });
        
        console.log(`🔧 Исключены специальные матчи: используем ${standardMatches.length} из ${allMatches.length} матчей для размещения`);
        console.log(`🔧 Участники размещаются только в обычных матчах, специальные матчи заполняются автоматически`);
        
        const updatePromises = [];
        
        if (bracketMath.needsPreliminaryRound) {
            // 🎯 ИСПРАВЛЕННАЯ ЛОГИКА С ПРЕДВАРИТЕЛЬНЫМ РАУНДОМ
            console.log(`🎯 Турнир с предварительным раундом`);
            console.log(`📊 DirectAdvancers: ${bracketMath.directAdvancers}, Preliminary: ${bracketMath.preliminaryParticipants}`);
            
            // 1. Размещаем участников, проходящих напрямую, в первом раунде (СОГЛАСОВАННО С ЛОГИКОЙ СВЯЗЫВАНИЯ)
            const directParticipants = participants.slice(0, bracketMath.directAdvancers);
            let firstRoundMatches = standardMatches.filter(m => m.round === 1);
            
            // 🆕 ИСПРАВЛЕНИЕ: Если нет матчей первого раунда в стандартных (они могут быть финальными), включаем финальные матчи
            if (firstRoundMatches.length === 0) {
                const finalMatches = allMatches.filter(m => m.round === 1 && m.bracket_type === 'final');
                if (finalMatches.length > 0) {
                    firstRoundMatches = finalMatches;
                    console.log(`🔧 Для размещения DirectAdvancers включены финальные матчи: ${finalMatches.length} шт.`);
                }
            }
            
            console.log(`👤 DIRECT PARTICIPANTS (проходят напрямую в первый раунд):`);
            directParticipants.forEach((p, index) => {
                console.log(`   ${index + 1}. ID: ${p.id}, Name: ${p.name || p.username || 'Unknown'}`);
            });
            
            console.log(`🎯 Размещаем ${directParticipants.length} DirectAdvancers в ${firstRoundMatches.length} матчах первого раунда:`);
            
            // 🔧 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: DirectAdvancers заполняют ВСЕ позиции в первом раунде
            let directAdvancerIndex = 0;
            
            for (let i = 0; i < firstRoundMatches.length && directAdvancerIndex < directParticipants.length; i++) {
                const match = firstRoundMatches[i];
                
                console.log(`🥊 Первый раунд матч ${match.id} (M${match.match_number}) [${match.bracket_type}]:`);
                
                // Размещаем первого DirectAdvancer в team1_id
                if (directAdvancerIndex < directParticipants.length) {
                    const participant = directParticipants[directAdvancerIndex];
                    const updatePromise = client.query(
                        'UPDATE matches SET team1_id = $1 WHERE id = $2',
                        [participant.id, match.id]
                    );
                    updatePromises.push(updatePromise);
                    console.log(`   ✅ Team1: ${participant.name || participant.id} (DirectAdvancer ${directAdvancerIndex + 1})`);
                    directAdvancerIndex++;
                }
                
                // Размещаем второго DirectAdvancer в team2_id (если есть)
                if (directAdvancerIndex < directParticipants.length) {
                    const participant = directParticipants[directAdvancerIndex];
                    const updatePromise = client.query(
                        'UPDATE matches SET team2_id = $1 WHERE id = $2',
                        [participant.id, match.id]
                    );
                    updatePromises.push(updatePromise);
                    console.log(`   ✅ Team2: ${participant.name || participant.id} (DirectAdvancer ${directAdvancerIndex + 1})`);
                    directAdvancerIndex++;
                } else {
                    console.log(`   🔄 Team2: Займет победитель предварительного раунда`);
                }
            }
            
            // 2. Размещаем участников предварительного раунда
            const preliminaryParticipants = participants.slice(bracketMath.directAdvancers);
            const preliminaryMatches = standardMatches.filter(m => m.round === 0);
            
            console.log(`\n🔥 PRELIMINARY PARTICIPANTS (предварительный раунд):`);
            preliminaryParticipants.forEach((p, index) => {
                console.log(`   ${index + 1}. ID: ${p.id}, Name: ${p.name || p.username || 'Unknown'}`);
            });
            
            console.log(`\n🥊 Размещение в ${preliminaryMatches.length} матчах предварительного раунда:`);
            
            for (let i = 0; i < preliminaryMatches.length; i++) {
                const match = preliminaryMatches[i];
                const participant1 = preliminaryParticipants[i * 2];
                const participant2 = preliminaryParticipants[i * 2 + 1];
                
                console.log(`🔥 Предварительный матч ${match.id} (M${match.match_number}):`);
                
                if (participant1) {
                    const updatePromise1 = client.query(
                        'UPDATE matches SET team1_id = $1 WHERE id = $2',
                        [participant1.id, match.id]
                    );
                    updatePromises.push(updatePromise1);
                    console.log(`   👤 Team1: ${participant1.name || participant1.id} (ID: ${participant1.id})`);
                } else {
                    console.log(`   ❌ Team1: ОТСУТСТВУЕТ`);
                }
                
                if (participant2) {
                    const updatePromise2 = client.query(
                        'UPDATE matches SET team2_id = $1 WHERE id = $2',
                        [participant2.id, match.id]
                    );
                    updatePromises.push(updatePromise2);
                    console.log(`   👤 Team2: ${participant2.name || participant2.id} (ID: ${participant2.id})`);
                } else {
                    console.log(`   ❌ Team2: ОТСУТСТВУЕТ`);
                }
            }
            
        } else {
            // 🎯 СТАНДАРТНАЯ ЛОГИКА БЕЗ ПРЕДВАРИТЕЛЬНОГО РАУНДА
            console.log(`🎯 Стандартный турнир без предварительного раунда`);
            
            const firstRoundMatches = standardMatches.filter(m => m.round === 1);
            
            console.log(`📋 Размещение в ${firstRoundMatches.length} матчах первого раунда:`);
            
            for (let i = 0; i < firstRoundMatches.length; i++) {
                const match = firstRoundMatches[i];
                const participant1 = participants[i * 2];
                const participant2 = participants[i * 2 + 1];
                
                console.log(`🥊 Первый раунд матч ${match.id} (M${match.match_number}):`);
                
                if (participant1) {
                    const updatePromise1 = client.query(
                        'UPDATE matches SET team1_id = $1 WHERE id = $2',
                        [participant1.id, match.id]
                    );
                    updatePromises.push(updatePromise1);
                    console.log(`   👤 Team1: ${participant1.name || participant1.id} (ID: ${participant1.id})`);
                } else {
                    console.log(`   ❌ Team1: ОТСУТСТВУЕТ`);
                }
                
                if (participant2) {
                    const updatePromise2 = client.query(
                        'UPDATE matches SET team2_id = $1 WHERE id = $2',
                        [participant2.id, match.id]
                    );
                    updatePromises.push(updatePromise2);
                    console.log(`   👤 Team2: ${participant2.name || participant2.id} (ID: ${participant2.id})`);
                } else {
                    console.log(`   ❌ Team2: ОТСУТСТВУЕТ`);
                }
            }
        }
        
        // Выполняем все обновления размещения участников
        if (updatePromises.length > 0) {
            await Promise.all(updatePromises);
            console.log(`✅ Размещено участников в ${updatePromises.length / 2} матчах`);
        }
    }
    
    /**
     * 💾 Вставка матча в базу данных
     * @param {Object} client - Клиент БД
     * @param {Object} matchData - Данные матча
     * @returns {Object} - Созданный матч
     */
    static async _insertMatch(client, matchData) {
        const query = `
            INSERT INTO matches (
                tournament_id, round, match_number, team1_id, team2_id,
                status, bracket_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        
        const values = [
            matchData.tournament_id,
            matchData.round,
            matchData.match_number,
            matchData.team1_id,
            matchData.team2_id,
            matchData.status || 'pending',
            matchData.bracket_type || 'winner'
        ];
        
        const result = await client.query(query, values);
        return result.rows[0];
    }
    
    /**
     * 🔗 Обновление next_match_id для связи матчей
     * @param {Object} client - Клиент БД
     * @param {Array} currentRoundMatches - Матчи текущего раунда
     * @param {Array} nextRoundMatches - Матчи следующего раунда
     */
    static async _updateNextMatchIds(client, currentRoundMatches, nextRoundMatches) {
        const updatePromises = [];
        
        for (let i = 0; i < currentRoundMatches.length; i++) {
            const nextMatchIndex = Math.floor(i / 2);
            const nextMatch = nextRoundMatches[nextMatchIndex];
            
            if (nextMatch) {
                const updatePromise = client.query(
                    'UPDATE matches SET next_match_id = $1 WHERE id = $2',
                    [nextMatch.id, currentRoundMatches[i].id]
                );
                updatePromises.push(updatePromise);
            }
        }
        
        await Promise.all(updatePromises);
    }
    
    /**
     * ✅ Валидация входных данных
     * @param {number} tournamentId - ID турнира
     * @param {Array} participants - Участники
     * @param {Object} options - Опции
     */
    static _validateInput(tournamentId, participants, options) {
        if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
            throw new Error('ID турнира должен быть положительным целым числом');
        }
        
        if (!Array.isArray(participants)) {
            throw new Error('Участники должны быть переданы в виде массива');
        }
        
        if (participants.length < 2) {
            throw new Error('Недостаточно участников для создания турнирной сетки (минимум 2)');
        }
        
        if (participants.length > 1024) {
            throw new Error('Слишком много участников (максимум 1024)');
        }
        
        // Проверяем структуру участников
        participants.forEach((participant, index) => {
            if (!participant || typeof participant !== 'object') {
                throw new Error(`Участник ${index + 1} имеет неверную структуру`);
            }
            
            if (!participant.id) {
                throw new Error(`У участника ${index + 1} отсутствует ID`);
            }
        });
        
        // Валидация опций
        if (options.seedingType && !Object.values(SEEDING_TYPES).includes(options.seedingType)) {
            throw new Error(`Неверный тип распределения: ${options.seedingType}`);
        }
    }
    
    /**
     * 🔍 Валидация сгенерированной турнирной сетки
     * @param {Array} matches - Сгенерированные матчи
     * @param {Object} bracketMath - Математические параметры
     * @returns {Object} - Результат валидации
     */
    static _validateGeneratedBracket(matches, bracketMath) {
        const errors = [];
        
        try {
            // 1. Проверка общего количества матчей
            const expectedTotal = bracketMath.totalMatchesWithThirdPlace;
            if (matches.length !== expectedTotal) {
                errors.push(`Неверное общее количество матчей: ${matches.length}, ожидалось: ${expectedTotal}`);
            }
            
            // 2. Проверка количества матчей по раундам
            const matchesByRound = {};
            matches.forEach(match => {
                if (!matchesByRound[match.round]) {
                    matchesByRound[match.round] = [];
                }
                matchesByRound[match.round].push(match);
            });
            
            // 🆕 Проверяем предварительный раунд (если есть)
            if (bracketMath.needsPreliminaryRound) {
                const preliminaryMatches = matchesByRound[0]?.length || 0;
                if (preliminaryMatches !== bracketMath.preliminaryMatches) {
                    errors.push(`Предварительный раунд: неверное количество матчей ${preliminaryMatches}, ожидалось: ${bracketMath.preliminaryMatches}`);
                }
            }
            
            // Проверяем основные раунды с учетом новой математики
            const mainRounds = bracketMath.needsPreliminaryRound ? bracketMath.mainRounds : bracketMath.rounds;
            
            for (let round = 1; round <= mainRounds; round++) {
                const roundMatches = matchesByRound[round]?.filter(m => m.bracket_type !== 'placement') || [];
                const actualMatches = roundMatches.length;
                
                // Для первого раунда используем firstRoundMatches из bracketMath
                let expectedMatches;
                if (round === 1) {
                    expectedMatches = bracketMath.firstRoundMatches;
                } else {
                    // Для последующих раундов используем стандартную формулу
                    expectedMatches = Math.pow(2, mainRounds - round);
                }
                
                if (actualMatches !== expectedMatches) {
                    errors.push(`Раунд ${round}: неверное количество матчей ${actualMatches}, ожидалось: ${expectedMatches}`);
                }
            }
            
            // 3. Проверка связей между матчами
            const sourceMatchIds = new Set();
            const nextMatchIds = new Set();
            
            matches.forEach(match => {
                if (match.source_match1_id) sourceMatchIds.add(match.source_match1_id);
                if (match.source_match2_id) sourceMatchIds.add(match.source_match2_id);
                if (match.next_match_id) nextMatchIds.add(match.next_match_id);
            });
            
            // Проверяем, что все source матчи существуют
            const matchIds = new Set(matches.map(m => m.id));
            for (const sourceId of sourceMatchIds) {
                if (!matchIds.has(sourceId)) {
                    errors.push(`Ссылка на несуществующий source матч: ${sourceId}`);
                }
            }
            
            // 4. Проверка матча за 3-е место
            if (bracketMath.hasThirdPlaceMatch) {
                const thirdPlaceMatches = matches.filter(m => m.bracket_type === 'placement');
                if (thirdPlaceMatches.length !== 1) {
                    errors.push(`Неверное количество матчей за 3-е место: ${thirdPlaceMatches.length}, ожидалось: 1`);
                }
            }
            
            // 🆕 5. Проверка предварительных матчей и участников, проходящих напрямую
            if (bracketMath.needsPreliminaryRound) {
                console.log(`🔍 Валидация: турнир с предварительным раундом`);
                console.log(`🔍 Предварительных матчей: ${bracketMath.preliminaryMatches}`);
                console.log(`🔍 Участников предварительного раунда: ${bracketMath.preliminaryParticipants}`);
                console.log(`🔍 Проходят напрямую в основной раунд: ${bracketMath.directAdvancers}`);
            } else {
                console.log(`🔍 Валидация: стандартный турнир без предварительного раунда`);
            }
            
            console.log(`🔍 Валидация сетки: ${errors.length === 0 ? 'УСПЕШНО' : 'ОШИБКИ'}`);
            
            return {
                isValid: errors.length === 0,
                errors,
                matchCount: matches.length,
                expectedMatchCount: expectedTotal,
                roundsValidated: Object.keys(matchesByRound).length
            };
            
        } catch (error) {
            console.error(`❌ Ошибка валидации:`, error);
            errors.push(`Ошибка валидации: ${error.message}`);
            
            return {
                isValid: false,
                errors,
                validationError: error.message
            };
        }
    }
}

module.exports = {
    SingleEliminationEngine
}; 