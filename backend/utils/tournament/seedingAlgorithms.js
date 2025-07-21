/**
 * 🎲 АЛГОРИТМЫ РАСПРЕДЕЛЕНИЯ УЧАСТНИКОВ
 * 
 * Модуль содержит различные алгоритмы для распределения участников
 * по турнирной сетке с учетом рейтингов, случайности и баланса
 */

/**
 * 🏆 Типы распределения участников
 */
const SEEDING_TYPES = {
    RANDOM: 'random',           // Случайное распределение
    RANKING: 'ranking',         // По рейтингу (FACEIT/CS2 Premier)
    MANUAL: 'manual',           // Ручное распределение админом
    BALANCED: 'balanced',       // Сбалансированное по силе
    SNAKE_DRAFT: 'snake_draft'  // Змейка (для команд)
};

/**
 * 🎯 Основной класс для работы с распределением участников
 */
class SeedingAlgorithms {
    
    /**
     * 🎲 Случайное распределение участников (по умолчанию)
     * @param {Array} participants - Массив участников
     * @param {number} maxParticipants - Максимальное количество (должно равняться participants.length)
     * @returns {Array} - Перемешанный массив участников
     */
    static randomSeeding(participants, maxParticipants) {
        this._validateParticipants(participants);
        
        console.log(`🎲 [randomSeeding] Получено: ${participants.length} участников, максимум: ${maxParticipants}`);
        
        // 🔧 КРИТИЧЕСКИ ВАЖНО: для Single Elimination используем ВСЕ участники
        // maxParticipants должен равняться participants.length для Single Elimination
        if (maxParticipants > participants.length) {
            console.warn(`⚠️ [randomSeeding] maxParticipants (${maxParticipants}) больше чем доступно участников (${participants.length})`);
            maxParticipants = participants.length;
        }
        
        // 🆕 ДЛЯ SINGLE ELIMINATION: всегда используем ВСЕХ участников
        const selectedParticipants = participants.slice(0, maxParticipants);
        
        // Применяем алгоритм Fisher-Yates для случайного перемешивания
        const shuffled = [...selectedParticipants];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        console.log(`✅ [randomSeeding] Случайное распределение: ${shuffled.length} участников (потерь: ${participants.length - shuffled.length})`);
        
        // 🔧 ДОБАВЛЯЕМ ПРОВЕРКУ: убеждаемся что не потеряли участников
        if (shuffled.length !== participants.length) {
            console.error(`❌ КРИТИЧЕСКАЯ ОШИБКА в randomSeeding: Потеряли участников!`);
            console.error(`   Было: ${participants.length}, стало: ${shuffled.length}`);
            console.error(`   maxParticipants был: ${maxParticipants}`);
            throw new Error(`randomSeeding потерял ${participants.length - shuffled.length} участник(ов)`);
        }
        
        return this._addSeedingInfo(shuffled, 'random');
    }
    
    /**
     * 🏆 Распределение по рейтингу
     * @param {Array} participants - Массив участников
     * @param {number} maxParticipants - Максимальное количество
     * @param {Object} options - Опции сортировки
     * @returns {Array} - Отсортированный массив участников
     */
    static rankingSeeding(participants, maxParticipants, options = {}) {
        this._validateParticipants(participants);
        
        const { ratingType = 'faceit_elo', direction = 'desc' } = options;
        
        console.log(`🏆 [rankingSeeding] Получено: ${participants.length} участников, максимум: ${maxParticipants}, рейтинг: ${ratingType}`);
        
        // 🔧 КРИТИЧЕСКИ ВАЖНО: для Single Elimination используем ВСЕ участники
        if (maxParticipants > participants.length) {
            console.warn(`⚠️ [rankingSeeding] maxParticipants (${maxParticipants}) больше чем доступно участников (${participants.length})`);
            maxParticipants = participants.length;
        }
        
        // Сортируем участников по рейтингу
        const sorted = [...participants].sort((a, b) => {
            const ratingA = this._getRating(a, ratingType);
            const ratingB = this._getRating(b, ratingType);
            
            if (direction === 'desc') {
                return ratingB - ratingA; // От высшего к низшему
            } else {
                return ratingA - ratingB; // От низшего к высшему
            }
        });
        
        // 🆕 ДЛЯ SINGLE ELIMINATION: всегда используем ВСЕХ участников
        const selectedParticipants = sorted.slice(0, maxParticipants);
        
        console.log(`✅ [rankingSeeding] Распределение по рейтингу (${ratingType}): ${selectedParticipants.length} участников (потерь: ${participants.length - selectedParticipants.length})`);
        
        // 🔧 ДОБАВЛЯЕМ ПРОВЕРКУ: убеждаемся что не потеряли участников
        if (selectedParticipants.length !== participants.length) {
            console.error(`❌ КРИТИЧЕСКАЯ ОШИБКА в rankingSeeding: Потеряли участников!`);
            console.error(`   Было: ${participants.length}, стало: ${selectedParticipants.length}`);
            console.error(`   maxParticipants был: ${maxParticipants}`);
            throw new Error(`rankingSeeding потерял ${participants.length - selectedParticipants.length} участник(ов)`);
        }
        
        return this._addSeedingInfo(selectedParticipants, 'ranking', { ratingType, direction });
    }
    
