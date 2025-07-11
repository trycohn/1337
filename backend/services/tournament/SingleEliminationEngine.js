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
        
        try {
            // 1. Валидация входных данных
            this._validateInput(tournamentId, participants, options);
            
            // 2. Расчет математических параметров с поддержкой bye-проходов
            const bracketMath = BracketMath.calculateSingleEliminationParams(
                participants.length, 
                { thirdPlaceMatch: options.thirdPlaceMatch || false }
            );
            
            console.log(`📊 Математические параметры:`, {
                originalParticipants: bracketMath.originalParticipantCount,
                actualParticipants: bracketMath.actualParticipants,
                excludedParticipants: bracketMath.excludedParticipants, // Теперь всегда 0
                needsPreliminaryRound: bracketMath.needsPreliminaryRound,
                preliminaryMatches: bracketMath.preliminaryMatches,
                firstRoundByes: bracketMath.firstRoundByes,
                totalMatches: bracketMath.totalMatches,
                rounds: bracketMath.rounds
            });
            
            // 3. Применение алгоритма распределения - используем ВСЕХ участников
            const seedingType = options.seedingType || SEEDING_TYPES.RANDOM;
            const seededParticipants = SeedingFactory.createSeeding(
                seedingType,
                participants, // 🔧 ИСПРАВЛЕНО: передаем всех участников
                participants.length, // 🔧 ИСПРАВЛЕНО: количество = всем участникам
                options.seedingOptions || {}
            );
            
            console.log(`🎲 Распределение участников: тип ${seedingType}, количество ${seededParticipants.length}`);
            
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
            
            return {
                success: true,
                matches,
                excludedParticipants: [], // 🔧 ИСПРАВЛЕНО: больше не исключаем участников
                bracketMath,
                seedingInfo: {
                    type: seedingType,
                    participantsUsed: seededParticipants.length,
                    participantsExcluded: 0 // 🔧 ИСПРАВЛЕНО: никого не исключаем
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
            
            // 🆕 ШАГ 1: Создаем ВСЕ матчи турнира (пустые, без участников)
            const allMatches = await this._createAllTournamentMatches(client, tournamentId, bracketMath);
            console.log(`✅ Создано ${allMatches.length} матчей для всего турнира`);
            
            // 🆕 ШАГ 2: Устанавливаем ВСЕ связи next_match_id между матчами
            await this._establishAllConnections(client, allMatches, participants, bracketMath);
            console.log(`🔗 Установлены все связи между матчами`);
            
            // 🆕 ШАГ 3: Размещаем участников ТОЛЬКО в стартовых матчах
            await this._placeParticipantsInStartingMatches(client, allMatches, participants, bracketMath);
            console.log(`👥 Участники размещены в стартовых матчах`);
            
            // 🆕 ШАГ 4: Генерируем матч за 3-е место (если нужен)
            if (bracketMath.hasThirdPlaceMatch) {
                const thirdPlaceMatch = await this._generateThirdPlaceMatch(client, tournamentId, allMatches, bracketMath);
                allMatches.push(thirdPlaceMatch);
            }
            
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
                const matchData = {
                    tournament_id: tournamentId,
                    round: round,
                    match_number: matchNumber,
                    team1_id: null, // Будет заполнено позже для стартовых матчей
                    team2_id: null, // Будет заполнено позже для стартовых матчей
                    status: 'pending',
                    bracket_type: 'winner'
                };
                
                const matchPromise = this._insertMatch(client, matchData);
                matchPromises.push(matchPromise);
            }
        }
        
        // Выполняем все вставки параллельно
        const insertedMatches = await Promise.all(matchPromises);
        allMatches.push(...insertedMatches);
        
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
        
        // Группируем матчи по раундам для удобства
        const matchesByRound = {};
        allMatches.forEach(match => {
            if (!matchesByRound[match.round]) {
                matchesByRound[match.round] = [];
            }
            matchesByRound[match.round].push(match);
        });
        
        // Определяем диапазон раундов
        const startRound = bracketMath.needsPreliminaryRound ? 0 : 1;
        const totalRounds = bracketMath.needsPreliminaryRound ? bracketMath.mainRounds : bracketMath.rounds;
        
        console.log(`🔗 Связываем раунды ${startRound} - ${totalRounds - 1} с их следующими раундами`);
        
        // Связываем каждый раунд со следующим
        for (let round = startRound; round < totalRounds; round++) {
            const currentRoundMatches = matchesByRound[round] || [];
            const nextRoundMatches = matchesByRound[round + 1] || [];
            
            console.log(`🔗 Раунд ${round} -> Раунд ${round + 1}: ${currentRoundMatches.length} -> ${nextRoundMatches.length} матчей`);
            
            if (round === 0 && bracketMath.needsPreliminaryRound) {
                // 🔧 ИСПРАВЛЕННАЯ ЛОГИКА для предварительного раунда
                await this._linkPreliminaryToFirstRound_v3(client, currentRoundMatches, nextRoundMatches, participants, bracketMath, updatePromises);
            } else {
                // 🔧 СТАНДАРТНАЯ ЛОГИКА для основных раундов
                await this._linkStandardRounds(client, currentRoundMatches, nextRoundMatches, updatePromises);
            }
        }
        
        // Выполняем все обновления связей
        if (updatePromises.length > 0) {
            await Promise.all(updatePromises);
            console.log(`✅ Установлено ${updatePromises.length} связей между матчами`);
        }
    }
    
    /**
     * 🔧 ИСПРАВЛЕННАЯ ФУНКЦИЯ: Связывание предварительного раунда с первым раундом (v3)
     * Учитывает размещение DirectAdvancers и связывает предварительные матчи только со свободными позициями
     * @private
     */
    static async _linkPreliminaryToFirstRound_v3(client, preliminaryMatches, firstRoundMatches, participants, bracketMath, updatePromises) {
        console.log(`🎯 [linkPreliminaryToFirstRound_v3] ${preliminaryMatches.length} предварительных -> ${firstRoundMatches.length} первого раунда`);
        console.log(`📊 DirectAdvancers: ${bracketMath.directAdvancers}, Preliminary participants: ${bracketMath.preliminaryParticipants}`);
        
        // 🔧 ШАГ 1: Определяем план размещения DirectAdvancers в первом раунде
        const directAdvancers = participants.slice(0, bracketMath.directAdvancers);
        console.log(`👥 DirectAdvancers: ${directAdvancers.map(p => p.name || p.id).join(', ')}`);
        
        // 🔧 ШАГ 2: Создаем карту занятости позиций в первом раунде
        // Логика: DirectAdvancers заполняют позиции team1_id в матчах первого раунда по порядку
        const occupancyMap = [];
        
        for (let i = 0; i < firstRoundMatches.length; i++) {
            const match = firstRoundMatches[i];
            
            if (i < bracketMath.directAdvancers) {
                // DirectAdvancer займет team1_id в этом матче
                occupancyMap.push({
                    matchId: match.id,
                    matchNumber: match.match_number,
                    team1_occupied: true,  // DirectAdvancer
                    team2_occupied: false, // Свободно для победителя предварительного
                    availablePosition: 'team2_id'
                });
                console.log(`🎯 Матч ${match.id} (M${match.match_number}): team1_id = DirectAdvancer, team2_id = свободно`);
            } else {
                // В этом матче обе позиции свободны для победителей предварительных
                occupancyMap.push({
                    matchId: match.id,
                    matchNumber: match.match_number,
                    team1_occupied: false, // Свободно для победителя предварительного
                    team2_occupied: false, // Свободно для победителя предварительного
                    availablePosition: 'both'
                });
                console.log(`🎯 Матч ${match.id} (M${match.match_number}): обе позиции свободны`);
            }
        }
        
        // 🔧 ШАГ 3: Создаем план связывания предварительных матчей
        let currentFirstRoundMatchIndex = 0;
        let positionInMatch = 'team2_id'; // Начинаем с team2_id в первом матче (где team1_id занят DirectAdvancer)
        
        for (let i = 0; i < preliminaryMatches.length; i++) {
            const preliminaryMatch = preliminaryMatches[i];
            const occupancy = occupancyMap[currentFirstRoundMatchIndex];
            
            if (!occupancy) {
                console.error(`❌ Не найдена информация о занятости для матча ${currentFirstRoundMatchIndex}`);
                continue;
            }
            
            // Связываем предварительный матч с целевым матчем первого раунда
            const updatePromise = client.query(
                'UPDATE matches SET next_match_id = $1 WHERE id = $2',
                [occupancy.matchId, preliminaryMatch.id]
            );
            updatePromises.push(updatePromise);
            
            console.log(`🎯 Предварительный матч ${preliminaryMatch.id} (M${preliminaryMatch.match_number}) -> Первый раунд матч ${occupancy.matchId} (M${occupancy.matchNumber}) [${positionInMatch}]`);
            
            // 🔧 ШАГ 4: Переходим к следующей позиции
            if (occupancy.team1_occupied && !occupancy.team2_occupied) {
                // В этом матче team1_id занят DirectAdvancer, team2_id мы только что заняли
                // Переходим к следующему матчу
                currentFirstRoundMatchIndex++;
                positionInMatch = 'team1_id'; // В следующем матче начинаем с team1_id
            } else if (positionInMatch === 'team1_id') {
                // Мы заняли team1_id, теперь занимаем team2_id в том же матче
                positionInMatch = 'team2_id';
            } else {
                // Мы заняли team2_id, переходим к следующему матчу
                currentFirstRoundMatchIndex++;
                positionInMatch = 'team1_id';
            }
        }
        
        console.log(`✅ Связано ${preliminaryMatches.length} предварительных матчей с первым раундом (учтены DirectAdvancers)`);
    }
    
    /**
     * 🔧 Связывание стандартных раундов
     * @private
     */
    static async _linkStandardRounds(client, currentRoundMatches, nextRoundMatches, updatePromises) {
        console.log(`🔗 [linkStandardRounds] ${currentRoundMatches.length} -> ${nextRoundMatches.length} матчей`);
        
        // Стандартная логика: каждые 2 матча текущего раунда ведут к 1 матчу следующего раунда
        for (let i = 0; i < currentRoundMatches.length; i++) {
            const currentMatch = currentRoundMatches[i];
            const nextMatchIndex = Math.floor(i / 2);
            const nextMatch = nextRoundMatches[nextMatchIndex];
            
            if (nextMatch) {
                const updatePromise = client.query(
                    'UPDATE matches SET next_match_id = $1 WHERE id = $2',
                    [nextMatch.id, currentMatch.id]
                );
                updatePromises.push(updatePromise);
                
                console.log(`🔗 Матч ${currentMatch.id} (R${currentMatch.round}M${currentMatch.match_number}) -> Матч ${nextMatch.id} (R${nextMatch.round}M${nextMatch.match_number})`);
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
        
        const updatePromises = [];
        
        if (bracketMath.needsPreliminaryRound) {
            // 🎯 ИСПРАВЛЕННАЯ ЛОГИКА С ПРЕДВАРИТЕЛЬНЫМ РАУНДОМ
            console.log(`🎯 Турнир с предварительным раундом`);
            console.log(`📊 DirectAdvancers: ${bracketMath.directAdvancers}, Preliminary: ${bracketMath.preliminaryParticipants}`);
            
            // 1. Размещаем участников, проходящих напрямую, в первом раунде (СОГЛАСОВАННО С ЛОГИКОЙ СВЯЗЫВАНИЯ)
            const directParticipants = participants.slice(0, bracketMath.directAdvancers);
            const firstRoundMatches = allMatches.filter(m => m.round === 1);
            
            // 🔧 ВАЖНО: DirectAdvancers размещаются в team1_id матчей первого раунда ПО ПОРЯДКУ
            for (let i = 0; i < directParticipants.length && i < firstRoundMatches.length; i++) {
                const participant = directParticipants[i];
                const match = firstRoundMatches[i];
                
                const updatePromise = client.query(
                    'UPDATE matches SET team1_id = $1 WHERE id = $2',
                    [participant.id, match.id]
                );
                updatePromises.push(updatePromise);
                
                console.log(`👤 DirectAdvancer: ${participant.name || participant.id} -> Первый раунд матч ${match.id} (team1_id) [согласованно с логикой связывания]`);
            }
            
            // 2. Размещаем остальных участников в предварительном раунде
            const preliminaryParticipants = participants.slice(bracketMath.directAdvancers);
            const preliminaryMatches = allMatches.filter(m => m.round === 0);
            
            for (let i = 0; i < preliminaryMatches.length; i++) {
                const match = preliminaryMatches[i];
                const participant1 = preliminaryParticipants[i * 2];
                const participant2 = preliminaryParticipants[i * 2 + 1];
                
                if (participant1) {
                    const updatePromise1 = client.query(
                        'UPDATE matches SET team1_id = $1 WHERE id = $2',
                        [participant1.id, match.id]
                    );
                    updatePromises.push(updatePromise1);
                    console.log(`👤 Preliminary: ${participant1.name || participant1.id} -> Предварительный матч ${match.id} (team1)`);
                }
                
                if (participant2) {
                    const updatePromise2 = client.query(
                        'UPDATE matches SET team2_id = $1 WHERE id = $2',
                        [participant2.id, match.id]
                    );
                    updatePromises.push(updatePromise2);
                    console.log(`👤 Preliminary: ${participant2.name || participant2.id} -> Предварительный матч ${match.id} (team2)`);
                }
            }
            
        } else {
            // 🎯 СТАНДАРТНАЯ ЛОГИКА БЕЗ ПРЕДВАРИТЕЛЬНОГО РАУНДА
            console.log(`🎯 Стандартный турнир без предварительного раунда`);
            
            const firstRoundMatches = allMatches.filter(m => m.round === 1);
            
            for (let i = 0; i < firstRoundMatches.length; i++) {
                const match = firstRoundMatches[i];
                const participant1 = participants[i * 2];
                const participant2 = participants[i * 2 + 1];
                
                if (participant1) {
                    const updatePromise1 = client.query(
                        'UPDATE matches SET team1_id = $1 WHERE id = $2',
                        [participant1.id, match.id]
                    );
                    updatePromises.push(updatePromise1);
                    console.log(`👤 ${participant1.name || participant1.id} -> Первый раунд матч ${match.id} (team1)`);
                }
                
                if (participant2) {
                    const updatePromise2 = client.query(
                        'UPDATE matches SET team2_id = $1 WHERE id = $2',
                        [participant2.id, match.id]
                    );
                    updatePromises.push(updatePromise2);
                    console.log(`👤 ${participant2.name || participant2.id} -> Первый раунд матч ${match.id} (team2)`);
                }
            }
        }
        
        // Выполняем все обновления размещения участников
        if (updatePromises.length > 0) {
            await Promise.all(updatePromises);
            console.log(`✅ Размещено участников: ${updatePromises.length} обновлений (согласованно с логикой связывания)`);
        }
    }
    
    /**
     * 🥉 Генерация матча за 3-е место
     * @param {Object} client - Клиент БД
     * @param {number} tournamentId - ID турнира
     * @param {Array} allMatches - Все матчи
     * @param {Object} bracketMath - Математические параметры
     * @returns {Object} - Матч за 3-е место
     */
    static async _generateThirdPlaceMatch(client, tournamentId, allMatches, bracketMath) {
        console.log(`🥉 Генерация матча за 3-е место`);
        
        // Находим полуфинальные матчи (матчи раунда rounds-1)
        const semifinalMatches = allMatches.filter(match => 
            match.round === bracketMath.rounds - 1 && 
            match.bracket_type === 'winner'
        );
        
        if (semifinalMatches.length !== 2) {
            throw new Error(`Не найдены полуфинальные матчи для матча за 3-е место`);
        }
        
        const thirdPlaceMatchData = {
            tournament_id: tournamentId,
            round: bracketMath.rounds,
            match_number: 1,
            team1_id: null, // Будет заполнено после полуфиналов
            team2_id: null,
            status: 'pending',
            bracket_type: 'placement',
            is_third_place_match: true,
            source_match1_id: semifinalMatches[0].id,
            source_match2_id: semifinalMatches[1].id
        };
        
        const thirdPlaceMatch = await this._insertMatch(client, thirdPlaceMatchData);
        
        console.log(`✅ Матч за 3-е место создан: ID ${thirdPlaceMatch.id}`);
        return thirdPlaceMatch;
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
                status, bracket_type, is_third_place_match, 
                source_match1_id, source_match2_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `;
        
        const values = [
            matchData.tournament_id,
            matchData.round,
            matchData.match_number,
            matchData.team1_id,
            matchData.team2_id,
            matchData.status || 'pending',
            matchData.bracket_type || 'winner',
            matchData.is_third_place_match || false,
            matchData.source_match1_id,
            matchData.source_match2_id
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
                const roundMatches = matchesByRound[round]?.filter(m => !m.is_third_place_match) || [];
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
                const thirdPlaceMatches = matches.filter(m => m.is_third_place_match);
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