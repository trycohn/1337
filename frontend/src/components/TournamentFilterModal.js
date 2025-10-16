import React, { useState, useEffect } from 'react';
import './TournamentFilterModal.css'; // Изолированные стили фильтра турниров

/**
 * 🎯 TournamentFilterModal v1.0 - Расширенная система фильтрации турниров
 * Красивое и функциональное модальное окно для фильтрации списка турниров
 * 
 * @version 1.0 (Использует modal-system)
 * @features Фильтрация по дисциплине, формату, типу участников, статусу, призовому фонду, количеству участников
 */
const TournamentFilterModal = ({
    isOpen,
    onClose,
    filters,
    onApplyFilters,
    tournaments = []
}) => {
    // Определяем мобильное устройство
    const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 768);

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Локальное состояние фильтров (для предварительного просмотра)
    const [localFilters, setLocalFilters] = useState({
        games: [],
        formats: [],
        participantTypes: [],
        statuses: [],
        hasPrizePool: null, // null, true, false
        participantCount: { min: 0, max: 128 }
    });

    // Инициализация локальных фильтров при открытии модального окна
    useEffect(() => {
        if (isOpen) {
            setLocalFilters({
                games: filters.games || [],
                formats: filters.formats || [],
                participantTypes: filters.participantTypes || [],
                statuses: filters.statuses || [],
                hasPrizePool: filters.hasPrizePool || null,
                participantCount: filters.participantCount || { min: 0, max: 128 }
            });
        }
    }, [isOpen, filters]);

    // Получение уникальных значений из турниров
    const getUniqueValues = (field) => {
        const values = [...new Set(tournaments.map(t => t[field]).filter(Boolean))];
        return values.sort();
    };

    // Доступные дисциплины
    const availableGames = getUniqueValues('game').length > 0 
        ? getUniqueValues('game')
        : ['Counter-Strike 2', 'Dota 2', 'Valorant', 'League of Legends', 'CS:GO'];

    // Доступные форматы
    const availableFormats = getUniqueValues('format').length > 0
        ? getUniqueValues('format')
        : ['Single Elimination', 'Double Elimination', 'Round Robin', 'Swiss', 'Mix'];

    // Доступные типы участников
    const availableParticipantTypes = [
        { value: 'any', label: 'Любой' },
        { value: 'solo', label: 'Соло' },
        { value: 'team', label: 'Командный' }
    ];

    // Доступные статусы
    const availableStatuses = [
        { value: 'registration', label: 'Регистрация' },
        { value: 'active', label: 'Активен' },
        { value: 'in_progress', label: 'Идет' },
        { value: 'completed', label: 'Завершен' },
        { value: 'cancelled', label: 'Отменен' }
    ];

    // Обработчики изменения фильтров
    const handleCheckboxChange = (category, value) => {
        setLocalFilters(prev => ({
            ...prev,
            [category]: prev[category].includes(value)
                ? prev[category].filter(item => item !== value)
                : [...prev[category], value]
        }));
    };

    const handlePrizepoolChange = (value) => {
        setLocalFilters(prev => ({
            ...prev,
            hasPrizePool: prev.hasPrizePool === value ? null : value
        }));
    };

    // 🔧 ИСПРАВЛЕННАЯ ФУНКЦИЯ с ограничениями для двойного слайдера
    const handleParticipantCountChange = (type, value) => {
        const numValue = Math.max(0, Math.min(128, parseInt(value) || 0));
        
        setLocalFilters(prev => {
            const newCount = { ...prev.participantCount };
            
            if (type === 'min') {
                // Минимальное значение не может быть больше максимального
                newCount.min = Math.min(numValue, newCount.max);
            } else {
                // Максимальное значение не может быть меньше минимального
                newCount.max = Math.max(numValue, newCount.min);
            }
            
            return {
                ...prev,
                participantCount: newCount
            };
        });
    };

    // Сброс всех фильтров
    const resetFilters = () => {
        setLocalFilters({
            games: [],
            formats: [],
            participantTypes: [],
            statuses: [],
            hasPrizePool: null,
            participantCount: { min: 0, max: 128 }
        });
    };

    // Применение фильтров
    const applyFilters = () => {
        onApplyFilters(localFilters);
        onClose();
    };

    // Подсчет активных фильтров
    const getActiveFiltersCount = () => {
        let count = 0;
        count += localFilters.games.length;
        count += localFilters.formats.length;
        count += localFilters.participantTypes.length;
        count += localFilters.statuses.length;
        if (localFilters.hasPrizePool !== null) count += 1;
        if (localFilters.participantCount.min > 0 || localFilters.participantCount.max < 128) count += 1;
        return count;
    };

    if (!isOpen) return null;

    return (
        <div className="tournament-filter-overlay" onClick={onClose}>
            <div 
                className="tournament-filter-container" 
                onClick={(e) => e.stopPropagation()}
            >
                {/* === ЗАГОЛОВОК МОДАЛЬНОГО ОКНА === */}
                <div className="tournament-filter-header">
                    <div>
                        <h2 className="tournament-filter-title">
                            Фильтр турниров
                            {getActiveFiltersCount() > 0 && (
                                <span className="tournament-filter-badge tournament-filter-badge-primary">
                                    {getActiveFiltersCount()}
                                </span>
                            )}
                        </h2>
                        <p className="tournament-filter-subtitle">
                            Настройте параметры для поиска подходящих турниров
                        </p>
                    </div>
                    <button 
                        className="tournament-filter-close" 
                        onClick={onClose}
                        aria-label="Закрыть фильтр"
                    >
                        ✕
                    </button>
                </div>

                {/* === ТЕЛО МОДАЛЬНОГО ОКНА === */}
                <div className="tournament-filter-body">
                    
                    {/* 🎮 ДИСЦИПЛИНА */}
                    <div className="tournament-filter-section">
                        <h3 className="tournament-filter-section-title">
                            Дисциплина
                            {localFilters.games.length > 0 && (
                                <span className="tournament-filter-badge tournament-filter-badge-success">
                                    {localFilters.games.length} выбрано
                                </span>
                            )}
                        </h3>
                        <div className="tournament-filter-checkbox-grid">
                            {availableGames.map(game => (
                                <label key={game} className="tournament-filter-checkbox-item">
                                    <input
                                        type="checkbox"
                                        checked={localFilters.games.includes(game)}
                                        onChange={() => handleCheckboxChange('games', game)}
                                        className="tournament-filter-checkbox"
                                    />
                                    <span className="tournament-filter-checkbox-label">{game}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* 🏆 ФОРМАТ ТУРНИРА */}
                    <div className="tournament-filter-section">
                        <h3 className="tournament-filter-section-title">
                            Формат турнира
                            {localFilters.formats.length > 0 && (
                                <span className="tournament-filter-badge tournament-filter-badge-success">
                                    {localFilters.formats.length} выбрано
                                </span>
                            )}
                        </h3>
                        <div className="tournament-filter-checkbox-grid">
                            {availableFormats.map(format => (
                                <label key={format} className="tournament-filter-checkbox-item">
                                    <input
                                        type="checkbox"
                                        checked={localFilters.formats.includes(format)}
                                        onChange={() => handleCheckboxChange('formats', format)}
                                        className="tournament-filter-checkbox"
                                    />
                                    <span className="tournament-filter-checkbox-label">{format}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* 👥 ТИП УЧАСТНИКОВ */}
                    <div className="tournament-filter-section">
                        <h3 className="tournament-filter-section-title">
                            Тип участников
                            {localFilters.participantTypes.length > 0 && (
                                <span className="tournament-filter-badge tournament-filter-badge-success">
                                    {localFilters.participantTypes.length} выбрано
                                </span>
                            )}
                        </h3>
                        <div className="tournament-filter-checkbox-grid">
                            {availableParticipantTypes.map(type => (
                                <label key={type.value} className="tournament-filter-checkbox-item">
                                    <input
                                        type="checkbox"
                                        checked={localFilters.participantTypes.includes(type.value)}
                                        onChange={() => handleCheckboxChange('participantTypes', type.value)}
                                        className="tournament-filter-checkbox"
                                    />
                                    <span className="tournament-filter-checkbox-label">{type.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* 📊 СТАТУС */}
                    <div className="tournament-filter-section">
                        <h3 className="tournament-filter-section-title">
                            Статус турнира
                            {localFilters.statuses.length > 0 && (
                                <span className="tournament-filter-badge tournament-filter-badge-success">
                                    {localFilters.statuses.length} выбрано
                                </span>
                            )}
                        </h3>
                        <div className="tournament-filter-checkbox-grid">
                            {availableStatuses.map(status => (
                                <label key={status.value} className="tournament-filter-checkbox-item">
                                    <input
                                        type="checkbox"
                                        checked={localFilters.statuses.includes(status.value)}
                                        onChange={() => handleCheckboxChange('statuses', status.value)}
                                        className="tournament-filter-checkbox"
                                    />
                                    <span className="tournament-filter-checkbox-label">{status.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Скрываем дополнительные фильтры на мобильных */}
                    {!isMobile && (
                        <>
                            {/* 💰 ПРИЗОВОЙ ФОНД */}
                            <div className="tournament-filter-section">
                                <h3 className="tournament-filter-section-title">
                                    Призовой фонд
                                    {localFilters.hasPrizePool !== null && (
                                        <span className="tournament-filter-badge tournament-filter-badge-success">
                                            {localFilters.hasPrizePool ? 'Есть' : 'Нет'}
                                        </span>
                                    )}
                                </h3>
                                <div className="tournament-filter-checkbox-grid">
                                    <label className="tournament-filter-checkbox-item">
                                        <input
                                            type="radio"
                                            name="prizePool"
                                            checked={localFilters.hasPrizePool === true}
                                            onChange={() => handlePrizepoolChange(true)}
                                            className="tournament-filter-checkbox"
                                        />
                                        <span className="tournament-filter-checkbox-label">Есть</span>
                                    </label>
                                    <label className="tournament-filter-checkbox-item">
                                        <input
                                            type="radio"
                                            name="prizePool"
                                            checked={localFilters.hasPrizePool === false}
                                            onChange={() => handlePrizepoolChange(false)}
                                            className="tournament-filter-checkbox"
                                        />
                                        <span className="tournament-filter-checkbox-label">Нет</span>
                                    </label>
                                </div>
                            </div>
                        </>
                    )}

                    {/* КОЛИЧЕСТВО УЧАСТНИКОВ - отдельная секция (только десктоп) */}
                    {!isMobile && (
                        <div className="tournament-filter-section">
                            <h3 className="tournament-filter-section-title">
                                Количество участников
                                {(localFilters.participantCount.min > 0 || localFilters.participantCount.max < 128) && (
                                    <span className="tournament-filter-badge tournament-filter-badge-success">
                                        {localFilters.participantCount.min} - {localFilters.participantCount.max}
                                    </span>
                                )}
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {/* Центрированный слайдер 70% ширины */}
                            <div className="tournament-filter-range-slider" style={{ 
                                width: '70%', 
                                margin: '0 auto',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center'
                            }}>
                                <div className="tournament-filter-range-inputs" style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    marginBottom: '15px',
                                    gap: '20px',
                                    width: '100%'
                                }}>
                                    <label style={{ flex: 1, textAlign: 'center' }}>
                                        От:
                                        <input
                                            type="number"
                                            min="0"
                                            max="128"
                                            value={localFilters.participantCount.min}
                                            onChange={(e) => handleParticipantCountChange('min', e.target.value)}
                                            className="tournament-filter-input tournament-filter-input-small"
                                            style={{ 
                                                width: '100%',
                                                marginTop: '5px'
                                            }}
                                        />
                                    </label>
                                    <label style={{ flex: 1, textAlign: 'center' }}>
                                        До:
                                        <input
                                            type="number"
                                            min="0"
                                            max="128"
                                            value={localFilters.participantCount.max}
                                            onChange={(e) => handleParticipantCountChange('max', e.target.value)}
                                            className="tournament-filter-input tournament-filter-input-small"
                                            style={{ 
                                                width: '100%',
                                                marginTop: '5px'
                                            }}
                                        />
                                    </label>
                                </div>
                                
                                {/* 🔧 ИСПРАВЛЕННЫЙ двойной слайдер */}
                                <div className="tournament-filter-dual-range" style={{ 
                                    position: 'relative', 
                                    width: '100%',
                                    height: '30px',
                                    marginBottom: '10px'
                                }}>
                                    {/* Фоновый трек слайдера */}
                                    <div style={{
                                        position: 'absolute',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        width: '100%',
                                        height: '6px',
                                        background: 'rgba(255, 255, 255, 0.2)',
                                        borderRadius: '3px',
                                        zIndex: 1
                                    }}></div>
                                    
                                    {/* Слайдер минимального значения */}
                                    <input
                                        type="range"
                                        min="0"
                                        max="128"
                                        value={localFilters.participantCount.min}
                                        onChange={(e) => handleParticipantCountChange('min', e.target.value)}
                                        style={{ 
                                            position: 'absolute',
                                            width: '100%',
                                            height: '30px',
                                            background: 'transparent',
                                            outline: 'none',
                                            appearance: 'none',
                                            WebkitAppearance: 'none',
                                            MozAppearance: 'none',
                                            pointerEvents: 'none',
                                            zIndex: localFilters.participantCount.max <= localFilters.participantCount.min ? 3 : 2
                                        }}
                                        className="dual-range-slider-input"
                                    />
                                    
                                    {/* Слайдер максимального значения */}
                                    <input
                                        type="range"
                                        min="0"
                                        max="128"
                                        value={localFilters.participantCount.max}
                                        onChange={(e) => handleParticipantCountChange('max', e.target.value)}
                                        style={{ 
                                            position: 'absolute',
                                            width: '100%',
                                            height: '30px',
                                            background: 'transparent',
                                            outline: 'none',
                                            appearance: 'none',
                                            WebkitAppearance: 'none',
                                            MozAppearance: 'none',
                                            pointerEvents: 'none',
                                            zIndex: localFilters.participantCount.max <= localFilters.participantCount.min ? 2 : 3
                                        }}
                                        className="dual-range-slider-input"
                                    />
                                </div>
                                
                                <div className="tournament-filter-range-labels" style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between',
                                    width: '100%',
                                    fontSize: '12px',
                                    color: 'rgba(255, 255, 255, 0.6)'
                                }}>
                                    <span>0</span>
                                    <span>64</span>
                                    <span>128</span>
                                </div>
                            </div>
                        </div>
                        </div>
                    )}

                    {/* Предварительный просмотр результатов */}
                    {getActiveFiltersCount() > 0 && !isMobile && (
                        <div className="tournament-filter-section">
                            <div style={{ padding: '16px', background: '#111', border: '1px solid #333' }}>
                                <h4 style={{ margin: '0 0 12px 0', fontWeight: 700, color: '#fff' }}>
                                    Предварительный просмотр фильтров
                                </h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {localFilters.games.map(game => (
                                        <span key={game} className="tournament-filter-badge tournament-filter-badge-primary">
                                            {game}
                                        </span>
                                    ))}
                                    {localFilters.formats.map(format => (
                                        <span key={format} className="tournament-filter-badge tournament-filter-badge-primary">
                                            {format}
                                        </span>
                                    ))}
                                    {localFilters.participantTypes.map(type => (
                                        <span key={type} className="tournament-filter-badge tournament-filter-badge-primary">
                                            {availableParticipantTypes.find(t => t.value === type)?.label}
                                        </span>
                                    ))}
                                    {localFilters.statuses.map(status => (
                                        <span key={status} className="tournament-filter-badge tournament-filter-badge-primary">
                                            {availableStatuses.find(s => s.value === status)?.label}
                                        </span>
                                    ))}
                                    {localFilters.hasPrizePool !== null && (
                                        <span className="tournament-filter-badge tournament-filter-badge-primary">
                                            Призовой фонд: {localFilters.hasPrizePool ? 'Есть' : 'Нет'}
                                        </span>
                                    )}
                                    {(localFilters.participantCount.min > 0 || localFilters.participantCount.max < 128) && (
                                        <span className="tournament-filter-badge tournament-filter-badge-primary">
                                            {localFilters.participantCount.min}-{localFilters.participantCount.max} участников
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* === ПОДВАЛ МОДАЛЬНОГО ОКНА === */}
                <div className="tournament-filter-footer">
                    <button 
                        className="btn btn-secondary"
                        onClick={resetFilters}
                        disabled={getActiveFiltersCount() === 0}
                    >
                        Сбросить все
                    </button>
                    
                    <button 
                        className="btn btn-secondary"
                        onClick={onClose}
                    >
                        Отмена
                    </button>
                    
                    <button 
                        className="btn btn-primary"
                        onClick={applyFilters}
                    >
                        Применить
                        {getActiveFiltersCount() > 0 && ` (${getActiveFiltersCount()})`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TournamentFilterModal; 