    /**
     * ⚖️ Сбалансированное распределение участников
     * @param {Array} participants - Массив участников
     * @param {number} maxParticipants - Максимальное количество
     * @param {Object} options - Опции балансировки
     * @returns {Array} - Сбалансированный массив участников
     */
    static balancedSeeding(participants, maxParticipants, options = {}) {
        this._validateParticipants(participants);
        
        const { ratingType = 'faceit_elo' } = options;
        
        console.log(`⚖️ [balancedSeeding] Получено: ${participants.length} участников, максимум: ${maxParticipants}, рейтинг: ${ratingType}`);
        
        // 🔧 КРИТИЧЕСКИ ВАЖНО: для Single Elimination используем ВСЕ участники
        if (maxParticipants > participants.length) {
            console.warn(`⚠️ [balancedSeeding] maxParticipants (${maxParticipants}) больше чем доступно участников (${participants.length})`);
            maxParticipants = participants.length;
        }
        
        // Сначала сортируем по рейтингу - используем исправленный rankingSeeding
        const sorted = this.rankingSeeding(participants, maxParticipants, { 
            ratingType, 
            direction: 'desc' 
        });
        
        // Применяем алгоритм змейки для балансировки
        const balanced = this._applySnakeDraft(sorted);
        
        console.log(`✅ [balancedSeeding] Сбалансированное распределение: ${balanced.length} участников (потерь: ${participants.length - balanced.length})`);
        
        // 🔧 ДОБАВЛЯЕМ ПРОВЕРКУ: убеждаемся что не потеряли участников
        if (balanced.length !== participants.length) {
            console.error(`❌ КРИТИЧЕСКАЯ ОШИБКА в balancedSeeding: Потеряли участников!`);
            console.error(`   Было: ${participants.length}, стало: ${balanced.length}`);
            console.error(`   maxParticipants был: ${maxParticipants}`);
            throw new Error(`balancedSeeding потерял ${participants.length - balanced.length} участник(ов)`);
        }
        
        return this._addSeedingInfo(balanced, 'balanced', { ratingType });
    }
    
    /**
     * 🐍 Алгоритм змейки для распределения
     * @param {Array} participants - Отсортированные участники
     * @returns {Array} - Перераспределенные участники
     */
    static _applySnakeDraft(participants) {
        const n = participants.length;
        const groups = Math.ceil(Math.log2(n)); // Количество групп
        const groupSize = Math.ceil(n / groups);
        
        const result = [];
        const groups_array = [];
        
        // Разбиваем на группы
        for (let i = 0; i < groups; i++) {
            groups_array.push([]);
        }
        
        // Распределяем змейкой
        let currentGroup = 0;
        let direction = 1; // 1 = вперед, -1 = назад
        
        for (let i = 0; i < participants.length; i++) {
            groups_array[currentGroup].push(participants[i]);
            
            currentGroup += direction;
            
            // Меняем направление при достижении края
            if (currentGroup >= groups || currentGroup < 0) {
                direction *= -1;
                currentGroup += direction;
            }
        }
        
        // Собираем результат
        for (let group of groups_array) {
            result.push(...group);
        }
        
        return result;
    }
    
