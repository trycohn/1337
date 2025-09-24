/**
 * 🏆 SINGLE ELIMINATION FORMAT
 * 
 * Классический формат одиночного выбывания
 * с поддержкой предварительного раунда и матча за 3-е место
 */

import { TournamentFormat } from '../bracketFormats';

export class SingleEliminationFormat extends TournamentFormat {
  constructor() {
    super('single_elimination', {
      supportsPreliminary: true,
      supportsThirdPlace: true
    });
  }

  /**
   * Группировка матчей по раундам с учетом специальных матчей
   */
  groupMatches(matches) {
    const rounds = {};
    
    matches.forEach(match => {
      const roundKey = match.round;
      
      if (!rounds[roundKey]) {
        rounds[roundKey] = {
          regular: [],
          special: []
        };
      }
      
      // Матч за 3-е место идет в специальные
      if (match.bracket_type === 'placement' || match.is_third_place_match) {
        rounds[roundKey].special.push(match);
      } else {
        rounds[roundKey].regular.push(match);
      }
    });
    
    // Сортируем матчи внутри раундов
    Object.values(rounds).forEach(round => {
      round.regular.sort((a, b) => (a.match_number || 0) - (b.match_number || 0));
      round.special.sort((a, b) => (a.match_number || 0) - (b.match_number || 0));
    });
    
    return rounds;
  }

  /**
   * Получение правильного названия раунда
   */
  getRoundName(round, context) {
    const { totalRounds, isFinalsRound } = context;
    
    // Унификация для всех сеток: Round N / Semifinal / Final
    if (round === -1 || round === 0) return 'Round 0';
    if (round === totalRounds) return 'Final';
    if (round === totalRounds - 1) return 'Semifinal';
    
    return `Round ${round}`;
  }

  /**
   * Расчет позиций матчей для визуализации
   */
  calculatePositions(groupedMatches) {
    const positions = new Map();
    const config = this.getVisualizationConfig();
    
    let currentX = 50; // Начальная позиция X
    
    // Сортируем раунды по порядку
    const sortedRounds = Object.entries(groupedMatches)
      .sort(([a], [b]) => parseInt(a) - parseInt(b));
    
    sortedRounds.forEach(([round, roundData], roundIndex) => {
      const { regular, special } = roundData;
      const allMatches = [...special, ...regular]; // Спец. матчи сверху
      
      // Рассчитываем вертикальное распределение
      const totalMatches = allMatches.length;
      const availableHeight = 600; // Высота области
      const matchSpacing = Math.min(config.matchSpacing, availableHeight / totalMatches);
      const startY = (availableHeight - (totalMatches * matchSpacing)) / 2 + 100;
      
      allMatches.forEach((match, index) => {
        const y = startY + (index * matchSpacing);
        
        positions.set(match.id, {
          x: currentX,
          y: y,
          width: config.matchWidth,
          height: config.matchHeight,
          round: parseInt(round),
          isSpecial: special.includes(match),
          matchType: this.getMatchType(match)
        });
      });
      
      currentX += config.roundSpacing;
    });
    
    return positions;
  }

  /**
   * Определение типа матча
   */
  getMatchType(match) {
    if (match.bracket_type === 'placement' || match.is_third_place_match) {
      return 'third-place';
    }
    
    // Проверяем, является ли это финалом
    if (match.match_number === 1 && !match.is_third_place_match) {
      // Дополнительная проверка может быть нужна
      return 'final';
    }
    
    return 'regular';
  }

  /**
   * Получение специальной метки для матча
   */
  getMatchLabel(match, context) {
    const matchType = this.getMatchType(match);
    
    switch (matchType) {
      case 'third-place':
        return '🥉 Матч за 3-е место';
      case 'final':
        return '🏆 Финал';
      default:
        return null;
    }
  }

  /**
   * Специальная логика для изгиба соединений
   */
  shouldCurveConnection(from, to) {
    // Всегда изгибаем соединения для лучшей визуализации
    return true;
  }

  /**
   * Конфигурация визуализации для Single Elimination
   */
  getVisualizationConfig() {
    return {
      roundSpacing: 300,
      matchSpacing: 100,
      matchWidth: 250,
      matchHeight: 80,
      connectorColor: '#ff0000',
      connectorColorHighlight: '#ffffff',
      connectorWidth: 2,
      animateConnections: true,
      // Специальные цвета для разных типов матчей
      matchColors: {
        regular: '#111111',
        final: '#1a1a1a',
        'third-place': '#0d0d0d'
      }
    };
  }
} 