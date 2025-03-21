const pool = require('./db');

/**
 * Генерация турнирной сетки
 * @param {number} tournamentId - ID турнира
 * @param {Array} participants - Массив участников [{ id, name }]
 * @param {boolean} thirdPlaceMatch - Нужен ли матч за 3-е место
 * @returns {Array} - Список сгенерированных матчей
 */
const generateBracket = async (tournamentId, participants, thirdPlaceMatch) => {
  const matches = [];
  let matchNumber = 1;

  // Рандомизируем участников
  const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);
  const participantCount = shuffledParticipants.length;

  // Ближайшая степень двойки <= participantCount
  const targetCount = Math.pow(2, Math.floor(Math.log2(participantCount)));
  const prelimMatchesCount = participantCount - targetCount; // Матчи для выравнивания

  // **Предварительный раунд**
  if (prelimMatchesCount > 0) {
    const prelimParticipants = shuffledParticipants.splice(0, prelimMatchesCount * 2);
    for (let i = 0; i < prelimParticipants.length; i += 2) {
      const team1 = prelimParticipants[i];
      const team2 = prelimParticipants[i + 1] || { id: null, name: 'TBD' };
      const match = await pool.query(
        'INSERT INTO matches (tournament_id, round, team1_id, team2_id, match_number) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [tournamentId, -1, team1.id, team2.id, matchNumber++]
      );
      matches.push(match.rows[0]);
    }
  }

  // Участники основного раунда: оставшиеся + победители предварительного
  const mainParticipants = [
    ...shuffledParticipants,
    ...Array(prelimMatchesCount).fill({ id: null, name: 'TBD' }) // Места для победителей
  ];

  // **Полуфиналы (Раунд 0)**
  const round0Matches = [];
  for (let i = 0; i < targetCount / 2; i++) {
    const team1 = mainParticipants[i * 2] || { id: null, name: 'TBD' };
    const team2 = mainParticipants[i * 2 + 1] || { id: null, name: 'TBD' };
    const match = await pool.query(
      'INSERT INTO matches (tournament_id, round, team1_id, team2_id, match_number) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [tournamentId, 0, team1.id, team2.id, matchNumber++]
    );
    round0Matches.push(match.rows[0]);
  }
  matches.push(...round0Matches);

  // **Финальный раунд (Раунд 1)**
  const finalMatch = await pool.query(
    'INSERT INTO matches (tournament_id, round, team1_id, team2_id, match_number) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [tournamentId, 1, null, null, matchNumber++]
  );
  matches.push(finalMatch.rows[0]);

  if (thirdPlaceMatch) {
    const thirdPlaceMatchResult = await pool.query(
      'INSERT INTO matches (tournament_id, round, team1_id, team2_id, match_number, is_third_place_match) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [tournamentId, 1, null, null, matchNumber++, true]
    );
    matches.push(thirdPlaceMatchResult.rows[0]);
  }

  // **Обновление next_match_id**
  const prelimMatches = matches.filter(m => m.round === -1);
  const round0MatchesFiltered = matches.filter(m => m.round === 0); // Исправлено: избегание повторного объявления
  const round1Matches = matches.filter(m => m.round === 1 && !m.is_third_place_match);

  for (let i = 0; i < prelimMatches.length; i++) {
    const nextMatchIndex = i % 2; // Связываем с матчами Раунда 0
    if (nextMatchIndex < round0MatchesFiltered.length) {
      await pool.query(
        'UPDATE matches SET next_match_id = $1 WHERE id = $2',
        [round0MatchesFiltered[nextMatchIndex].id, prelimMatches[i].id]
      );
      prelimMatches[i].next_match_id = round0MatchesFiltered[nextMatchIndex].id;
    }
  }

  for (let i = 0; i < round0MatchesFiltered.length; i++) {
    if (i < round1Matches.length) {
      await pool.query(
        'UPDATE matches SET next_match_id = $1 WHERE id = $2',
        [round1Matches[0].id, round0MatchesFiltered[i].id]
      );
      round0MatchesFiltered[i].next_match_id = round1Matches[0].id;
    }
  }

  return matches;
};

module.exports = { generateBracket };