    /**
     * 🎯 Распределение для микс турниров
     * @param {Array} soloParticipants - Одиночные участники
     * @param {number} teamSize - Размер команды
     * @param {number} maxTeams - Максимальное количество команд
     * @param {Object} options - Опции распределения
     * @returns {Object} - Объект с командами и исключенными участниками
     */
    static mixTournamentSeeding(soloParticipants, teamSize = 5, maxTeams, options = {}) {
        this._validateParticipants(soloParticipants);
        
        const { 
            ratingType = 'faceit_elo',
            balanceTeams = true,
            seedingType = 'balanced'
        } = options;
        
        const totalPlayersNeeded = maxTeams * teamSize;
        
        let selectedParticipants;
        
        // Выбираем участников в зависимости от типа распределения
        switch (seedingType) {
            case 'random':
                selectedParticipants = this.randomSeeding(soloParticipants, totalPlayersNeeded);
                break;
            case 'ranking':
                selectedParticipants = this.rankingSeeding(soloParticipants, totalPlayersNeeded, { ratingType });
                break;
            case 'balanced':
            default:
                selectedParticipants = this.balancedSeeding(soloParticipants, totalPlayersNeeded, { ratingType });
                break;
        }
        
        // Формируем команды
        const teams = this._formTeams(selectedParticipants, teamSize, maxTeams, balanceTeams);
        const excludedParticipants = soloParticipants.slice(totalPlayersNeeded);
        
        console.log(`🎯 Микс турнир: сформировано ${teams.length} команд из ${selectedParticipants.length} участников`);
        console.log(`❌ Исключено участников: ${excludedParticipants.length}`);
        
        return {
            teams,
            excludedParticipants,
            seedingInfo: {
                type: 'mix',
                teamSize,
                maxTeams,
                balanceTeams,
                ratingType,
                generatedAt: new Date().toISOString()
            }
        };
    }
    
    /**
     * 👥 Формирование команд из участников
     * @param {Array} participants - Участники
     * @param {number} teamSize - Размер команды
     * @param {number} maxTeams - Максимальное количество команд
     * @param {boolean} balance - Балансировать ли команды
     * @returns {Array} - Массив команд
     */
    static _formTeams(participants, teamSize, maxTeams, balance = true) {
        const teams = [];
        
        if (balance) {
            // Сбалансированное формирование команд
            const playersPerTeam = Array.from({ length: maxTeams }, () => []);
            
            // Распределяем игроков змейкой по командам
            for (let i = 0; i < participants.length; i++) {
                const teamIndex = i % maxTeams;
                const player = participants[i];
                
                // Добавляем дополнительную информацию о роли в команде
                player.teamRole = playersPerTeam[teamIndex].length === 0 ? 'captain' : 'member';
                
                playersPerTeam[teamIndex].push(player);
            }
            
            // Формируем команды
            for (let i = 0; i < maxTeams; i++) {
                if (playersPerTeam[i].length === teamSize) {
                    teams.push({
                        id: i + 1,
                        name: `Команда ${i + 1}`,
                        players: playersPerTeam[i],
                        captain: playersPerTeam[i].find(p => p.teamRole === 'captain'),
                        averageRating: this._calculateTeamAverageRating(playersPerTeam[i])
                    });
                }
            }
        } else {
            // Простое последовательное формирование команд
            for (let i = 0; i < maxTeams; i++) {
                const startIndex = i * teamSize;
                const teamPlayers = participants.slice(startIndex, startIndex + teamSize);
                
                if (teamPlayers.length === teamSize) {
                    teams.push({
                        id: i + 1,
                        name: `Команда ${i + 1}`,
                        players: teamPlayers,
                        captain: teamPlayers[0],
                        averageRating: this._calculateTeamAverageRating(teamPlayers)
                    });
                }
            }
        }
        
        return teams;
    }
    
    /**
     * 📊 Расчет среднего рейтинга команды
     * @param {Array} players - Игроки команды
     * @param {string} ratingType - Тип рейтинга
     * @returns {number} - Средний рейтинг
     */
    static _calculateTeamAverageRating(players, ratingType = 'faceit_elo') {
        if (!players || players.length === 0) return 0;
        
        const ratings = players.map(player => this._getRating(player, ratingType));
        const validRatings = ratings.filter(rating => rating > 0);
        
        if (validRatings.length === 0) return 0;
        
        return Math.round(validRatings.reduce((sum, rating) => sum + rating, 0) / validRatings.length);
    }
    
    /**
     * 🔢 Получение рейтинга участника
     * @param {Object} participant - Участник
     * @param {string} ratingType - Тип рейтинга
     * @returns {number} - Рейтинг участника
     */
    static _getRating(participant, ratingType) {
        switch (ratingType) {
            case 'faceit_elo':
                return participant.faceit_elo || 0;
            case 'cs2_premier_rank':
                return participant.cs2_premier_rank || 0;
            default:
                return participant.faceit_elo || participant.cs2_premier_rank || 0;
        }
    }
    
    /**
     * ✅ Валидация массива участников
     * @param {Array} participants - Массив участников
     */
    static _validateParticipants(participants) {
        if (!Array.isArray(participants)) {
            throw new Error('Участники должны быть переданы в виде массива');
        }
        
        if (participants.length < 2) {
            throw new Error('Недостаточно участников для формирования сетки (минимум 2)');
        }
        
        // Проверяем, что каждый участник имеет необходимые поля
        participants.forEach((participant, index) => {
            if (!participant.id) {
                throw new Error(`У участника ${index + 1} отсутствует ID`);
            }
            if (!participant.name && !participant.username) {
                throw new Error(`У участника ${index + 1} отсутствует имя`);
            }
        });
    }
    
