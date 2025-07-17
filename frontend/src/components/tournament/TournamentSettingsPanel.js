/**
 * TournamentSettingsPanel v1.0.0 - Панель управления настройками турнира
 * 
 * @version 1.0.0
 * @updated 2025-01-25
 * @author 1337 Community Development Team
 * @purpose Управление настройками активных турниров для создателей
 * @features Изменение дисциплины, формата, типа рейтинга, даты старта
 */

import React, { useState } from 'react';
import './TournamentSettingsPanel.css';

const TournamentSettingsPanel = ({
    tournament,
    isLoading,
    isCreator,
    onUpdateSetting
}) => {
    const [editingField, setEditingField] = useState(null);
    const [newValues, setNewValues] = useState({});
    const [fieldLoading, setFieldLoading] = useState({});

    // 🎮 Список доступных игр (можно расширить)
    const availableGames = [
        'Counter-Strike 2',
        'CS2',
        'Dota 2',
        'Valorant',
        'League of Legends',
        'Apex Legends',
        'Rocket League',
        'Overwatch 2'
    ];

    // 🏆 Список форматов турниров
    const tournamentFormats = [
        { value: 'single_elimination', label: 'Single Elimination' },
        { value: 'double_elimination', label: 'Double Elimination' },
        { value: 'mix', label: 'Микс-турнир' }
    ];

    // 🎯 Типы турнирной сетки
    const bracketTypes = [
        { value: 'single_elimination', label: 'Single Elimination' },
        { value: 'double_elimination', label: 'Double Elimination' }
    ];

    // 🎯 Типы рейтинга для микс-турниров
    const ratingTypes = [
        { value: 'faceit', label: 'FACEIT ELO' },
        { value: 'premier', label: 'CS2 Premier' },
        { value: 'mixed', label: 'Случайный микс' }
    ];

    // 🆕 Размеры команд для микс-турниров
    const teamSizes = [
        { value: 2, label: '2 игрока' },
        { value: 5, label: '5 игроков' }
    ];

    const handleEdit = (field) => {
        setEditingField(field);
        setNewValues({
            ...newValues,
            [field]: tournament[field] || ''
        });
    };

    const handleCancel = () => {
        setEditingField(null);
        setNewValues({});
    };

    const handleSave = async (field) => {
        const value = newValues[field];
        
        if (!value || value.trim() === '') {
            alert('Значение не может быть пустым');
            return;
        }

        setFieldLoading({ ...fieldLoading, [field]: true });

        try {
            await onUpdateSetting(field, value);
            setEditingField(null);
            setNewValues({});
        } catch (error) {
            console.error('Ошибка обновления настройки:', error);
            alert('Ошибка обновления: ' + (error.message || 'Неизвестная ошибка'));
        } finally {
            setFieldLoading({ ...fieldLoading, [field]: false });
        }
    };

    const handleDateChange = (value) => {
        setNewValues({
            ...newValues,
            start_date: value
        });
    };

    // Форматирование даты для input type="datetime-local"
    const formatDateForInput = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    // Проверка возможности изменения настроек
    const canEdit = tournament?.status === 'active' && !isLoading;
    
    // 🔧 ИСПРАВЛЕНО: Проверка прав для изменения типа сетки (только создатель)
    const canEditBracketType = canEdit && isCreator;

    // 🎮 Функция для определения игры CS2
    const isCS2Game = (gameName) => {
        if (!gameName) return false;
        const normalizedGame = gameName.toLowerCase().replace(/[^a-z0-9]/g, '');
        return normalizedGame === 'counterstrike2' || 
               normalizedGame === 'cs2' || 
               (gameName.toLowerCase().includes('counter') && gameName.toLowerCase().includes('strike') && gameName.includes('2'));
    };

    return (
        <div className="tournament-settings-panel">
            <div className="section-header">
                <h4>⚙️ Настройки турнира</h4>
                <div className="settings-info">
                    <span className="info-text">Доступно только для активных турниров</span>
                </div>
            </div>

            <div className="settings-grid">
                {/* 🎮 ДИСЦИПЛИНА ТУРНИРА */}
                <div className="setting-item">
                    <div className="setting-label">
                        <span className="label-icon">🎮</span>
                        <span>Дисциплина</span>
                    </div>
                    <div className="setting-content">
                        {editingField === 'game' ? (
                            <div className="edit-field">
                                <select
                                    value={newValues.game || tournament.game}
                                    onChange={(e) => setNewValues({ ...newValues, game: e.target.value })}
                                    className="setting-select"
                                    disabled={fieldLoading.game}
                                >
                                    {availableGames.map(game => (
                                        <option key={game} value={game}>{game}</option>
                                    ))}
                                </select>
                                <div className="edit-actions">
                                    <button 
                                        className="save-btn"
                                        onClick={() => handleSave('game')}
                                        disabled={fieldLoading.game}
                                    >
                                        {fieldLoading.game ? '⏳' : '✅'}
                                    </button>
                                    <button 
                                        className="cancel-btn"
                                        onClick={handleCancel}
                                        disabled={fieldLoading.game}
                                    >
                                        ❌
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="display-field">
                                <span className="setting-value">{tournament.game}</span>
                                {canEdit && (
                                    <button 
                                        className="edit-btn"
                                        onClick={() => handleEdit('game')}
                                        title="Изменить дисциплину"
                                    >
                                        ✏️
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* 🏆 ФОРМАТ ТУРНИРА */}
                <div className="setting-item">
                    <div className="setting-label">
                        <span className="label-icon">🏆</span>
                        <span>Формат</span>
                    </div>
                    <div className="setting-content">
                        {editingField === 'format' ? (
                            <div className="edit-field">
                                <select
                                    value={newValues.format || tournament.format}
                                    onChange={(e) => setNewValues({ ...newValues, format: e.target.value })}
                                    className="setting-select"
                                    disabled={fieldLoading.format}
                                >
                                    {tournamentFormats.map(format => (
                                        <option key={format.value} value={format.value}>
                                            {format.label}
                                        </option>
                                    ))}
                                </select>
                                <div className="edit-actions">
                                    <button 
                                        className="save-btn"
                                        onClick={() => handleSave('format')}
                                        disabled={fieldLoading.format}
                                    >
                                        {fieldLoading.format ? '⏳' : '✅'}
                                    </button>
                                    <button 
                                        className="cancel-btn"
                                        onClick={handleCancel}
                                        disabled={fieldLoading.format}
                                    >
                                        ❌
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="display-field">
                                <span className="setting-value">
                                    {tournamentFormats.find(f => f.value === tournament.format)?.label || tournament.format}
                                </span>
                                {canEdit && (
                                    <button 
                                        className="edit-btn"
                                        onClick={() => handleEdit('format')}
                                        title="Изменить формат"
                                    >
                                        ✏️
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* 🎯 ТИП ТУРНИРНОЙ СЕТКИ */}
                <div className="setting-item">
                    <div className="setting-label">
                        <span className="label-icon">🎯</span>
                        <span>Тип сетки</span>
                    </div>
                    <div className="setting-content">
                        {editingField === 'bracket_type' ? (
                            <div className="edit-field">
                                <select
                                    value={newValues.bracket_type || tournament.bracket_type || 'single_elimination'}
                                    onChange={(e) => setNewValues({ ...newValues, bracket_type: e.target.value })}
                                    className="setting-select"
                                    disabled={fieldLoading.bracket_type}
                                >
                                    {bracketTypes.map(type => (
                                        <option key={type.value} value={type.value}>
                                            {type.label}
                                        </option>
                                    ))}
                                </select>
                                <div className="edit-actions">
                                    <button 
                                        className="save-btn"
                                        onClick={() => handleSave('bracket_type')}
                                        disabled={fieldLoading.bracket_type}
                                    >
                                        {fieldLoading.bracket_type ? '⏳' : '✅'}
                                    </button>
                                    <button 
                                        className="cancel-btn"
                                        onClick={handleCancel}
                                        disabled={fieldLoading.bracket_type}
                                    >
                                        ❌
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="display-field">
                                <span className="setting-value">
                                    {bracketTypes.find(t => t.value === tournament.bracket_type)?.label || 'Single Elimination'}
                                </span>
                                {canEditBracketType && (
                                    <button 
                                        className="edit-btn"
                                        onClick={() => handleEdit('bracket_type')}
                                        title="Изменить тип сетки (только создатель)"
                                    >
                                        ✏️
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* 🎯 ТИП РЕЙТИНГА (только для микс-турниров) */}
                {tournament.format === 'mix' && (
                    <div className="setting-item">
                        <div className="setting-label">
                            <span className="label-icon">🎯</span>
                            <span>Тип рейтинга</span>
                        </div>
                        <div className="setting-content">
                            {editingField === 'mix_rating_type' ? (
                                <div className="edit-field">
                                    <select
                                        value={newValues.mix_rating_type || tournament.mix_rating_type || 'faceit'}
                                        onChange={(e) => setNewValues({ ...newValues, mix_rating_type: e.target.value })}
                                        className="setting-select"
                                        disabled={fieldLoading.mix_rating_type}
                                    >
                                        {ratingTypes.map(type => (
                                            <option key={type.value} value={type.value}>
                                                {type.label}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="edit-actions">
                                        <button 
                                            className="save-btn"
                                            onClick={() => handleSave('mix_rating_type')}
                                            disabled={fieldLoading.mix_rating_type}
                                        >
                                            {fieldLoading.mix_rating_type ? '⏳' : '✅'}
                                        </button>
                                        <button 
                                            className="cancel-btn"
                                            onClick={handleCancel}
                                            disabled={fieldLoading.mix_rating_type}
                                        >
                                            ❌
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="display-field">
                                    <span className="setting-value">
                                        {ratingTypes.find(t => t.value === tournament.mix_rating_type)?.label || 'FACEIT ELO'}
                                    </span>
                                    {canEdit && (
                                        <button 
                                            className="edit-btn"
                                            onClick={() => handleEdit('mix_rating_type')}
                                            title="Изменить тип рейтинга"
                                        >
                                            ✏️
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 🆕 РАЗМЕР КОМАНДЫ (только для микс-турниров и только для создателя) */}
                {tournament.format === 'mix' && isCreator && (
                    <div className="setting-item">
                        <div className="setting-label">
                            <span className="label-icon">👥</span>
                            <span>Размер команды</span>
                        </div>
                        <div className="setting-content">
                            {editingField === 'team_size' ? (
                                <div className="edit-field">
                                    <select
                                        value={newValues.team_size || tournament.team_size || 5}
                                        onChange={(e) => setNewValues({ ...newValues, team_size: parseInt(e.target.value) })}
                                        className="setting-select"
                                        disabled={fieldLoading.team_size}
                                    >
                                        {teamSizes.map(size => (
                                            <option key={size.value} value={size.value}>
                                                {size.label}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="edit-actions">
                                        <button 
                                            className="save-btn"
                                            onClick={() => handleSave('team_size')}
                                            disabled={fieldLoading.team_size}
                                        >
                                            {fieldLoading.team_size ? '⏳' : '✅'}
                                        </button>
                                        <button 
                                            className="cancel-btn"
                                            onClick={handleCancel}
                                            disabled={fieldLoading.team_size}
                                        >
                                            ❌
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="display-field">
                                    <span className="setting-value">
                                        {teamSizes.find(s => s.value === tournament.team_size)?.label || '5 игроков'}
                                    </span>
                                    {canEdit && (
                                        <button 
                                            className="edit-btn"
                                            onClick={() => handleEdit('team_size')}
                                            title="Изменить размер команды (только создатель)"
                                        >
                                            ✏️
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 📅 ДАТА СТАРТА */}
                <div className="setting-item">
                    <div className="setting-label">
                        <span className="label-icon">📅</span>
                        <span>Дата старта</span>
                    </div>
                    <div className="setting-content">
                        {editingField === 'start_date' ? (
                            <div className="edit-field">
                                <input
                                    type="datetime-local"
                                    value={formatDateForInput(newValues.start_date || tournament.start_date)}
                                    onChange={(e) => handleDateChange(e.target.value)}
                                    className="setting-input"
                                    disabled={fieldLoading.start_date}
                                />
                                <div className="edit-actions">
                                    <button 
                                        className="save-btn"
                                        onClick={() => handleSave('start_date')}
                                        disabled={fieldLoading.start_date}
                                    >
                                        {fieldLoading.start_date ? '⏳' : '✅'}
                                    </button>
                                    <button 
                                        className="cancel-btn"
                                        onClick={handleCancel}
                                        disabled={fieldLoading.start_date}
                                    >
                                        ❌
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="display-field">
                                <span className="setting-value">
                                    {tournament.start_date 
                                        ? new Date(tournament.start_date).toLocaleString('ru-RU')
                                        : 'Не установлена'
                                    }
                                </span>
                                {canEdit && (
                                    <button 
                                        className="edit-btn"
                                        onClick={() => handleEdit('start_date')}
                                        title="Изменить дату старта"
                                    >
                                        ✏️
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* 🎮 НАСТРОЙКИ ЛОББИ (только для CS2) */}
                {isCS2Game(tournament.game) && (
                    <div className="setting-item">
                        <div className="setting-label">
                            <span className="label-icon">🎮</span>
                            <span>Лобби матча</span>
                        </div>
                        <div className="setting-content">
                            {editingField === 'lobby_enabled' ? (
                                <div className="edit-field">
                                    <select
                                        value={newValues.lobby_enabled || tournament.lobby_enabled || false}
                                        onChange={(e) => setNewValues({ ...newValues, lobby_enabled: e.target.value === 'true' })}
                                        className="setting-select"
                                        disabled={fieldLoading.lobby_enabled}
                                    >
                                        <option value="false">Выключено</option>
                                        <option value="true">Включено</option>
                                    </select>
                                    <div className="edit-actions">
                                        <button 
                                            className="save-btn"
                                            onClick={() => handleSave('lobby_enabled')}
                                            disabled={fieldLoading.lobby_enabled}
                                        >
                                            {fieldLoading.lobby_enabled ? '⏳' : '✅'}
                                        </button>
                                        <button 
                                            className="cancel-btn"
                                            onClick={handleCancel}
                                            disabled={fieldLoading.lobby_enabled}
                                        >
                                            ❌
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="display-field">
                                    <span className="setting-value">
                                        {tournament.lobby_enabled ? 'Включено' : 'Выключено'}
                                    </span>
                                    {canEdit && (
                                        <button 
                                            className="edit-btn"
                                            onClick={() => handleEdit('lobby_enabled')}
                                            title="Изменить настройки лобби"
                                        >
                                            ✏️
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ПРЕДУПРЕЖДЕНИЯ */}
            <div className="settings-warnings">
                <div className="warning-message">
                    ⚠️ Некоторые настройки могут быть недоступны при наличии участников или созданной турнирной сетки
                </div>
            </div>
        </div>
    );
};

export default TournamentSettingsPanel; 