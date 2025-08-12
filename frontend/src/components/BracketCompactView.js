// frontend/src/components/BracketCompactView.js
import React, { useMemo } from 'react';
import './BracketCompactView.css';

function groupGamesByTypeAndRound(games) {
  const groups = { winners: {}, losers: {}, grand_final: {} };
  games.forEach((g) => {
    const type = g.bracket_type || 'winner';
    if (type === 'loser') {
      const round = String(g.round ?? 0);
      if (!groups.losers[round]) groups.losers[round] = [];
      groups.losers[round].push(g);
    } else if (type === 'grand_final' || type === 'grand_final_reset') {
      if (!groups.grand_final['1']) groups.grand_final['1'] = [];
      groups.grand_final['1'].push(g);
    } else {
      const round = String(g.round ?? 0);
      if (!groups.winners[round]) groups.winners[round] = [];
      groups.winners[round].push(g);
    }
  });
  return groups;
}

export function BracketCompactView({ games = [], tournament, focusMatchId = null }) {
  const groups = useMemo(() => groupGamesByTypeAndRound(games), [games]);
  const hasWinners = Object.keys(groups.winners).length > 0;
  const hasLosers = Object.keys(groups.losers).length > 0;
  const hasGF = Object.keys(groups.grand_final).length > 0;

  const renderRow = (match) => {
    const p1 = match.participants?.[0] || { name: 'TBD', score: null };
    const p2 = match.participants?.[1] || { name: 'TBD', score: null };
    const num = match.tournament_match_number || match.match_number || match.id;
    const isFocused = focusMatchId && String(focusMatchId) === String(match.id);
    return (
      <div
        key={match.id}
        className={`bcv-row ${isFocused ? 'bcv-row-focused' : ''}`}
        data-match-id={match.id}
      >
        <div className="bcv-cell bcv-cell-num">#{num}</div>
        <div className="bcv-cell bcv-cell-name">{match.name || `Матч ${num}`}</div>
        <div className="bcv-cell bcv-cell-pair">
          <span className="bcv-team">{p1.name}</span>
          <span className="bcv-vs">vs</span>
          <span className="bcv-team">{p2.name}</span>
        </div>
        <div className="bcv-cell bcv-cell-score">
          <span>{p1.score ?? '-'}</span>
          <span className="bcv-score-sep">:</span>
          <span>{p2.score ?? '-'}</span>
        </div>
        <div className="bcv-cell bcv-cell-round">Раунд {match.round ?? '?'}</div>
      </div>
    );
  };

  const renderSection = (title, subtitle, rounds) => (
    <div className="bcv-section">
      <div className="bcv-section-header">
        <div className="bcv-title">{title}</div>
        {subtitle ? <div className="bcv-subtitle">{subtitle}</div> : null}
      </div>
      <div className="bcv-table">
        <div className="bcv-header">
          <div className="bcv-cell bcv-cell-num">№</div>
          <div className="bcv-cell bcv-cell-name">Матч</div>
          <div className="bcv-cell bcv-cell-pair">Пара</div>
          <div className="bcv-cell bcv-cell-score">Счет</div>
          <div className="bcv-cell bcv-cell-round">Раунд</div>
        </div>
        {Object.entries(rounds)
          .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10))
          .map(([round, items]) => (
            <div key={round} className="bcv-round-group">
              <div className="bcv-round-label">Раунд {round}</div>
              {items.map(renderRow)}
            </div>
          ))}
      </div>
    </div>
  );

  return (
    <div className="bcv-container">
      {hasWinners && renderSection('Winners Bracket', 'Верхняя сетка турнира', groups.winners)}
      {hasLosers && renderSection('Losers Bracket', 'Нижняя сетка на выбывание', groups.losers)}
      {hasGF && (
        <div className="bcv-section">
          <div className="bcv-section-header">
            <div className="bcv-title">Grand Final</div>
            <div className="bcv-subtitle">Финальное противостояние</div>
          </div>
          <div className="bcv-table">
            {Object.values(groups.grand_final).flat().map(renderRow)}
          </div>
        </div>
      )}
    </div>
  );
}

export default BracketCompactView;