    /**
     * 📝 Добавление информации о распределении
     * @param {Array} participants - Участники
     * @param {string} seedingType - Тип распределения
     * @param {Object} metadata - Дополнительная информация
     * @returns {Array} - Участники с информацией о распределении
     */
    static _addSeedingInfo(participants, seedingType, metadata = {}) {
        return participants.map((participant, index) => ({
            ...participant,
            seedNumber: index + 1,
            seedingType,
            seedingMetadata: {
                ...metadata,
                position: index + 1,
                total: participants.length,
                generatedAt: new Date().toISOString()
            }
        }));
    }
    
    /**
     * 🔄 Применение пользовательского распределения
     * @param {Array} participants - Участники
     * @param {Array} customOrder - Пользовательский порядок (массив ID)
     * @param {number} maxParticipants - Максимальное количество
     * @returns {Array} - Участники в пользовательском порядке
     */
    static manualSeeding(participants, customOrder, maxParticipants) {
        this._validateParticipants(participants);
        
        if (!Array.isArray(customOrder)) {
            throw new Error('Пользовательский порядок должен быть массивом ID участников');
        }
        
        const participantMap = new Map(participants.map(p => [p.id, p]));
        const orderedParticipants = [];
        
        // Сначала добавляем участников в пользовательском порядке
        for (const participantId of customOrder) {
            if (participantMap.has(participantId)) {
                orderedParticipants.push(participantMap.get(participantId));
                participantMap.delete(participantId);
            }
        }
        
        // Затем добавляем оставшихся участников
        orderedParticipants.push(...Array.from(participantMap.values()));
        
        // Берем только нужное количество
        const finalParticipants = orderedParticipants.slice(0, maxParticipants);
        
        console.log(`✏️ Ручное распределение: ${finalParticipants.length} участников`);
        return this._addSeedingInfo(finalParticipants, 'manual');
    }
}

/**
 * 🎯 Фабрика для создания распределений
 */
class SeedingFactory {
    
    /**
     * 🏭 Создание распределения на основе типа
     * @param {string} seedingType - Тип распределения
     * @param {Array} participants - Участники
     * @param {number} maxParticipants - Максимальное количество
     * @param {Object} options - Опции
     * @returns {Array|Object} - Результат распределения
     */
    static createSeeding(seedingType, participants, maxParticipants, options = {}) {
        switch (seedingType) {
            case SEEDING_TYPES.RANDOM:
                return SeedingAlgorithms.randomSeeding(participants, maxParticipants);
                
            case SEEDING_TYPES.RANKING:
                return SeedingAlgorithms.rankingSeeding(participants, maxParticipants, options);
                
            case SEEDING_TYPES.BALANCED:
                return SeedingAlgorithms.balancedSeeding(participants, maxParticipants, options);
                
            case SEEDING_TYPES.MANUAL:
                return SeedingAlgorithms.manualSeeding(participants, options.customOrder, maxParticipants);
                
            default:
                console.warn(`Неизвестный тип распределения: ${seedingType}, используем случайное`);
                return SeedingAlgorithms.randomSeeding(participants, maxParticipants);
        }
    }
    
    /**
     * 🎮 Создание распределения для микс турнира
     * @param {Array} soloParticipants - Одиночные участники
     * @param {number} teamSize - Размер команды
     * @param {number} maxTeams - Максимальное количество команд
     * @param {Object} options - Опции
     * @returns {Object} - Результат распределения с командами
     */
    static createMixSeeding(soloParticipants, teamSize, maxTeams, options = {}) {
        return SeedingAlgorithms.mixTournamentSeeding(soloParticipants, teamSize, maxTeams, options);
    }
}

module.exports = {
    SeedingAlgorithms,
    SeedingFactory,
    SEEDING_TYPES,
    
    // Экспорт для удобства
    randomSeeding: SeedingAlgorithms.randomSeeding.bind(SeedingAlgorithms),
    rankingSeeding: SeedingAlgorithms.rankingSeeding.bind(SeedingAlgorithms),
    balancedSeeding: SeedingAlgorithms.balancedSeeding.bind(SeedingAlgorithms),
    mixTournamentSeeding: SeedingAlgorithms.mixTournamentSeeding.bind(SeedingAlgorithms)
}; 