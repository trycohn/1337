import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { ensureHttps } from '../utils/userHelpers';
import './TeamGenerator.css';

/**
 * Компонент для генерации команд в турнире
 * 
 * @param {Object} props - Свойства компонента
 * @param {Object} props.tournament - Объект турнира
 * @param {Array} props.participants - Список участников для формирования команд
 * @param {Function} props.onTeamsGenerated - Функция обратного вызова при формировании команд
 * @param {Function} props.onTeamsUpdated - Функция обратного вызова для обновления данных турнира
 * @param {Function} props.onRemoveParticipant - Функция для удаления участника
 * @param {boolean} props.isAdminOrCreator - Имеет ли пользователь права администратора
 * @param {Function} props.toast - Функция для отображения уведомлений
 */
const TeamGenerator = ({ 
  tournament, 
  participants, 
  onTeamsGenerated, 
  onTeamsUpdated,
  onRemoveParticipant,
  isAdminOrCreator = false,
  toast
}) => {
  const [ratingType, setRatingType] = useState('faceit');
  const [teamSize, setTeamSize] = useState('5');
  const [loading, setLoading] = useState(false);
  const [mixedTeams, setMixedTeams] = useState([]);
  const [originalParticipants, setOriginalParticipants] = useState([]);
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
  
  // При инициализации устанавливаем размер команды из турнира, если он есть
  useEffect(() => {
    if (tournament && tournament.team_size) {
      setTeamSize(tournament.team_size.toString());
    }
    
    // Сохраняем оригинальный список участников
    if (participants && participants.length > 0) {
      setOriginalParticipants(participants);
    }
  }, [tournament, participants]);

  // Функция для обновления размера команды на сервере
  const updateTeamSize = async (newSize) => {
    if (!tournament || !tournament.id || !isAdminOrCreator) return;
    
    try {
      const token = localStorage.getItem('token');
      await api.patch(`/api/tournaments/${tournament.id}/team-size`, {
        teamSize: parseInt(newSize, 10)
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (toast) {
        toast.success(`Размер команды изменен на ${newSize}`);
      }
      
      // Обновляем данные турнира
      if (onTeamsUpdated) {
        onTeamsUpdated();
      }
    } catch (error) {
      console.error('Ошибка при обновлении размера команды:', error);
      if (toast) {
        toast.error(error.response?.data?.error || 'Не удалось обновить размер команды');
      }
    }
  };

  // Функция для формирования команд
  const handleFormTeams = async () => {
    if (!tournament || !tournament.id) return;
    
    // Сохраняем текущий список участников перед формированием команд
    if (participants && participants.length > 0) {
      setOriginalParticipants([...participants]);
    }
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await api.post(`/api/tournaments/${tournament.id}/form-teams`, {
        ratingType: ratingType,
        teamSize: parseInt(teamSize, 10)
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data) {
        if (response.data.teams) {
          setMixedTeams(response.data.teams);
        }
        
        if (onTeamsGenerated) {
          onTeamsGenerated(response.data.teams || []);
        }
        
        // Обновляем данные турнира
        if (onTeamsUpdated) {
          onTeamsUpdated();
        }
        
        if (toast) {
          toast.success('Команды успешно сформированы');
        }
      }
    } catch (error) {
      console.error('Ошибка при формировании команд:', error);
      if (toast) {
        toast.error(error.response?.data?.error || 'Не удалось сформировать команды');
      }
    } finally {
      setLoading(false);
    }
  };

  // Проверяем, есть ли уже сформированные команды в данных турнира
  const teamsExist = tournament?.teams && tournament.teams.length > 0;
  const teamsList = teamsExist ? tournament.teams : mixedTeams;
  
  // Определяем, какой список участников отображать
  const displayParticipants = originalParticipants.length > 0 ? originalParticipants : participants;

  return (
    <div className="team-generator">
      {tournament?.format === 'mix' && !tournament?.bracket && (
        <div className="mix-settings">
          {/* Блок изначальных зарегистрированных игроков - показываем всегда */}
          <div className="original-participants-section">
            <h3>Зарегистрированные игроки ({displayParticipants?.length || 0})</h3>
            <div className="mix-players-list">
              {displayParticipants && displayParticipants.length > 0 ? (
                <div className="participants-grid">
                  {displayParticipants.map((participant) => (
                    <div key={participant?.id || `participant-${Math.random()}`} className="participant-card">
                      <div className="participant-info">
                        <div className="participant-avatar">
                          {participant && participant.avatar_url ? (
                            <img 
                              src={ensureHttps(participant.avatar_url)} 
                              alt={((participant && participant.name) || '?').charAt(0)} 
                              onError={(e) => {e.target.src = '/default-avatar.png'}}
                            />
                          ) : (
                            <div className="avatar-placeholder">
                              {((participant && participant.name) || '?').charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        {participant && participant.user_id ? (
                          <Link 
                            to={`/user/${participant.user_id}`} 
                            className="participant-name"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {participant.name || 'Участник'}
                          </Link>
                        ) : (
                          <span className="participant-name">{participant?.name || 'Участник'}</span>
                        )}
                        {isAdminOrCreator && participant && participant.id && !teamsExist && (
                          <button
                            onClick={() => onRemoveParticipant && onRemoveParticipant(participant.id)}
                            className="remove-participant"
                            title="Удалить участника"
                          >
                            ✖
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-participants">Нет зарегистрированных игроков</p>
              )}
            </div>
          </div>

          {isAdminOrCreator && (
            <>
              <h3>Настройки микса</h3>
              <div className="mix-controls-row">
                <div className="mix-form-group">
                  <label>Размер команды:</label>
                  <select
                    value={teamSize}
                    onChange={(e) => {
                      const newSize = e.target.value;
                      setTeamSize(newSize);
                      updateTeamSize(newSize);
                    }}
                    disabled={teamsExist || loading}
                  >
                    <option value="2">2 игрока</option>
                    <option value="5">5 игроков</option>
                  </select>
                </div>
              </div>
              
              <div className="mix-controls-row">
                <div className="mix-form-group">
                  <label>Миксовать по рейтингу:</label>
                  <select
                    value={ratingType}
                    onChange={(e) => setRatingType(e.target.value)}
                  >
                    <option value="faceit">FACEit</option>
                    <option value="premier">Steam Premier</option>
                  </select>
                
                  {tournament.participant_type === 'solo' && (!teamsExist || teamsList.length === 0) && (
                    <button 
                      onClick={handleFormTeams} 
                      className="form-teams-button"
                      disabled={loading}
                    >
                      {loading ? 'Создание команд...' : 'Сформировать команды из участников'}
                    </button>
                  )}
                  {tournament.participant_type === 'solo' && (teamsExist || teamsList.length > 0) && tournament.status === 'pending' && (
                    <button 
                      onClick={handleFormTeams} 
                      className="reformate-teams-button"
                      disabled={loading}
                    >
                      {loading ? 'Пересоздание команд...' : 'Переформировать команды'}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
          
          {/* Секция сформированных команд - показываем если они есть */}
          {(teamsExist || teamsList.length > 0) && (
            <div className="mixed-teams">
              <h3>Сформированные команды</h3>
              <div className="mixed-teams-grid">
                {teamsList.map(team => (
                  <div key={team.id || `team-${Math.random()}`} className="team-card">
                    <div className="team-header">
                      <h4>{team?.name || 'Команда'}</h4>
                    </div>
                    
                    <div className="team-members-list">
                      {team.members && team.members.map(member => (
                        <div 
                          key={member?.participant_id || member?.user_id || member?.id || `member-${Math.random()}`} 
                          className="team-member-card"
                        >
                          <div className="member-avatar">
                            {member && member.avatar_url ? (
                              <img 
                                src={ensureHttps(member.avatar_url)} 
                                alt={((member && member.name) || '?').charAt(0)} 
                                onError={(e) => {e.target.src = '/default-avatar.png'}}
                              />
                            ) : (
                              <div className="avatar-placeholder">
                                {((member && member.name) || '?').charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="member-info">
                            {member && member.user_id ? (
                              <Link 
                                to={`/user/${member.user_id}`} 
                                className="member-name"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {member.name || 'Участник'}
                              </Link>
                            ) : (
                              <span className="member-name">
                                {member?.name || 'Участник'}
                              </span>
                            )}
                            {member.faceit_rating && (
                              <span className="member-rating faceit">
                                FACEit: {member.faceit_rating}
                              </span>
                            )}
                            {member.premier_rank && (
                              <span className="member-rating premier">
                                Premier: {member.premier_rank}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TeamGenerator; 