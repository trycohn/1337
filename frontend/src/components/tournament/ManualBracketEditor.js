import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import { isMobile } from 'react-device-detect';
import axios from 'axios';
import './ManualBracketEditor.css';

const DRAG_TYPE = 'PARTICIPANT';

// 🎯 Компонент перетаскиваемого участника
const DraggableParticipant = ({ participant, position, onSwap, isPreview = false }) => {
  const [{ isDragging }, drag] = useDrag({
    type: DRAG_TYPE,
    item: { participant, position },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver, canDrop }, drop] = useDrop({
    accept: DRAG_TYPE,
    drop: (draggedItem) => {
      if (draggedItem.position.matchIndex !== position.matchIndex || draggedItem.position.slot !== position.slot) {
        onSwap(draggedItem.position, position);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  const attachRef = (element) => {
    drag(element);
    drop(element);
  };

  if (!participant) {
    return (
      <div 
        ref={drop}
        className={`participant-slot empty ${isOver && canDrop ? 'drop-target' : ''}`}
      >
        <span className="empty-text">Свободно</span>
      </div>
    );
  }

  return (
    <div
      ref={attachRef}
      className={`participant-slot filled ${isDragging ? 'dragging' : ''} ${isOver && canDrop ? 'drop-target' : ''} ${isPreview ? 'preview' : ''}`}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <div className="participant-info">
        <div className="participant-name">{participant.name || participant.username}</div>
        <div className="participant-details">
          {participant.faceit_elo && <span className="elo">ELO: {participant.faceit_elo}</span>}
          {participant.cs2_premier_rank && <span className="rank">Rank: {participant.cs2_premier_rank}</span>}
        </div>
      </div>
      <div className="drag-handle">⋮⋮</div>
    </div>
  );
};

// 🏆 Компонент строки матча для Drag & Drop
const DraggableMatchRow = ({ match, matchIndex, onSwap }) => {
  return (
    <div className="match-row">
      <div className="match-title">{match.matchTitle}</div>
      <div className="match-participants">
        <DraggableParticipant
          participant={match.participant1}
          position={{ matchIndex, slot: 1 }}
          onSwap={onSwap}
        />
        <div className="vs-separator">VS</div>
        <DraggableParticipant
          participant={match.participant2}
          position={{ matchIndex, slot: 2 }}
          onSwap={onSwap}
        />
      </div>
    </div>
  );
};

// 📊 Табличный редактор
const TableBracketEditor = ({ participants, bracketPositions, onPositionChange, onPreview }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredParticipants = useMemo(() => {
    if (!searchTerm) return participants;
    return participants.filter(p => 
      (p.name || p.username || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [participants, searchTerm]);

  // Преобразуем структуру данных для таблицы
  const tableRows = useMemo(() => {
    const rows = [];
    bracketPositions.forEach((match, matchIndex) => {
      // Строка для первого участника
      rows.push({
        position: matchIndex * 2,
        matchTitle: match.matchTitle,
        slot: 1,
        participant: match.participant1,
      });
      // Строка для второго участника
      rows.push({
        position: matchIndex * 2 + 1,
        matchTitle: match.matchTitle,
        slot: 2,
        participant: match.participant2,
      });
    });
    return rows;
  }, [bracketPositions]);

  const availableParticipants = useMemo(() => {
    const usedParticipants = new Set();
    bracketPositions.forEach(match => {
      if (match.participant1) usedParticipants.add(match.participant1.id);
      if (match.participant2) usedParticipants.add(match.participant2.id);
    });
    return participants.filter(p => !usedParticipants.has(p.id));
  }, [participants, bracketPositions]);

  return (
    <div className="table-bracket-editor">
      <div className="editor-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Поиск участников..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="available-count">
          Свободных участников: {availableParticipants.length}
        </div>
      </div>

      <div className="positions-table">
        <div className="table-header">
          <div className="col-position">№</div>
          <div className="col-match">Матч</div>
          <div className="col-participant">Участник</div>
          <div className="col-actions">Действия</div>
        </div>
        
        <div className="table-body">
          {tableRows.map((row, index) => (
            <div key={`${row.matchTitle}-${row.slot}`} className="table-row">
              <div className="col-position">
                #{index + 1}
              </div>
              <div className="col-match">
                <div className="match-info">
                  <span className="match-title">{row.matchTitle}</span>
                  <span className="match-slot">Слот {row.slot}</span>
                </div>
              </div>
              <div className="col-participant">
                <select
                  value={row.participant?.id || ''}
                  onChange={(e) => {
                    const participantId = e.target.value;
                    const participant = participantId ? 
                      participants.find(p => p.id.toString() === participantId) : null;
                    onPositionChange(row.position, participant);
                  }}
                  className="participant-select"
                >
                  <option value="">-- Не выбран --</option>
                  {filteredParticipants.map(participant => (
                    <option 
                      key={participant.id} 
                      value={participant.id}
                      disabled={
                        row.participant?.id !== participant.id &&
                        tableRows.some(r => r.participant?.id === participant.id)
                      }
                    >
                      {participant.name || participant.username}
                      {participant.faceit_elo && ` (ELO: ${participant.faceit_elo})`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-actions">
                {row.participant && (
                  <button
                    onClick={() => onPositionChange(row.position, null)}
                    className="btn-clear"
                    title="Очистить позицию"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 🎨 Основной компонент редактора
const ManualBracketEditor = ({ 
  tournament, 
  matches, 
  participants, 
  onClose, 
  onSave 
}) => {
  const [editorMode, setEditorMode] = useState('drag'); // 'drag' или 'table'
  const [bracketPositions, setBracketPositions] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 📊 Инициализация позиций из матчей
  useEffect(() => {
    const matchesData = [];
    
    // Сортируем матчи по раундам и позициям
    const sortedMatches = [...matches]
      .filter(match => match.round === 1) // Берем только первый раунд для редактирования
      .sort((a, b) => a.match_number - b.match_number);

    sortedMatches.forEach(match => {
      const matchTitle = `Матч ${match.match_number}`;
      
      // Группируем участников по матчам
      matchesData.push({
        matchId: match.id,
        matchTitle,
        participant1: match.team1_id ? participants.find(p => p.id === match.team1_id) : null,
        participant2: match.team2_id ? participants.find(p => p.id === match.team2_id) : null,
      });
    });

    setBracketPositions(matchesData);
  }, [matches, participants]);

  // 🔄 Обработка перестановки участников (Drag & Drop)
  const handleSwap = useCallback((fromPosition, toPosition) => {
    const { matchIndex: fromMatchIndex, slot: fromSlot } = fromPosition;
    const { matchIndex: toMatchIndex, slot: toSlot } = toPosition;
    
    setBracketPositions(prev => {
      const newPositions = [...prev];
      
      // Получаем участников для обмена
      const fromParticipant = fromSlot === 1 ? newPositions[fromMatchIndex].participant1 : newPositions[fromMatchIndex].participant2;
      const toParticipant = toSlot === 1 ? newPositions[toMatchIndex].participant1 : newPositions[toMatchIndex].participant2;
      
      // Меняем местами
      if (fromSlot === 1) {
        newPositions[fromMatchIndex].participant1 = toParticipant;
      } else {
        newPositions[fromMatchIndex].participant2 = toParticipant;
      }
      
      if (toSlot === 1) {
        newPositions[toMatchIndex].participant1 = fromParticipant;
      } else {
        newPositions[toMatchIndex].participant2 = fromParticipant;
      }
      
      return newPositions;
    });
    setHasChanges(true);
  }, []);

  // 📝 Обработка изменения позиции (Table)
  const handlePositionChange = useCallback((index, participant) => {
    setBracketPositions(prev => {
      const newPositions = [...prev];
      
      // Конвертируем плоский индекс в matchIndex и slot
      const matchIndex = Math.floor(index / 2);
      const slot = (index % 2) + 1;
      
      if (slot === 1) {
        newPositions[matchIndex].participant1 = participant;
      } else {
        newPositions[matchIndex].participant2 = participant;
      }
      
      return newPositions;
    });
    setHasChanges(true);
  }, []);

  // 👁️ Переключение режима предварительного просмотра
  const handlePreviewToggle = () => {
    // Открываем превью турнира в новой вкладке
    const previewUrl = `/tournament/${tournament.id}`;
    window.open(previewUrl, '_blank');
  };

  // 💾 Сохранение изменений
  const handleSave = async () => {
    if (!hasChanges) return;

    setIsLoading(true);
    try {
      // Формируем данные для отправки
      const bracketData = bracketPositions.map(match => ({
        matchId: match.matchId,
        team1_id: match.participant1?.id || null,
        team2_id: match.participant2?.id || null,
      }));

      const response = await axios.post(
        `/api/tournaments/${tournament.id}/manual-bracket-edit`,
        { bracketData },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );

      if (response.data.success) {
        onSave(response.data);
        onClose();
      }
    } catch (error) {
      console.error('Ошибка сохранения расстановки:', error);
      alert('Ошибка при сохранении расстановки: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  // 🔄 Сброс изменений
  const handleReset = () => {
    window.location.reload(); // Простой способ сбросить все изменения
  };

  const dndBackend = isMobile ? TouchBackend : HTML5Backend;

  return (
    <div className="manual-bracket-editor-overlay">
      <div className="manual-bracket-editor">
        <div className="editor-header">
          <h2>✏️ Ручное редактирование сетки</h2>
          <p className="warning-text">
            ⚠️ При сохранении все результаты матчей будут сброшены
          </p>
          
          {/* 🔄 Переключатель режимов */}
          <div className="mode-toggle">
            <button
              className={`mode-btn ${editorMode === 'drag' ? 'active' : ''}`}
              onClick={() => setEditorMode('drag')}
            >
              🎯 Drag & Drop
            </button>
            <button
              className={`mode-btn ${editorMode === 'table' ? 'active' : ''}`}
              onClick={() => setEditorMode('table')}
            >
              📊 Таблица
            </button>
          </div>
        </div>

        <div className="editor-body">
          {editorMode === 'drag' ? (
            <DndProvider backend={dndBackend}>
              <div className="drag-editor">
                <div className="editor-controls">
                  <button
                    onClick={handlePreviewToggle}
                    className="preview-btn"
                  >
                    👁️ Открыть превью турнира
                  </button>
                </div>

                <div className="matches-container">
                  {bracketPositions.map((match, index) => (
                    <DraggableMatchRow
                      key={match.matchId}
                      match={match}
                      matchIndex={index}
                      onSwap={handleSwap}
                    />
                  ))}
                </div>
              </div>
            </DndProvider>
          ) : (
            <TableBracketEditor
              participants={participants}
              bracketPositions={bracketPositions}
              onPositionChange={handlePositionChange}
              onPreview={handlePreviewToggle}
            />
          )}
        </div>

        <div className="editor-footer">
          <div className="changes-indicator">
            {hasChanges && <span className="changes-badge">● Есть несохраненные изменения</span>}
          </div>
          
          <div className="editor-actions">
            <button
              onClick={handleReset}
              className="btn-secondary"
              disabled={isLoading}
            >
              🔄 Сбросить
            </button>
            <button
              onClick={onClose}
              className="btn-secondary"
              disabled={isLoading}
            >
              ❌ Отмена
            </button>
            <button
              onClick={handleSave}
              className="btn-primary"
              disabled={!hasChanges || isLoading}
            >
              {isLoading ? '⏳ Сохранение...' : '💾 Сохранить расстановку'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManualBracketEditor; 