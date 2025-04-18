import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import './TreeBracketRenderer.css';

/**
 * TreeBracketRenderer компонент для отображения турнирной сетки в виде дерева
 * с возможностью масштабирования и перетаскивания.
 * 
 * @param {Object} props
 * @param {Array} props.games - Массив матчей турнира
 * @param {boolean} props.canEdit - Можно ли редактировать матчи
 * @param {Function} props.onMatchClick - Обработчик клика по матчу
 * @param {string} props.selectedMatchId - ID выбранного матча
 * @param {Function} props.formatParticipantName - Функция для форматирования имен участников
 * @param {string} props.tournamentType - Тип турнира ('Single Elimination' или 'Double Elimination')
 */
const TreeBracketRenderer = ({
  games = [],
  canEdit = false,
  onMatchClick = () => {},
  selectedMatchId = null,
  formatParticipantName = (name) => name,
  tournamentType = 'Single Elimination'
}) => {
  // Состояния для масштабирования и позиционирования
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [startDragPosition, setStartDragPosition] = useState({ x: 0, y: 0 });
  
  // Ссылки для работы с DOM
  const containerRef = useRef(null);
  const bracketRef = useRef(null);
  
  // Группировка матчей по раундам и типам
  const groupedMatches = useCallback(() => {
    if (!games || games.length === 0) {
      return {
        winnersRounds: [],
        losersRounds: [],
        grandFinalMatches: [],
        thirdPlaceMatches: []
      };
    }

    // Найти максимальный раунд для winners и losers
    const maxWinnersRound = Math.max(...games
      .filter(game => game.bracket_type === 'WINNERS')
      .map(game => game.round), 0);
    
    const maxLosersRound = Math.max(...games
      .filter(game => game.bracket_type === 'LOSERS')
      .map(game => game.round), 0);
    
    const matchesByType = {
      winnersRounds: Array.from({ length: maxWinnersRound }, (_, i) => {
        const roundNumber = i + 1;
        return {
          round: roundNumber,
          matches: games.filter(game => 
            game.bracket_type === 'WINNERS' && 
            game.round === roundNumber
          ).sort((a, b) => a.match_order - b.match_order)
        };
      }),
      
      losersRounds: Array.from({ length: maxLosersRound }, (_, i) => {
        const roundNumber = i + 1;
        return {
          round: roundNumber,
          matches: games.filter(game => 
            game.bracket_type === 'LOSERS' && 
            game.round === roundNumber
          ).sort((a, b) => a.match_order - b.match_order)
        };
      }),
      
      grandFinalMatches: games.filter(game => 
        game.bracket_type === 'GRAND_FINAL'
      ).sort((a, b) => a.match_order - b.match_order),
      
      thirdPlaceMatches: games.filter(game => 
        game.bracket_type === 'THIRD_PLACE'
      )
    };
    
    return matchesByType;
  }, [games]);
  
  // Обработчики для drag-and-drop функциональности
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return; // Только левая кнопка мыши
    
    setDragging(true);
    setStartDragPosition({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
    
    e.preventDefault();
  }, [position, setDragging, setStartDragPosition]);
  
  const handleMouseMove = useCallback((e) => {
    if (!dragging) return;
    
    setPosition({
      x: e.clientX - startDragPosition.x,
      y: e.clientY - startDragPosition.y
    });
    
    e.preventDefault();
  }, [dragging, startDragPosition, setPosition]);
  
  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, [setDragging]);
  
  // Обработчики для сенсорных устройств
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return;
    
    setDragging(true);
    setStartDragPosition({
      x: e.touches[0].clientX - position.x,
      y: e.touches[0].clientY - position.y
    });
    
    e.preventDefault();
  }, [position, setDragging, setStartDragPosition]);
  
  const handleTouchMove = useCallback((e) => {
    if (!dragging || e.touches.length !== 1) return;
    
    setPosition({
      x: e.touches[0].clientX - startDragPosition.x,
      y: e.touches[0].clientY - startDragPosition.y
    });
    
    e.preventDefault();
  }, [dragging, startDragPosition, setPosition]);
  
  const handleTouchEnd = useCallback(() => {
    setDragging(false);
  }, [setDragging]);
  
  // Управление масштабированием
  const handleZoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.1, 2));
  };
  
  const handleZoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.1, 0.5));
  };
  
  const handleResetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };
  
  // Очистка обработчиков событий
  useEffect(() => {
    const bracketElement = bracketRef.current;
    
    if (bracketElement) {
      bracketElement.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      bracketElement.addEventListener('touchstart', handleTouchStart, { passive: false });
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
    }
    
    return () => {
      if (bracketElement) {
        bracketElement.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        
        bracketElement.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [dragging, position, startDragPosition, handleMouseDown, handleMouseMove, handleMouseUp, handleTouchStart, handleTouchMove, handleTouchEnd]);
  
  // Получаем сгруппированные матчи
  const { winnersRounds, losersRounds, grandFinalMatches, thirdPlaceMatches } = groupedMatches();
  
  // Если нет матчей, показываем сообщение
  if (!games || games.length === 0) {
    return (
      <div className="tree-bracket-container">
        <div className="empty-bracket-message">
          Сетка турнира еще не сгенерирована
        </div>
      </div>
    );
  }
  
  // Отображение матча
  const renderMatch = (match) => {
    if (!match) return null;
    
    const isSelected = selectedMatchId && match.id === selectedMatchId;
    const matchClasses = `tree-match ${canEdit ? 'editable' : ''} ${isSelected ? 'selected' : ''}`;
    
    // Определяем победителя матча
    const winner = match.winner_id || null;
    
    return (
      <div 
        key={match.id || match.matchNumber}
        className={matchClasses}
        onClick={() => canEdit && onMatchClick(match)}
      >
        <div className="match-number">Матч {match.matchNumber || 'N/A'}</div>
        <div className="match-teams">
          {match.participants && match.participants.map((participant, index) => {
            const isWinner = participant && participant.id === winner;
            const teamClasses = `team ${isWinner ? 'winner' : ''}`;
            
            return (
              <div key={index} className={teamClasses}>
                <div className="team-name">
                  {participant ? formatParticipantName(participant.name) : 'TBD'}
                </div>
                <div className="team-score">
                  {participant ? (participant.score !== null ? participant.score : '-') : '-'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  // Рендеринг раунда с матчами
  const renderRound = (round, isLosers = false) => {
    if (!round || !round.matches || round.matches.length === 0) return null;
    
    // Определяем название раунда
    let roundName = '';
    const roundNumber = round.round;
    
    if (isLosers) {
      roundName = `Нижняя сетка ${roundNumber}`;
    } else {
      // Для Single Elimination логика именования раундов
      const isDoubleElimination = tournamentType === 'DOUBLE_ELIMINATION';
      if (!isDoubleElimination) {
        const totalRounds = winnersRounds.length;
        if (roundNumber === totalRounds) {
          roundName = 'Финал';
        } else if (roundNumber === totalRounds - 1) {
          roundName = 'Полуфинал';
        } else if (roundNumber === totalRounds - 2) {
          roundName = 'Четвертьфинал';
        } else if (roundNumber === totalRounds - 3) {
          roundName = '1/8 финала';
        } else if (roundNumber === totalRounds - 4) {
          roundName = '1/16 финала';
        } else {
          roundName = `Раунд ${roundNumber}`;
        }
      } else {
        roundName = `Верхняя сетка ${roundNumber}`;
      }
    }
    
    return (
      <div key={`${isLosers ? 'losers' : 'winners'}-round-${roundNumber}`} className="tree-round">
        <h3>{roundName}</h3>
        <div className="tree-matches">
          {round.matches.map(match => renderMatch(match))}
        </div>
      </div>
    );
  };
  
  return (
    <div className="tree-bracket-container" ref={containerRef}>
      <div className="tree-controls">
        <button onClick={handleZoomIn} title="Увеличить">+</button>
        <button onClick={handleZoomOut} title="Уменьшить">-</button>
        <button onClick={handleResetView} title="Сбросить вид">↺</button>
      </div>
      <div className="tree-bracket-wrapper">
        <div 
          className="tree-bracket"
          ref={bracketRef}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            cursor: dragging ? 'grabbing' : 'grab'
          }}
        >
          {/* Сетка победителей */}
          <div className="tree-winners-bracket">
            <h2>Основная сетка</h2>
            <div className="tree-rounds">
              {winnersRounds.map(round => renderRound(round, false))}
            </div>
          </div>
          
          {/* Сетка проигравших для Double Elimination */}
          {tournamentType === 'DOUBLE_ELIMINATION' && losersRounds.length > 0 && (
            <>
              <div className="tree-bracket-divider"></div>
              <div className="tree-losers-bracket">
                <h2>Нижняя сетка</h2>
                <div className="tree-rounds">
                  {losersRounds.map(round => renderRound(round, true))}
                </div>
              </div>
            </>
          )}
          
          {/* Финальные матчи */}
          {(grandFinalMatches.length > 0 || thirdPlaceMatches.length > 0) && (
            <div className="tree-final-matches">
              {grandFinalMatches.length > 0 && (
                <div className="tree-grand-final">
                  <h3>Гранд-финал</h3>
                  <div className="tree-matches">
                    {grandFinalMatches.map(match => renderMatch(match))}
                  </div>
                </div>
              )}
              
              {thirdPlaceMatches.length > 0 && (
                <div className="tree-placement-match">
                  <h3>Матч за третье место</h3>
                  <div className="tree-matches">
                    {thirdPlaceMatches.map(match => renderMatch(match))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

TreeBracketRenderer.propTypes = {
  games: PropTypes.array,
  canEdit: PropTypes.bool,
  onMatchClick: PropTypes.func,
  selectedMatchId: PropTypes.number,
  formatParticipantName: PropTypes.func,
  tournamentType: PropTypes.string,
};

export default TreeBracketRenderer; 