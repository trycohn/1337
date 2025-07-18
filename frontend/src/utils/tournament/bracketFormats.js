/**
 * 🏗️ СИСТЕМА ПЛАГИНОВ ДЛЯ ФОРМАТОВ ТУРНИРОВ
 * 
 * Масштабируемая архитектура для поддержки различных форматов:
 * - Single Elimination
 * - Double Elimination  
 * - Swiss (будущее)
 * - Round Robin (будущее)
 */

// Базовый интерфейс для форматов турниров
export class TournamentFormat {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
  }

  /**
   * Группировка матчей по раундам и типам
   * @param {Array} matches - Массив матчей
   * @returns {Object} Сгруппированные матчи
   */
  groupMatches(matches) {
    throw new Error('groupMatches must be implemented');
  }

  /**
   * Получение названия раунда
   * @param {number} round - Номер раунда
   * @param {Object} context - Контекст (totalRounds, hasSpecialMatches и т.д.)
   * @returns {string} Название раунда
   */
  getRoundName(round, context) {
    throw new Error('getRoundName must be implemented');
  }

  /**
   * Расчет позиций матчей для визуализации
   * @param {Object} groupedMatches - Сгруппированные матчи
   * @returns {Map} Карта позиций {matchId => {x, y, type}}
   */
  calculatePositions(groupedMatches) {
    throw new Error('calculatePositions must be implemented');
  }

  /**
   * Расчет соединений между матчами
   * @param {Array} matches - Массив матчей
   * @param {Map} positions - Позиции матчей
   * @returns {Array} Массив соединений
   */
  calculateConnections(matches, positions) {
    const connections = [];
    
    matches.forEach(match => {
      if (match.next_match_id && positions.has(match.id) && positions.has(match.next_match_id)) {
        const from = positions.get(match.id);
        const to = positions.get(match.next_match_id);
        
        connections.push({
          from: {
            matchId: match.id,
            x: from.x + from.width,
            y: from.y + from.height / 2
          },
          to: {
            matchId: match.next_match_id,
            x: to.x,
            y: to.y + to.height / 2
          },
          type: this.getConnectionType(match),
          curved: this.shouldCurveConnection(from, to)
        });
      }
    });
    
    return connections;
  }

  /**
   * Определение типа соединения
   */
  getConnectionType(match) {
    if (match.bracket_type === 'loser') return 'loser';
    if (match.bracket_type === 'placement') return 'third-place';
    return 'winner';
  }

  /**
   * Нужно ли изгибать линию соединения
   */
  shouldCurveConnection(from, to) {
    // Изгибаем если матчи не на одном уровне по вертикали
    return Math.abs(from.y - to.y) > 50;
  }

  /**
   * Получение специальных меток для матчей
   * @param {Object} match - Матч
   * @param {Object} context - Контекст турнира
   * @returns {string|null} Метка матча
   */
  getMatchLabel(match, context) {
    return null;
  }

  /**
   * Конфигурация визуализации
   */
  getVisualizationConfig() {
    return {
      roundSpacing: 300,
      matchSpacing: 80,
      matchWidth: 250,
      matchHeight: 80,
      connectorColor: '#ff0000',
      connectorWidth: 2,
      animateConnections: true
    };
  }
}

// Менеджер форматов
export class FormatManager {
  constructor() {
    this.formats = new Map();
  }

  /**
   * Регистрация нового формата
   */
  register(format) {
    if (!(format instanceof TournamentFormat)) {
      throw new Error('Format must extend TournamentFormat');
    }
    this.formats.set(format.name, format);
    console.log(`📋 Зарегистрирован формат: ${format.name}`);
  }

  /**
   * Получение формата по имени
   */
  getFormat(formatName) {
    const format = this.formats.get(formatName);
    if (!format) {
      console.warn(`⚠️ Формат ${formatName} не найден, используется SingleElimination по умолчанию`);
      return this.formats.get('single_elimination');
    }
    return format;
  }

  /**
   * Список доступных форматов
   */
  getAvailableFormats() {
    return Array.from(this.formats.keys());
  }
}

// Создаем глобальный экземпляр менеджера
export const formatManager = new FormatManager(); 