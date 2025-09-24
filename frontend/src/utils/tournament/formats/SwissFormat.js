// frontend/src/utils/tournament/formats/SwissFormat.js
import { TournamentFormat } from '../bracketFormats';

export class SwissFormat extends TournamentFormat {
  constructor() {
    super('swiss', {
      supportsPreliminary: false,
      supportsThirdPlace: false
    });
  }

  // Группируем по round: { [round]: { regular: Match[] } }
  groupMatches(matches) {
    const rounds = {};
    (matches || []).forEach(match => {
      const r = Number(match.round || 0);
      if (!rounds[r]) rounds[r] = { regular: [], special: [] };
      rounds[r].regular.push(match);
    });

    // Сортировка матчей внутри раунда по display_sequence/tournament_match_number/match_number/id
    Object.values(rounds).forEach(round => {
      round.regular.sort((a, b) => {
        const ka = Number(a.display_sequence || a.tournament_match_number || a.match_number || a.id || 0);
        const kb = Number(b.display_sequence || b.tournament_match_number || b.match_number || b.id || 0);
        return ka - kb;
      });
    });

    return rounds;
  }

  // Унификация названий раундов: Round N / Semifinal / Final
  getRoundName(round, context) {
    const totalRounds = Number(context?.totalRounds || 0);
    if (round <= 0) return 'Round 0';
    if (totalRounds > 0) {
      if (round === totalRounds) return 'Final';
      if (round === totalRounds - 1) return 'Semifinal';
    }
    return `Round ${round}`;
  }

  // Позиции не критичны для Swiss (используется текущий layout), возвращаем пустую карту
  calculatePositions() {
    return new Map();
  }

  getVisualizationConfig() {
    return {
      roundSpacing: 300,
      matchSpacing: 100,
      matchWidth: 250,
      matchHeight: 80,
      connectorColor: '#ff0000',
      connectorColorHighlight: '#ffffff',
      connectorWidth: 2,
      animateConnections: true
    };
  }
}


