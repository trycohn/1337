/**
 * 🏆 DOUBLE ELIMINATION FORMAT
 * 
 * Формат двойного выбывания с Winners и Losers Bracket
 * Включает Grand Final с возможным reset матчем
 */

import { TournamentFormat } from '../bracketFormats';

export class DoubleEliminationFormat extends TournamentFormat {
  constructor() {
    super('double_elimination', {
      supportsWinnersBracket: true,
      supportsLosersBracket: true,
      supportsGrandFinal: true,
      supportsGrandFinalReset: true
    });
  }

  /**
   * Группировка матчей по bracket_type для Double Elimination
   */
  groupMatches(matches) {
    const grouped = {
      winners: [],
      losers: [],
      grandFinal: []
    };
    
    matches.forEach(match => {
      const bracketType = match.bracket_type || 'winner';
      
      switch (bracketType) {
        case 'winner':
          grouped.winners.push(match);
          break;
        
        case 'loser':
        case 'loser_semifinal':    // 🆕 Малый финал лузеров
        case 'loser_final':        // 🆕 Финал лузеров
          grouped.losers.push(match);
          break;
          
        case 'grand_final':
        case 'grand_final_reset':
          grouped.grandFinal.push(match);
          break;
          
        default:
          // По умолчанию добавляем в winners
          grouped.winners.push(match);
      }
    });
    
    // Сортируем матчи по раундам внутри каждой группы
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => {
        if (a.round !== b.round) {
          return a.round - b.round;
        }
        return (a.match_number || 0) - (b.match_number || 0);
      });
    });
    
    // Группируем по раундам для Winners и Losers
    const result = {
      winners: this._groupByRounds(grouped.winners),
      losers: this._groupByRounds(grouped.losers),
      grandFinal: grouped.grandFinal
    };
    
    return result;
  }

  /**
   * Группировка матчей по раундам
   */
  _groupByRounds(matches) {
    const rounds = {};
    
    matches.forEach(match => {
      const round = match.round || 1;
      if (!rounds[round]) {
        rounds[round] = [];
      }
      rounds[round].push(match);
    });
    
    return rounds;
  }

  /**
   * Получение названия раунда для Double Elimination с улучшенной логикой
   */
  getRoundName(round, context) {
    const { bracketType, totalRounds, matchesInRound, isLastRound } = context;
    
    if (bracketType === 'grand_final') {
      return 'Grand Final';
    }
    
    if (bracketType === 'loser') {
      // Специальная обработка для малого финала лузеров
      if (isLastRound || round === totalRounds) {
        return 'Losers Small Final';
      }
      
      // Более описательные названия для Losers Bracket
      if (round === 1) {
        return 'Losers First Round';
      } else if (round === 2) {
        return 'Losers Second Round';
      } else if (round === totalRounds - 1) {
        return 'Losers Semi-Final';
      } else {
        return `Losers Round ${round}`;
      }
    }
    
    // Winners bracket названия с улучшенной логикой
    const roundsFromEnd = totalRounds - round;
    
    switch (roundsFromEnd) {
      case 0:
        return 'Winners Final';
      case 1:
        return 'Winners Semi-Final';
      case 2:
        return 'Winners Quarter-Final';
      case 3:
        return 'Winners Round of 16';
      case 4:
        return 'Winners Round of 32';
      case 5:
        return 'Winners Round of 64';
      case 6:
        return 'Winners Round of 128';
      default:
        return `Winners Round ${round}`;
    }
  }

  /**
   * Расчет позиций матчей для Double Elimination
   */
  calculatePositions(groupedMatches) {
    const positions = new Map();
    const config = this.getVisualizationConfig();
    
    let currentY = 50; // Начальная позиция Y
    
    // 1. Позиции для Winners Bracket
    if (groupedMatches.winners) {
      this._calculateBracketPositions(
        groupedMatches.winners, 
        positions, 
        config,
        50, // startX
        currentY,
        'winners'
      );
      
      currentY += 400; // Отступ между bracket'ами
    }
    
    // 2. Позиции для Losers Bracket
    if (groupedMatches.losers) {
      this._calculateBracketPositions(
        groupedMatches.losers, 
        positions, 
        config,
        50, // startX
        currentY,
        'losers'
      );
      
      currentY += 400;
    }
    
    // 3. Позиции для Grand Final
    if (groupedMatches.grandFinal && groupedMatches.grandFinal.length > 0) {
      const grandFinalX = this._getMaxX(positions) + config.roundSpacing;
      
      groupedMatches.grandFinal.forEach((match, index) => {
        positions.set(match.id, {
          x: grandFinalX,
          y: currentY / 2 + (index * config.matchSpacing), // Центрируем по вертикали
          width: config.matchWidth,
          height: config.matchHeight,
          matchType: 'grand-final',
          bracketType: match.bracket_type
        });
      });
    }
    
    return positions;
  }

  /**
   * Расчет позиций для отдельного bracket
   */
  _calculateBracketPositions(rounds, positions, config, startX, startY, bracketType) {
    let currentX = startX;
    
    // Сортируем раунды по порядку
    const sortedRounds = Object.entries(rounds)
      .sort(([a], [b]) => parseInt(a) - parseInt(b));
    
    sortedRounds.forEach(([round, matches], roundIndex) => {
      const totalMatches = matches.length;
      const spacing = config.matchSpacing;
      const centerY = startY + 200; // Центр области для bracket
      
      // Рассчитываем начальную позицию Y для центрирования матчей
      const totalHeight = (totalMatches - 1) * spacing;
      const startMatchY = centerY - (totalHeight / 2);
      
      matches.forEach((match, matchIndex) => {
        const y = startMatchY + (matchIndex * spacing);
        
        positions.set(match.id, {
          x: currentX,
          y: y,
          width: config.matchWidth,
          height: config.matchHeight,
          round: parseInt(round),
          bracketType: bracketType,
          matchType: this.getMatchType(match)
        });
      });
      
      currentX += config.roundSpacing;
    });
  }

  /**
   * Получение максимальной X координаты
   */
  _getMaxX(positions) {
    let maxX = 0;
    positions.forEach(pos => {
      if (pos.x > maxX) {
        maxX = pos.x;
      }
    });
    return maxX;
  }

  /**
   * Определение типа матча
   */
  getMatchType(match) {
    switch (match.bracket_type) {
      case 'grand_final':
        return 'grand-final-main';
      case 'grand_final_reset':
        return 'grand-final-triumph';
      case 'loser':
        return 'loser';
      case 'winner':
        return 'winner';
      default:
        return 'regular';
    }
  }

  /**
   * Получение метки для матча
   */
  getMatchLabel(match, context) {
    if (match.bracket_type === 'grand_final') {
      return '🏆 Матч за 1-е место'; // 🆕 Изменено с "🏁 Grand Final"
    }
    
    if (match.bracket_type === 'grand_final_reset') {
      return '🔄 Grand Final Triumph'; // Переименовано: более торжественное название
    }
    
    // Можно добавить специальные метки для финалов winners/losers
    if (match.bracket_position) {
      if (match.bracket_position.includes('WB') && match.bracket_position.includes('R' + context.totalWinnersRounds)) {
        return '🏆 Winners Final';
      }
      if (match.bracket_position.includes('LB') && match.bracket_position.includes('R' + context.totalLosersRounds)) {
        return '💔 Losers Final';
      }
    }
    
    return null;
  }

  /**
   * Переопределяем тип соединения для Double Elimination
   */
  getConnectionType(match) {
    // Проигравший из Winners идет в Losers
    if (match.loser_next_match_id) {
      return 'to-losers';
    }
    
    // Обычное продвижение в том же bracket
    return match.bracket_type || 'winner';
  }

  /**
   * Расчет соединений с учетом loser_next_match_id
   */
  calculateConnections(matches, positions) {
    const connections = [];
    
    matches.forEach(match => {
      const fromPos = positions.get(match.id);
      if (!fromPos) return;
      
      // Соединение для победителя
      if (match.next_match_id && positions.has(match.next_match_id)) {
        const toPos = positions.get(match.next_match_id);
        
        connections.push({
          from: {
            matchId: match.id,
            x: fromPos.x + fromPos.width,
            y: fromPos.y + fromPos.height / 2
          },
          to: {
            matchId: match.next_match_id,
            x: toPos.x,
            y: toPos.y + toPos.height / 2
          },
          type: 'winner',
          curved: true
        });
      }
      
      // Соединение для проигравшего (переход в Losers Bracket)
      if (match.loser_next_match_id && positions.has(match.loser_next_match_id)) {
        const toPos = positions.get(match.loser_next_match_id);
        
        connections.push({
          from: {
            matchId: match.id,
            x: fromPos.x + fromPos.width / 2,
            y: fromPos.y + fromPos.height
          },
          to: {
            matchId: match.loser_next_match_id,
            x: toPos.x + toPos.width / 2,
            y: toPos.y
          },
          type: 'to-losers',
          curved: true,
          style: 'dashed' // Пунктирная линия для перехода в Losers
        });
      }
    });
    
    return connections;
  }

  /**
   * Конфигурация визуализации для Double Elimination
   */
  getVisualizationConfig() {
    return {
      roundSpacing: 300,
      matchSpacing: 120,
      matchWidth: 250,
      matchHeight: 80,
      connectorColor: '#ff0000',
      connectorColorWinner: '#00ff00',
      connectorColorLoser: '#ff6b6b',
      connectorColorToLosers: '#ff6b6b',
      connectorWidth: 2,
      animateConnections: true,
      matchColors: {
        winner: '#001100',
        loser: '#220000',
        'grand-final': '#1a1a00',
        'grand-final-triumph': '#1a0d00'
      }
    };
  }
} 