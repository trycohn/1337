import React, { useState, useEffect } from 'react';
import '../styles/modal-system.css'; // 🔧 ИСПРАВЛЕН ПУТЬ К CSS

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
        <div className="modal-system-overlay" onClick={onClose}>
            <div 
                className="modal-system-container modal-system-modal-large" 
                onClick={(e) => e.stopPropagation()}
                style={!isMobile ? { maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' } : {}}
            >
                {/* === ЗАГОЛОВОК МОДАЛЬНОГО ОКНА === */}
                <div className="modal-system-header">
                    <div>
                        <h2 className="modal-system-title">
                            Фильтр турниров
                            {getActiveFiltersCount() > 0 && (
                                <span className="modal-system-badge modal-system-badge-primary modal-system-ml-10">
                                    {getActiveFiltersCount()} активных
                                </span>
                            )}
                        </h2>
                        <p className="modal-system-subtitle">
                            Настройте параметры для поиска подходящих турниров
                        </p>
                    </div>
                    <button 
                        className="modal-system-close" 
                        onClick={onClose}
                        aria-label="Закрыть фильтр"
                    >
                        ✕
                    </button>
                </div>

                {/* === ТЕЛО МОДАЛЬНОГО ОКНА === */}
                <div className="modal-system-body">
                    
                    {/* 🎮 ДИСЦИПЛИНА */}
                    <div className="modal-system-section">
                        <h3 className="modal-system-section-title">
                            Дисциплина
                            {localFilters.games.length > 0 && (
                                <span className="modal-system-badge modal-system-badge-success modal-system-ml-10">
                                    {localFilters.games.length} выбрано
                                </span>
                            )}
                        </h3>
                        <div className="modal-system-checkbox-grid">
                            {availableGames.map(game => (
                                <label key={game} className="modal-system-checkbox-item">
                                    <input
                                        type="checkbox"
                                        checked={localFilters.games.includes(game)}
                                        onChange={() => handleCheckboxChange('games', game)}
                                        className="modal-system-checkbox"
                                    />
                                    <span className="modal-system-checkbox-label">{game}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* 🏆 ФОРМАТ ТУРНИРА */}
                    <div className="modal-system-section">
                        <h3 className="modal-system-section-title">
                            Формат турнира
                            {localFilters.formats.length > 0 && (
                                <span className="modal-system-badge modal-system-badge-success modal-system-ml-10">
                                    {localFilters.formats.length} выбрано
                                </span>
                            )}
                        </h3>
                        <div className="modal-system-checkbox-grid">
                            {availableFormats.map(format => (
                                <label key={format} className="modal-system-checkbox-item">
                                    <input
                                        type="checkbox"
                                        checked={localFilters.formats.includes(format)}
                                        onChange={() => handleCheckboxChange('formats', format)}
                                        className="modal-system-checkbox"
                                    />
                                    <span className="modal-system-checkbox-label">{format}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* 👥 ТИП УЧАСТНИКОВ */}
                    <div className="modal-system-section">
                        <h3 className="modal-system-section-title">
                            Тип участников
                            {localFilters.participantTypes.length > 0 && (
                                <span className="modal-system-badge modal-system-badge-success modal-system-ml-10">
                                    {localFilters.participantTypes.length} выбрано
                                </span>
                            )}
                        </h3>
                        <div className="modal-system-checkbox-grid">
                            {availableParticipantTypes.map(type => (
                                <label key={type.value} className="modal-system-checkbox-item">
                                    <input
                                        type="checkbox"
                                        checked={localFilters.participantTypes.includes(type.value)}
                                        onChange={() => handleCheckboxChange('participantTypes', type.value)}
                                        className="modal-system-checkbox"
                                    />
                                    <span className="modal-system-checkbox-label">{type.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* 📊 СТАТУС */}
                    <div className="modal-system-section">
                        <h3 className="modal-system-section-title">
                            Статус турнира
                            {localFilters.statuses.length > 0 && (
                                <span className="modal-system-badge modal-system-badge-success modal-system-ml-10">
                                    {localFilters.statuses.length} выбрано
                                </span>
                            )}
                        </h3>
                        <div className="modal-system-checkbox-grid">
                            {availableStatuses.map(status => (
                                <label key={status.value} className="modal-system-checkbox-item">
                                    <input
                                        type="checkbox"
                                        checked={localFilters.statuses.includes(status.value)}
                                        onChange={() => handleCheckboxChange('statuses', status.value)}
                                        className="modal-system-checkbox"
                                    />
                                    <span className="modal-system-checkbox-label">{status.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Скрываем дополнительные фильтры на мобильных */}
                    {!isMobile && (
                        <div className="modal-system-grid-2">
                            {/* 💰 ПРИЗОВОЙ ФОНД */}
                            <div className="modal-system-section">
                            <h3 className="modal-system-section-title">
                                Призовой фонд
                                {localFilters.hasPrizePool !== null && (
                                    <span className="modal-system-badge modal-system-badge-success modal-system-ml-10">
                                        {localFilters.hasPrizePool ? 'Есть' : 'Нет'}
                                    </span>
                                )}
                            </h3>
                            <div className="modal-system-flex-column modal-system-gap-10">
                                <label className="modal-system-checkbox-item">
                                    <input
                                        type="radio"
                                        name="prizePool"
                                        checked={localFilters.hasPrizePool === true}
                                        onChange={() => handlePrizepoolChange(true)}
                                        className="modal-system-checkbox"
                                    />
                                    <span className="modal-system-checkbox-label">Есть</span>
                                </label>
                                <label className="modal-system-checkbox-item">
                                    <input
                                        type="radio"
                                        name="prizePool"
                                        checked={localFilters.hasPrizePool === false}
                                        onChange={() => handlePrizepoolChange(false)}
                                        className="modal-system-checkbox"
                                    />
                                    <span className="modal-system-checkbox-label">Нет</span>
                                </label>
                            </div>
                        </div>
                        </div>
                    )}

                    {/* КОЛИЧЕСТВО УЧАСТНИКОВ - отдельная секция (только десктоп) */}
                    {!isMobile && (
                        <div className="modal-system-section">
                        <h3 className="modal-system-section-title">
                            Количество участников
                            {(localFilters.participantCount.min > 0 || localFilters.participantCount.max < 128) && (
                                <span className="modal-system-badge modal-system-badge-success modal-system-ml-10">
                                    {localFilters.participantCount.min} - {localFilters.participantCount.max}
                                </span>
                            )}
                        </h3>
                        <div className="modal-system-flex-column modal-system-gap-15">
                            {/* Центрированный слайдер 70% ширины */}
                            <div className="modal-system-single-range-slider" style={{ 
                                width: '70%', 
                                margin: '0 auto',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center'
                            }}>
                                <div className="modal-system-range-inputs" style={{ 
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
                                            className="modal-system-input modal-system-input-small"
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
                                            className="modal-system-input modal-system-input-small"
                                            style={{ 
                                                width: '100%',
                                                marginTop: '5px'
                                            }}
                                        />
                                    </label>
                                </div>
                                
                                {/* 🔧 ИСПРАВЛЕННЫЙ двойной слайдер */}
                                <div className="modal-system-dual-range" style={{ 
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
                                
                                <div className="modal-system-range-labels" style={{ 
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
                    {getActiveFiltersCount() > 0 && (
                        <div className="modal-system-section">
                            <div className="modal-system-info modal-system-info-primary">
                                <h4 className="modal-system-bold modal-system-mb-10">
                                    Предварительный просмотр фильтров
                                </h4>
                                <div className="modal-system-flex-wrap modal-system-gap-5">
                                    {localFilters.games.map(game => (
                                        <span key={game} className="modal-system-badge modal-system-badge-primary">
                                            {game}
                                        </span>
                                    ))}
                                    {localFilters.formats.map(format => (
                                        <span key={format} className="modal-system-badge modal-system-badge-primary">
                                            {format}
                                        </span>
                                    ))}
                                    {localFilters.participantTypes.map(type => (
                                        <span key={type} className="modal-system-badge modal-system-badge-primary">
                                            {availableParticipantTypes.find(t => t.value === type)?.label}
                                        </span>
                                    ))}
                                    {localFilters.statuses.map(status => (
                                        <span key={status} className="modal-system-badge modal-system-badge-primary">
                                            {availableStatuses.find(s => s.value === status)?.label}
                                        </span>
                                    ))}
                                    {localFilters.hasPrizePool !== null && (
                                        <span className="modal-system-badge modal-system-badge-primary">
                                            Призовой фонд: {localFilters.hasPrizePool ? 'Есть' : 'Нет'}
                                        </span>
                                    )}
                                    {(localFilters.participantCount.min > 0 || localFilters.participantCount.max < 128) && (
                                        <span className="modal-system-badge modal-system-badge-primary">
                                            {localFilters.participantCount.min}-{localFilters.participantCount.max} участников
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* === ПОДВАЛ МОДАЛЬНОГО ОКНА === */}
                <div className="modal-system-footer modal-system-space-between">
                    <button 
                        className="modal-system-btn"
                        onClick={resetFilters}
                        disabled={getActiveFiltersCount() === 0}
                    >
                        Сбросить все
                    </button>
                    
                    <div className="modal-system-flex modal-system-gap-10">
                        <button 
                            className="modal-system-btn"
                            onClick={onClose}
                        >
                            Отмена
                        </button>
                        <button 
                            className="modal-system-btn modal-system-btn-primary"
                            onClick={applyFilters}
                        >
                            Применить фильтры
                            {getActiveFiltersCount() > 0 && ` (${getActiveFiltersCount()})`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TournamentFilterModal; 