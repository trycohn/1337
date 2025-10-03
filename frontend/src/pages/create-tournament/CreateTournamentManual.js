// frontend/src/pages/create-tournament/CreateTournamentManual.js
// Ручная настройка турнира (для опытных организаторов)
// Миграция из frontend/src/components/CreateTournament.js

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ru } from 'date-fns/locale';
import useLoaderAutomatic from '../../hooks/useLoaderAutomaticHook';
import { useAuth } from '../../context/AuthContext';
import { 
  safeNavigateToTournament, 
  validateApiResponse, 
  handleApiError
} from '../../utils/apiUtils';
import '../../components/CreateTournament.css';
import TournamentProgressBar from '../../components/tournament/TournamentProgressBar';

// Регистрируем русскую локаль
registerLocale('ru', ru);

/**
 * Ручная настройка турнира (старый интерфейс)
 * Для опытных организаторов - все настройки в одной форме
 */
function CreateTournamentManual({ onBack }) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [games, setGames] = useState([]);
  const [cs2Maps, setCs2Maps] = useState([]);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const titleRef = useRef(null);
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    format: '',
    game: '',
    participant_type: 'team',
    team_size: 5,
    max_teams: 16,
    start_date: '',
    prize_pool: '',
    rules: '',
    bracket_type: 'single_elimination',
    mix_rating_type: 'faceit',
    mix_type: 'classic',
    wins_to_win: 4,
    require_faceit_linked: false,
    require_steam_linked: false,
    seeding_type: 'random',
    seeding_config: {},
    lobby_enabled: false,
    lobby_match_format: null,
    selected_maps: [],
    enable_final_format: false, // 🆕 Особый формат финалов
    final_match_format: 'bo3', // 🆕 Формат финальных матчей
    full_double_elimination: false,
    tournament_type: 'open',
    is_series_final: false,
    cs2_mode: '5v5'
  });
  const { runWithLoader } = useLoaderAutomatic();

  const getVerificationStatus = () => {
    if (!user) return { canCreate: false, reason: 'not_logged_in' };
    if (!user.email) return { canCreate: false, reason: 'no_email' };
    if (!user.is_verified) return { canCreate: false, reason: 'not_verified' };
    return { canCreate: true, reason: 'verified' };
  };

  const isCS2Game = (gameName) => {
    if (!gameName) return false;
    const normalizedGame = gameName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return normalizedGame === 'counterstrike2' || 
           normalizedGame === 'cs2' || 
           (gameName.toLowerCase().includes('counter') && gameName.toLowerCase().includes('strike') && gameName.includes('2'));
  };

  useEffect(() => {
    runWithLoader(async () => {
      try {
        const response = await axios.get('/api/tournaments/games');
        setGames(response.data);
        
        const mapsResponse = await axios.get('/api/maps?game=Counter-Strike 2');
        setCs2Maps(mapsResponse.data);
      } catch (error) {
        console.error('Ошибка загрузки игр:', error);
      }
    });
  }, [runWithLoader]);

  const handleCreateTournament = async (e) => {
    e.preventDefault();
    
    const verificationStatus = getVerificationStatus();
    if (!formData.name || !formData.name.trim()) {
      alert('Введите название турнира');
      if (titleRef.current) titleRef.current.focus();
      return;
    }
    if (!verificationStatus.canCreate) {
      if (verificationStatus.reason === 'not_logged_in') {
        alert('Необходима авторизация');
        navigate('/register');
        return;
      } else if (verificationStatus.reason === 'no_email') {
        alert('Для создания турнира необходимо привязать email к аккаунту');
        navigate('/profile');
        return;
      } else if (verificationStatus.reason === 'not_verified') {
        alert('Для создания турнира необходимо подтвердить email');
        navigate('/profile');
        return;
      }
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Необходима авторизация');
      return;
    }

    runWithLoader(async () => {
      try {
        console.log('🚀 Начинаем создание турнира...');
        
        const response = await axios.post(
          '/api/tournaments',
          {
            name: formData.name,
            description: formData.description,
            format: formData.format,
            game: formData.game,
            participant_type: formData.participant_type,
            team_size: formData.team_size,
            max_teams: formData.max_teams,
            start_date: formData.start_date,
            prize_pool: formData.prize_pool,
            rules: formData.rules,
            bracket_type: formData.bracket_type,
            mix_rating_type: formData.format === 'mix' ? formData.mix_rating_type : null,
            mix_type: formData.format === 'mix' ? formData.mix_type : null,
            wins_to_win: formData.format === 'mix' && formData.mix_type === 'full' ? parseInt(formData.wins_to_win || 4, 10) : null,
            require_faceit_linked: formData.format === 'mix' && formData.mix_rating_type === 'faceit' ? !!formData.require_faceit_linked : false,
            require_steam_linked: formData.format === 'mix' && formData.mix_rating_type === 'premier' ? !!formData.require_steam_linked : false,
            seeding_type: formData.seeding_type,
            seeding_config: formData.seeding_config,
            lobby_enabled: isCS2Game(formData.game) ? formData.lobby_enabled : false,
            lobby_match_format: formData.lobby_enabled ? formData.lobby_match_format : null,
            selected_maps: formData.lobby_enabled ? formData.selected_maps : [],
            final_match_format: formData.enable_final_format ? formData.final_match_format : null, // 🆕 Особый формат для финалов
            full_double_elimination: formData.bracket_type === 'double_elimination' ? formData.full_double_elimination : false,
            access_type: (formData.tournament_type === 'closed' || formData.tournament_type === 'hidden') ? 'closed' : 'open',
            is_hidden: formData.tournament_type === 'hidden',
            is_series_final: formData.tournament_type === 'final'
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        console.log('✅ Турнир создан, ответ сервера:', response.data);
        
        const validation = validateApiResponse(response, 'CREATE_TOURNAMENT');
        
        if (!validation.isValid) {
          console.error('❌ Структура ответа API не соответствует ожидаемой:', validation.errors);
          throw new Error(`Некорректная структура ответа сервера: ${validation.errors.join(', ')}`);
        }
        
        const navigationSuccess = safeNavigateToTournament(
          navigate, 
          response, 
          'CREATE_TOURNAMENT',
          (error) => {
            console.error('❌ Ошибка навигации:', error);
            alert('Турнир создан, но возникла ошибка при переходе на страницу турнира');
          }
        );
        
        if (!navigationSuccess) {
          throw new Error('Не удалось перейти на страницу созданного турнира');
        }
        
        console.log('✅ Турнир успешно создан и произведен переход на страницу');
        
      } catch (error) {
        handleApiError(
          error, 
          'Создание турнира',
          (message) => {
            console.error('❌ Обработанная ошибка:', message);
            alert(message);
          }
        );
        
        console.error('❌ Полные детали ошибки:', {
          message: error.message,
          response: error.response?.data,
          stack: error.stack
        });
      }
    });
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'mix_type') {
      setFormData((prev) => {
        const next = { ...prev, mix_type: value };
        if (value === 'full') {
          next.mix_rating_type = 'mixed';
          next.bracket_type = 'swiss';
        }
        return next;
      });
      return;
    }
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleFormatChange = (e) => {
    const format = e.target.value;
    setFormData(prev => {
      const newData = {
        ...prev,
        format,
        team_size: format === 'mix' ? 5 : prev.team_size,
        game: format === 'mix' ? 'counter strike 2' : prev.game,
        participant_type: format === 'mix' ? 'solo' : 'team',
        mix_rating_type: format === 'mix' ? 'faceit' : prev.mix_rating_type,
        seeding_type: 'random',
        seeding_config: {}
      };
      return newData;
    });
  };

  const handleParticipantTypeChange = (e) => {
    const value = e.target.value;
    
    if (value === 'cs2_5v5' || value === 'cs2_2v2') {
      setFormData(prev => ({
        ...prev,
        participant_type: 'team',
        cs2_mode: value === 'cs2_5v5' ? '5v5' : '2v2',
        team_size: value === 'cs2_5v5' ? 5 : 2
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        participant_type: value
      }));
    }
  };

  const handleGameChange = (e) => {
    const selectedGame = e.target.value;
    
    setFormData(prev => {
      const newData = {
        ...prev,
        game: selectedGame,
        participant_type: 'team',
        cs2_mode: isCS2Game(selectedGame) ? '5v5' : prev.cs2_mode,
        team_size: isCS2Game(selectedGame) ? 5 : prev.team_size
      };
      return newData;
    });
  };

  const handleSeedingTypeChange = (e) => {
    const seedingType = e.target.value;
    setFormData(prev => ({
      ...prev,
      seeding_type: seedingType,
      seeding_config: {}
    }));
  };

  const handleTitleInput = useCallback((e) => {
    const text = e.currentTarget.textContent || '';
    setFormData(prev => ({ ...prev, name: text }));
    try {
      const sel = window.getSelection();
      if (!sel) return;
      const range = document.createRange();
      const node = titleRef.current;
      if (!node) return;
      const lastChild = node.lastChild;
      if (lastChild && lastChild.nodeType === Node.TEXT_NODE) {
        range.setStart(lastChild, lastChild.textContent.length);
        range.collapse(true);
      } else {
        range.selectNodeContents(node);
        range.collapse(false);
      }
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (_) {}
  }, []);

  const handleTitleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }, []);

  const handleTitleBlur = useCallback(() => {
    setFormData(prev => ({ ...prev, name: (prev.name || '').trim() }));
    if (titleRef.current && !(formData.name || '').trim()) {
      titleRef.current.textContent = '';
    }
  }, [formData.name]);

  const handleSelectLogoClick = useCallback(() => {
    if (fileInputRef.current) fileInputRef.current.click();
  }, []);

  const handleLogoChange = useCallback((e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
  }, []);

  useEffect(() => {
    if (titleRef.current && (formData.name || '')) {
      titleRef.current.textContent = formData.name;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderVerificationWarning = () => {
    if (authLoading) return null;
    
    const verificationStatus = getVerificationStatus();
    
    if (verificationStatus.canCreate) return null;

    if (verificationStatus.reason === 'not_logged_in') {
      return (
        <div className="verification-warning">
          <div className="warning-content">
            <h3>Необходима авторизация</h3>
            <p>Для создания турнира необходимо войти в систему или зарегистрироваться.</p>
            <div className="warning-actions">
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/register')}
              >
                Войти / Регистрация
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (verificationStatus.reason === 'no_email') {
      return (
        <div className="verification-warning">
          <div className="warning-icon">📧</div>
          <div className="warning-content">
            <h3>Требуется привязка email</h3>
            <p>
              Для создания турниров необходимо привязать email к вашему аккаунту. 
              Это нужно для получения уведомлений и обеспечения безопасности.
            </p>
            <div className="warning-actions">
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/profile')}
              >
                Привязать email в профиле
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (verificationStatus.reason === 'not_verified') {
      return (
        <div className="verification-warning">
          <div className="warning-icon">✉️</div>
          <div className="warning-content">
            <h3>Требуется подтверждение email</h3>
            <p>
              Ваш email <strong>{user.email}</strong> не подтвержден. 
              Для создания турниров необходимо подтвердить ваш email адрес.
            </p>
            <div className="warning-actions">
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/profile')}
              >
                Подтвердить email в профиле
              </button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  if (authLoading) {
    return (
      <div className="create-tournament loading">
        <div className="loading-spinner"></div>
        <p>Проверка авторизации...</p>
      </div>
    );
  }

  const verificationStatus = getVerificationStatus();

  return (
    <section className="create-tournament">
      {/* 🆕 Кнопка возврата к выбору режима */}
      <div style={{ marginBottom: '30px' }}>
        <button 
          className="btn btn-secondary"
          onClick={onBack}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
        >
          ← Назад к выбору режима
        </button>
      </div>

      <div className="create-header">
        <div className="create-header-left">
          <div
            className="editable-title"
            contentEditable
            suppressContentEditableWarning
            dir="ltr"
            spellCheck={false}
            lang="ru"
            inputMode="text"
            autoCapitalize="none"
            autoCorrect="off"
            style={{ direction: 'ltr', unicodeBidi: 'plaintext', writingMode: 'horizontal-tb' }}
            ref={titleRef}
            data-placeholder="Название турнира"
            onInput={handleTitleInput}
            onKeyDown={handleTitleKeyDown}
            onBlur={handleTitleBlur}
          ></div>
          <div className="meta-row">
            <span className="meta-label">Организатор:</span>
            <span className="meta-value">{user?.username || user?.name || '—'}</span>
            <span className="meta-sep"> </span>
            <span className="meta-label">Дисциплина:</span>
            <span className="meta-value">{formData.game ? formData.game : '—'}</span>
          </div>
          <div className="logo-upload-row">
            <button type="button" className="btn btn-secondary" onClick={handleSelectLogoClick}>Загрузить логотип турнира</button>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleLogoChange} className="hidden-file-input" />
            {logoPreview && (
              <div className="logo-preview"><img src={logoPreview} alt="Логотип турнира" /></div>
            )}
          </div>  
        </div>
        <div className="create-header-right">
          <div className="infoblock-stats">
            <div className="infoblock-grid infoblock-top">
              <div className="infoblock-item infoblock-prize">
                <div className="infoblock-label">Призовой фонд</div>
                <div className="infoblock-value">{formData.prize_pool || 'Не указан'}</div>
              </div>
              <div className="infoblock-item infoblock-start">
                <div className="infoblock-label">Старт</div>
                <div className="infoblock-value">{formData.start_date ? new Date(formData.start_date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</div>
              </div>
              <div className="infoblock-item infoblock-status">
                <div className="infoblock-label">Статус</div>
                <div className="infoblock-value">Черновик</div>
              </div>
            </div>
            <div className="infoblock-progress">
              <TournamentProgressBar matches={[]} tournamentStatus={'registration'} tournament={{}} compact={true} />
            </div>
            <div className="infoblock-grid infoblock-bottom">
              <div className="infoblock-item infoblock-format">
                <div className="infoblock-label">Формат</div>
                <div className="infoblock-value">{
                  formData.format === 'mix'
                    ? (() => {
                        const type = (formData.mix_rating_type || 'faceit').toString().toLowerCase();
                        const map = { faceit: 'FACEIT', premier: 'CS Premier', mixed: 'Full random', random: 'Full random' };
                        const suffix = map[type] || 'FACEIT';
                        return `Микс (${suffix})`;
                      })()
                    : (formData.participant_type === 'solo' ? 'Соло' : 'Командный')
                }</div>
              </div>
              <div className="infoblock-item infoblock-participants">
                <div className="infoblock-label">Участники</div>
                <div className="infoblock-value">—</div>
              </div>
              <div className="infoblock-item infoblock-team-size">
                <div className="infoblock-label">В команде</div>
                <div className="infoblock-value">{formData.team_size || 5}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {renderVerificationWarning()}
      
      <form className="create-tournament-form" onSubmit={handleCreateTournament}>
        {/* 1) Основная информация */}
        <div className="form-section main-section">
          <h3 className="section-title">Основная информация</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Формат турнира</label>
              <select
                name="format"
                value={formData.format}
                onChange={handleFormatChange}
                disabled={!verificationStatus.canCreate}
                required
              >
                <option value="">Выберите формат</option>
                <option value="single">Single Elimination</option>
                <option value="double">Double Elimination</option>
                <option value="mix">Mix</option>
              </select>
            </div>

            <div className="form-group">
              <label>Дисциплина</label>
              <select
                name="game"
                value={formData.game}
                onChange={handleGameChange}
                disabled={!verificationStatus.canCreate}
                required
              >
                {formData.format === 'mix' ? (
                  <option value="counter strike 2">Counter Strike 2</option>
                ) : (
                  <>
                    <option value="">Выберите игру</option>
                    {games.map((game) => (
                      <option key={game.id} value={game.name.toLowerCase()}>
                        {game.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            <div className="form-group">
              <label>Призовой фонд</label>
              <input
                type="text"
                name="prize_pool"
                placeholder="Например: 10,000₽"
                value={formData.prize_pool}
                onChange={handleInputChange}
                disabled={!verificationStatus.canCreate}
              />
            </div>

            {formData.format !== 'mix' && (
              <div className="form-group">
                <label>Тип участников</label>
                <select
                  name="participant_type"
                  value={isCS2Game(formData.game) ? `cs2_${formData.cs2_mode}` : formData.participant_type}
                  onChange={handleParticipantTypeChange}
                  disabled={!verificationStatus.canCreate}
                  required
                >
                  <option value="">Выберите тип участников</option>
                  {isCS2Game(formData.game) ? (
                    <>
                      <option value="cs2_5v5">Классический 5х5</option>
                      <option value="cs2_2v2">Wingman 2х2</option>
                    </>
                  ) : (
                    <>
                      <option value="team">Командный</option>
                      <option value="solo">Одиночный</option>
                    </>
                  )}
                </select>
                {isCS2Game(formData.game) && (
                  <small className="form-hint">
                    {formData.cs2_mode === '5v5' && '🏆 Классический формат CS2: команды минимум 5 игроков'}
                    {formData.cs2_mode === '2v2' && '⚡ Wingman формат CS2: команды минимум 2 игрока'}
                  </small>
                )}
              </div>
            )}

            <div className="form-group full-width">
              <label>Дата и время начала</label>
              <DatePicker
                selected={formData.start_date}
                onChange={(date) => setFormData((prev) => ({ ...prev, start_date: date }))}
                showTimeSelect
                dateFormat="dd.MM.yyyy HH:mm"
                timeFormat="HH:mm"
                timeIntervals={15}
                timeCaption="Время"
                placeholderText="Выберите дату и время"
                locale="ru"
                calendarStartDay={1}
                minDate={new Date()}
                className="date-picker-input"
                disabled={!verificationStatus.canCreate}
              />
              <small className="form-hint">Выберите дату и время начала турнира (российское время)</small>
            </div>

            <div className="form-group">
              <label>Тип турнира</label>
              <select
                name="tournament_type"
                value={formData.tournament_type}
                onChange={handleInputChange}
                disabled={!verificationStatus.canCreate}
                required
              >
                <option value="open">Открытый</option>
                <option value="closed">Закрытый</option>
                <option value="hidden">Скрытый</option>
                <option value="final">Финал серии</option>
              </select>
              <small className="form-hint">Открытый — свободное вступление; Закрытый — по приглашению/из отборочных; Скрытый — не показывается в списке, только по приглашению; Финал серии — только победители отборочных.</small>
            </div>

            {/* Тип турнирной сетки */}
            <div className="form-group">
              <label>Тип турнирной сетки</label>
              <select
                name="bracket_type"
                value={formData.bracket_type}
                onChange={handleInputChange}
                disabled={!verificationStatus.canCreate}
                required
              >
                {formData.format === 'mix' && formData.mix_type === 'full' && (
                  <option value="swiss">Швейцарка</option>
                )}
                <option value="single_elimination">Single Elimination</option>
                <option value="double_elimination">Double Elimination</option>
              </select>
              <small className="form-hint">
                {formData.bracket_type === 'single_elimination' && 'Классическая система на выбывание — проигравший исключается'}
                {formData.bracket_type === 'double_elimination' && 'Система двойного выбывания — можно проиграть один раз'}
                {formData.bracket_type === 'swiss' && 'Швейцарская система — несколько туров без немедленного выбывания'}
              </small>
            </div>

            {isCS2Game(formData.game) && (
              <div className="form-group full-width">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="lobby_enabled"
                    checked={formData.lobby_enabled}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      lobby_enabled: e.target.checked,
                      selected_maps: e.target.checked ? cs2Maps.map(m => m.name) : []
                    }))}
                    disabled={!verificationStatus.canCreate}
                  />
                  <span>Включить лобби матча для выбора карт</span>
                </label>
                <small className="form-hint">Участники смогут выбирать и банить карты перед началом матча</small>

                {formData.lobby_enabled && (
                  <>
                    <div className="form-group">
                      <label>Формат матчей по умолчанию</label>
                      <select
                        name="lobby_match_format"
                        value={formData.lobby_match_format || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          lobby_match_format: e.target.value || null
                        }))}
                        disabled={!verificationStatus.canCreate}
                      >
                        <option value="">Выбор в лобби</option>
                        <option value="bo1">Best of 1</option>
                        <option value="bo3">Best of 3</option>
                        <option value="bo5">Best of 5</option>
                      </select>
                      <small className="form-hint">Формат применяется ко всем матчам, кроме финальных (если задан особый формат финала)</small>
                    </div>

                    {/* 🆕 Особый формат для финала */}
                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          name="enable_final_format"
                          checked={formData.enable_final_format}
                          onChange={handleInputChange}
                          disabled={!verificationStatus.canCreate}
                        />
                        <span>Особый формат матчей финала</span>
                      </label>
                      <small className="form-hint">Позволяет задать отдельный формат для финальных матчей (финал, полуфинал, гранд-финал)</small>
                    </div>

                    {formData.enable_final_format && (
                      <div className="form-group" style={{ marginLeft: '30px', paddingLeft: '15px', borderLeft: '2px solid #ff0000' }}>
                        <label>Формат финальных матчей</label>
                        <select
                          name="final_match_format"
                          value={formData.final_match_format || 'bo3'}
                          onChange={handleInputChange}
                          disabled={!verificationStatus.canCreate}
                        >
                          <option value="bo1">Best of 1</option>
                          <option value="bo3">Best of 3</option>
                          <option value="bo5">Best of 5</option>
                        </select>
                        <small className="form-hint">Этот формат будет применяться к финалу, полуфиналам и гранд-финалу</small>
                      </div>
                    )}

                    <div className="form-group">
                      <label>Карты турнира (выберите 7 карт)</label>
                      <div className="maps-selection">
                        {cs2Maps.map(map => (
                          <label key={map.id} className="map-checkbox">
                            <input
                              type="checkbox"
                              value={map.name}
                              checked={formData.selected_maps.includes(map.name)}
                              onChange={(e) => {
                                const mapName = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  selected_maps: e.target.checked
                                    ? [...prev.selected_maps, mapName]
                                    : prev.selected_maps.filter(m => m !== mapName)
                                }));
                              }}
                              disabled={!verificationStatus.canCreate}
                            />
                            <span>{map.display_name || map.name.replace('de_', '').charAt(0).toUpperCase() + map.name.replace('de_', '').slice(1)}</span>
                          </label>
                        ))}
                      </div>
                      {formData.lobby_enabled && formData.selected_maps.length !== 7 && (
                        <small className="form-error">Необходимо выбрать ровно 7 карт (выбрано: {formData.selected_maps.length})</small>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 2) Настройки MIX турнира */}
        {formData.format === 'mix' && (
          <div className="form-section">
            <h3 className="section-title">Настройки MIX турнира</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Игроков в команде</label>
                <input
                  type="number"
                  name="team_size"
                  value={formData.team_size}
                  onChange={handleInputChange}
                  min="2"
                  max="10"
                  disabled={!verificationStatus.canCreate}
                  required
                />
              </div>
              <div className="form-group">
                <label>Тип Микса</label>
                <select
                  name="mix_type"
                  value={formData.mix_type}
                  onChange={handleInputChange}
                  disabled={!verificationStatus.canCreate}
                  required
                >
                  <option value="classic">Классический МИКС (однократно перед стартом)</option>
                  <option value="full">Фулл МИКС (после каждого тура)</option>
                </select>
                <small className="form-hint">
                  {formData.mix_type === 'classic' && 'Команды формируются один раз перед стартом турнира'}
                  {formData.mix_type === 'full' && 'Команды пересобираются после каждого завершенного тура'}
                </small>
              </div>
              {formData.mix_type === 'full' && (
                <div className="form-group">
                  <label>Минимальное число раундов (до победы)</label>
                  <input
                    type="number"
                    name="wins_to_win"
                    value={formData.wins_to_win}
                    onChange={handleInputChange}
                    min="1"
                    max="20"
                    disabled={!verificationStatus.canCreate}
                    required
                  />
                  <small className="form-hint">Используется в Full Mix для отбора финалистов и доп. раундов</small>
                </div>
              )}
              <div className="form-group">
                <label>Формирование команд</label>
                <select
                  name="mix_rating_type"
                  value={formData.mix_rating_type}
                  onChange={handleInputChange}
                  disabled={!verificationStatus.canCreate}
                  required
                >
                  {formData.mix_type === 'full' ? (
                    <>
                      <option value="mixed">Случайное формирование без учета рейтинга</option>
                      <option value="faceit">Формирование на основе рейтинга</option>
                    </>
                  ) : (
                    <>
                      <option value="faceit">Формирование на основе рейтинга</option>
                      <option value="mixed">Случайное формирование без учета рейтинга</option>
                    </>
                  )}
                </select>
                <small className="form-hint">
                  {formData.mix_rating_type === 'faceit' && 'Команды формируются на основе рейтинга участников (FACEIT/Premier)'}
                  {formData.mix_rating_type === 'mixed' && 'Команды формируются случайно, рейтинг не учитывается'}
                </small>
              </div>
              {formData.mix_rating_type === 'faceit' && (
                <div className="form-group full-width">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="require_faceit_linked"
                      checked={formData.require_faceit_linked}
                      onChange={handleInputChange}
                      disabled={!verificationStatus.canCreate}
                    />
                    <span className="checkbox-text">Требовать привязки FACEIT аккаунта</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3) Дополнительные настройки */}
        <div className="form-section additional-section">
          <h3 className="section-title">Дополнительные настройки</h3>
          <div className="form-grid single-column">
            <div className="form-group">
              <label>Описание турнира</label>
              <textarea
                name="description"
                placeholder="Краткое описание турнира..."
                value={formData.description}
                onChange={handleInputChange}
                rows="4"
                disabled={!verificationStatus.canCreate}
              />
            </div>
            <div className="form-group">
              <label>Правила</label>
              <textarea
                name="rules"
                placeholder="Основные правила и условия участия..."
                value={formData.rules}
                onChange={handleInputChange}
                rows="5"
                disabled={!verificationStatus.canCreate}
              />
            </div>
          </div>
        </div>

        <div className="form-buttons">
          <button 
            type="submit"
            disabled={!verificationStatus.canCreate}
            className={`btn btn-primary ${!verificationStatus.canCreate ? 'disabled' : ''}`}
          >
            {verificationStatus.canCreate ? 'Создать турнир' : 'Требуется верификация'}
          </button>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={onBack}
          >
            Отмена
          </button>
        </div>
      </form>
    </section>
  );
}

export default CreateTournamentManual;

