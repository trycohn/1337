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
      if (draggedItem.position !== position) {
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
        <span className="empty-text">Свободная позиция</span>
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

// 📊 Табличный редактор
const TableBracketEditor = ({ participants, bracketPositions, onPositionChange, onPreview }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredParticipants = useMemo(() => {
    if (!searchTerm) return participants;
    return participants.filter(p => 
      (p.name || p.username || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [participants, searchTerm]);

  const availableParticipants = useMemo(() => {
    const usedParticipants = new Set(
      bracketPositions.map(pos => pos.participant?.id).filter(Boolean)
    );
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
          <div className="col-position">Позиция</div>
          <div className="col-match">Матч</div>
          <div className="col-participant">Участник</div>
          <div className="col-actions">Действия</div>
        </div>
        
        <div className="table-body">
          {bracketPositions.map((position, index) => (
            <div key={`${position.matchId}-${position.slot}`} className="table-row">
              <div className="col-position">
                #{index + 1}
              </div>
              <div className="col-match">
                <div className="match-info">
                  <span className="match-title">{position.matchTitle}</span>
                  <span className="match-slot">Слот {position.slot}</span>
                </div>
              </div>
              <div className="col-participant">
                <select
                  value={position.participant?.id || ''}
                  onChange={(e) => {
                    const participantId = e.target.value;
                    const participant = participantId ? 
                      participants.find(p => p.id.toString() === participantId) : null;
                    onPositionChange(index, participant);
                  }}
                  className="participant-select"
                >
                  <option value="">-- Не выбран --</option>
                  {filteredParticipants.map(participant => (
                    <option 
                      key={participant.id} 
                      value={participant.id}
                      disabled={
                        position.participant?.id !== participant.id &&
                        bracketPositions.some(pos => pos.participant?.id === participant.id)
                      }
                    >
                      {participant.name || participant.username}
                      {participant.faceit_elo && ` (ELO: ${participant.faceit_elo})`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-actions">
                {position.participant && (
                  <button
                    onClick={() => onPositionChange(index, null)}
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
  const [previewMode, setPreviewMode] = useState(false);

  // 📊 Инициализация позиций из матчей
  useEffect(() => {
    const positions = [];
    
    // Сортируем матчи по раундам и позициям
    const sortedMatches = [...matches]
      .filter(match => match.round === 1) // Берем только первый раунд для редактирования
      .sort((a, b) => a.match_number - b.match_number);

    sortedMatches.forEach(match => {
      const matchTitle = `Матч ${match.match_number} (Раунд ${match.round})`;
      
      // Позиция 1
      positions.push({
        matchId: match.id,
        slot: 1,
        matchTitle,
        participant: match.team1_id ? participants.find(p => p.id === match.team1_id) : null,
      });

      // Позиция 2  
      positions.push({
        matchId: match.id,
        slot: 2,
        matchTitle,
        participant: match.team2_id ? participants.find(p => p.id === match.team2_id) : null,
      });
    });

    setBracketPositions(positions);
  }, [matches, participants]);

  // 🔄 Обработка перестановки участников (Drag & Drop)
  const handleSwap = useCallback((fromIndex, toIndex) => {
    setBracketPositions(prev => {
      const newPositions = [...prev];
      const temp = newPositions[fromIndex].participant;
      newPositions[fromIndex].participant = newPositions[toIndex].participant;
      newPositions[toIndex].participant = temp;
      return newPositions;
    });
    setHasChanges(true);
  }, []);

  // 📝 Обработка изменения позиции (Table)
  const handlePositionChange = useCallback((index, participant) => {
    setBracketPositions(prev => {
      const newPositions = [...prev];
      newPositions[index].participant = participant;
      return newPositions;
    });
    setHasChanges(true);
  }, []);

  // 👁️ Переключение режима предварительного просмотра
  const handlePreviewToggle = () => {
    setPreviewMode(!previewMode);
  };

  // 💾 Сохранение изменений
  const handleSave = async () => {
    if (!hasChanges) return;

    setIsLoading(true);
    try {
      // Формируем данные для отправки
      const bracketData = [];
      
      for (let i = 0; i < bracketPositions.length; i += 2) {
        const pos1 = bracketPositions[i];
        const pos2 = bracketPositions[i + 1];
        
        if (pos1 && pos2 && pos1.matchId === pos2.matchId) {
          bracketData.push({
            matchId: pos1.matchId,
            team1_id: pos1.participant?.id || null,
            team2_id: pos2.participant?.id || null,
          });
        }
      }

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
                    className={`preview-btn ${previewMode ? 'active' : ''}`}
                  >
                    👁️ {previewMode ? 'Скрыть' : 'Показать'} превью
                  </button>
                </div>

                <div className="bracket-positions">
                  {bracketPositions.map((position, index) => (
                    <div key={`${position.matchId}-${position.slot}`} className="position-wrapper">
                      <div className="position-label">
                        {position.matchTitle} - Слот {position.slot}
                      </div>
                      <DraggableParticipant
                        participant={position.participant}
                        position={index}
                        onSwap={handleSwap}
                        isPreview={previewMode}
                      />
                    </div>
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