// frontend/src/components/TournamentsList.js
import { useState, useEffect, useRef } from 'react';
import api from '../axios'; // Импортируем настроенный экземпляр axios
import { Link } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './Home.css';
import TournamentFilterModal from './TournamentFilterModal'; // 🆕 Импорт нового фильтра

function TournamentsList() {
    const [tournaments, setTournaments] = useState([]);
    const [error, setError] = useState(null);
    
    // 🆕 РАСШИРЕННАЯ СИСТЕМА ФИЛЬТРОВ
    const [filters, setFilters] = useState({
        // Старые простые фильтры (для совместимости)
        game: '',
        name: '',
        format: '',
        status: '',
        start_date: null,
        
        // 🆕 Новые расширенные фильтры
        games: [], // Массив выбранных игр
        formats: [], // Массив выбранных форматов
        participantTypes: [], // Массив выбранных типов участников
        statuses: [], // Массив выбранных статусов
        hasPrizePool: null, // null, true, false
        participantCount: { min: 0, max: 128 }
    });

    // 🆕 СИСТЕМА СОРТИРОВКИ
    const [sort, setSort] = useState({ 
        field: 'created_at', // По умолчанию сортируем по дате создания
        direction: 'desc' 
    });
    
    // 🆕 СОСТОЯНИЕ МОДАЛЬНОГО ОКНА ФИЛЬТРА
    const [showFilterModal, setShowFilterModal] = useState(false);
    
    const [activeFilter, setActiveFilter] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [viewMode, setViewMode] = useState(window.innerWidth <= 768 ? 'card' : 'table');
    const filterRefs = {
        name: useRef(null),
        game: useRef(null),
        format: useRef(null),
        status: useRef(null),
        start_date: useRef(null),
    };

    // 🆕 ДОСТУПНЫЕ ВАРИАНТЫ СОРТИРОВКИ
    const sortOptions = [
        { value: 'created_at', label: 'Дата создания' },
        { value: 'start_date', label: 'Дата старта' },
        { value: 'participant_count', label: 'Количество участников' },
        { value: 'prize_pool', label: 'Призовой фонд' },
        { value: 'name', label: 'Название' }
    ];

    useEffect(() => {
        const handleResize = () => {
            const nowMobile = window.innerWidth <= 768;
            setIsMobile(nowMobile);
            if (nowMobile) setViewMode('card');
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const effectiveViewMode = isMobile ? 'card' : viewMode;

    useEffect(() => {
        const fetchTournaments = async () => {
            // Проверяем кеш в localStorage
            const cacheKey = 'tournaments_cache';
            const cacheTimestampKey = 'tournaments_cache_timestamp';
            const cachedTournaments = localStorage.getItem(cacheKey);
            const cacheTimestamp = localStorage.getItem(cacheTimestampKey);
            const cacheValidityPeriod = 5 * 60 * 1000; // 5 минут в миллисекундах
            
            // Если есть валидный кеш (не старше 5 минут), используем его
            if (cachedTournaments && cacheTimestamp) {
                const now = new Date().getTime();
                const timestamp = parseInt(cacheTimestamp, 10);
                
                if (!isNaN(timestamp) && (now - timestamp) < cacheValidityPeriod) {
                    try {
                        const parsedTournaments = JSON.parse(cachedTournaments);
                        if (Array.isArray(parsedTournaments) && parsedTournaments.length > 0) {
                            console.log('Используем кешированные данные о турнирах');
                            setTournaments(parsedTournaments);
                            return;
                        }
                    } catch (parseError) {
                        console.error('Ошибка при разборе кешированных данных о турнирах:', parseError);
                        // Если произошла ошибка при разборе, очищаем кеш
                        localStorage.removeItem(cacheKey);
                        localStorage.removeItem(cacheTimestampKey);
                    }
                } else {
                    // Кеш устарел, очищаем его
                    localStorage.removeItem(cacheKey);
                    localStorage.removeItem(cacheTimestampKey);
                }
            }
            
            // Если нет валидного кеша, делаем запрос к API
            console.log('Загружаем данные о турнирах с сервера...');
            
            try {
                const response = await api.get('/api/tournaments');
                // Проверяем, что response.data — это массив
                if (Array.isArray(response.data)) {
                    // Кешируем результаты в localStorage
                    localStorage.setItem(cacheKey, JSON.stringify(response.data));
                    localStorage.setItem(cacheTimestampKey, new Date().getTime().toString());
                    
                    setTournaments(response.data);
                    console.log('🔍 Tournaments data:', response.data);
                } else {
                    console.error('❌ Ожидался массив турниров, получено:', response.data);
                    setError('Ошибка загрузки турниров: данные не в ожидаемом формате');
                    setTournaments([]);
                }
            } catch (error) {
                console.error('❌ Ошибка получения турниров:', error.response ? error.response.data : error.message);
                setError('Ошибка загрузки турниров');
                setTournaments([]);
                
                // Пробуем использовать данные из кеша, даже если они устаревшие
                try {
                    const oldCache = localStorage.getItem(cacheKey);
                    if (oldCache) {
                        const parsedOldCache = JSON.parse(oldCache);
                        if (Array.isArray(parsedOldCache) && parsedOldCache.length > 0) {
                            console.log('Используем устаревшие кешированные данные о турнирах из-за ошибки API');
                            setTournaments(parsedOldCache);
                            setError('Использованы кешированные данные. Попробуйте обновить страницу позже.');
                        }
                    }
                } catch (cacheError) {
                    console.error('Ошибка при попытке использовать устаревший кеш:', cacheError);
                }
            }
        };
        fetchTournaments();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            // Проверяем, был ли клик вне активного фильтра
            if (activeFilter) {
                console.log('🔧 Click outside check for filter:', activeFilter);
                const currentRef = filterRefs[activeFilter]?.current;
                if (currentRef && !currentRef.contains(event.target)) {
                    console.log('🔧 Closing filter:', activeFilter);
                    setActiveFilter(null);
                } else {
                    console.log('🔧 Click was inside filter area');
                }
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeFilter, filterRefs]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    // 🆕 ОБНОВЛЕННАЯ ФУНКЦИЯ СОРТИРОВКИ
    const handleSort = (field) => {
        setSort((prev) => ({
            field,
            direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    // 🆕 ПРИМЕНЕНИЕ РАСШИРЕННЫХ ФИЛЬТРОВ
    const handleApplyAdvancedFilters = (newFilters) => {
        setFilters(prev => ({
            ...prev,
            ...newFilters
        }));
        console.log('🔍 Применены расширенные фильтры:', newFilters);
    };

    const applyFilter = (field, value) => {
        setFilters((prev) => ({ ...prev, [field]: value }));
        setActiveFilter(null);
    };

    const clearFilter = (field) => {
        setFilters((prev) => ({ ...prev, [field]: field === 'start_date' ? null : '' }));
        setActiveFilter(null);
    };

    // 🆕 УЛУЧШЕННАЯ ФУНКЦИЯ ОЧИСТКИ ВСЕХ ФИЛЬТРОВ
    const clearAllFilters = () => {
        setFilters({
            // Сбрасываем старые фильтры
            game: '',
            name: '',
            format: '',
            status: '',
            start_date: null,
            
            // Сбрасываем новые фильтры
            games: [],
            formats: [],
            participantTypes: [],
            statuses: [],
            hasPrizePool: null,
            participantCount: { min: 0, max: 128 }
        });
        setActiveFilter(null);
        console.log('🗑️ Все фильтры очищены');
    };

    const toggleFilter = (filterName) => {
        console.log('🔧 Toggle filter called:', filterName, 'Current active:', activeFilter);
        const newActiveFilter = activeFilter === filterName ? null : filterName;
        setActiveFilter(newActiveFilter);
    };

    const uniqueValues = (field) => {
        // Возвращаем оригинальные значения, а не в нижнем регистре
        let values = [...new Set(tournaments.map((t) => t[field]).filter(Boolean))].sort();
        
        // Если нет данных, добавляем тестовые значения для проверки
        if (values.length === 0) {
            switch(field) {
                case 'game':
                    values = ['CS:GO', 'Dota 2', 'Valorant'];
                    break;
                case 'format':
                    values = ['Single Elimination', 'Double Elimination', 'Round Robin'];
                    break;
                case 'status':
                    values = ['active', 'in_progress', 'completed'];
                    break;
                default:
                    values = [];
            }
        }
        
        console.log(`Unique values for ${field}:`, values);
        return values;
    };

    // 🆕 УЛУЧШЕННАЯ ПРОВЕРКА АКТИВНЫХ ФИЛЬТРОВ
    const hasActiveFilters = () => {
        // Проверяем старые фильтры
        const hasOldFilters = filters.game !== '' || filters.name !== '' || filters.format !== '' || 
                              filters.status !== '' || filters.start_date !== null;
        
        // Проверяем новые фильтры
        const hasNewFilters = filters.games.length > 0 || filters.formats.length > 0 || 
                              filters.participantTypes.length > 0 || filters.statuses.length > 0 ||
                              filters.hasPrizePool !== null ||
                              filters.participantCount.min > 0 || filters.participantCount.max < 128;
        
        return hasOldFilters || hasNewFilters;
    };

    // 🆕 ПОДСЧЕТ АКТИВНЫХ ФИЛЬТРОВ
    const getActiveFiltersCount = () => {
        let count = 0;
        
        // Старые фильтры
        if (filters.game) count++;
        if (filters.name) count++;
        if (filters.format) count++;
        if (filters.status) count++;
        if (filters.start_date) count++;
        
        // Новые фильтры
        count += filters.games.length;
        count += filters.formats.length;
        count += filters.participantTypes.length;
        count += filters.statuses.length;
        if (filters.hasPrizePool !== null) count++;
        if (filters.participantCount.min > 0 || filters.participantCount.max < 128) count++;
        
        return count;
    };

    // 🆕 УЛУЧШЕННАЯ ЛОГИКА ФИЛЬТРАЦИИ И СОРТИРОВКИ
    const filteredAndSortedTournaments = tournaments
        .filter((tournament) => {
            // Старые фильтры (для совместимости)
            const oldFiltersMatch = (
                (filters.game === '' || tournament.game === filters.game) &&
                (filters.name === '' || tournament.name?.toLowerCase().includes(filters.name.toLowerCase())) &&
                (filters.format === '' || tournament.format === filters.format) &&
                (filters.status === '' || tournament.status === filters.status) &&
                (filters.start_date === null ||
                    new Date(tournament.start_date).toLocaleDateString('ru-RU') ===
                    filters.start_date.toLocaleDateString('ru-RU'))
            );

            // Новые расширенные фильтры
            const gamesMatch = filters.games.length === 0 || filters.games.includes(tournament.game);
            const formatsMatch = filters.formats.length === 0 || filters.formats.includes(tournament.format);
            const participantTypesMatch = filters.participantTypes.length === 0 || filters.participantTypes.includes(tournament.participant_type);
            const statusesMatch = filters.statuses.length === 0 || filters.statuses.includes(tournament.status);
            
            // Фильтр по призовому фонду
            const prizepoolMatch = filters.hasPrizePool === null || 
                (filters.hasPrizePool === true && tournament.prize_pool && tournament.prize_pool > 0) ||
                (filters.hasPrizePool === false && (!tournament.prize_pool || tournament.prize_pool === 0));
            
            // Фильтр по количеству участников
            const participantCountMatch = tournament.participant_count >= filters.participantCount.min && 
                                        tournament.participant_count <= filters.participantCount.max;

            return oldFiltersMatch && gamesMatch && formatsMatch && participantTypesMatch && 
                   statusesMatch && prizepoolMatch && participantCountMatch;
        })
        .sort((a, b) => {
            if (!sort.field) return 0;
            
            let aValue, bValue;
            
            switch (sort.field) {
                case 'participant_count':
                    aValue = a.participant_count || 0;
                    bValue = b.participant_count || 0;
                    return sort.direction === 'asc' ? aValue - bValue : bValue - aValue;
                    
                case 'start_date':
                case 'created_at':
                    aValue = new Date(a[sort.field]);
                    bValue = new Date(b[sort.field]);
                    return sort.direction === 'asc' ? aValue - bValue : bValue - aValue;
                    
                case 'prize_pool':
                    aValue = a.prize_pool || 0;
                    bValue = b.prize_pool || 0;
                    return sort.direction === 'asc' ? aValue - bValue : bValue - aValue;
                    
                case 'name':
                    aValue = (a.name || '').toLowerCase();
                    bValue = (b.name || '').toLowerCase();
                    return sort.direction === 'asc' ? 
                        aValue.localeCompare(bValue) : 
                        bValue.localeCompare(aValue);
                    
                default:
                    return 0;
            }
        });

    // 🆕 ПОЛУЧЕНИЕ ИКОНКИ СОРТИРОВКИ
    const getSortIcon = (field) => {
        if (sort.field !== field) return '↕️';
        return sort.direction === 'asc' ? '▲' : '▼';
    };

    const renderTableView = () => (
        <div>
            {hasActiveFilters() && (
                <div style={{ marginBottom: '16px', textAlign: 'right' }}>
                    <button 
                        onClick={clearAllFilters}
                        className="clear-all-filters-btn"
                    >
                        ✕ Сбросить все фильтры ({getActiveFiltersCount()})
                    </button>
                </div>
            )}
            <table>
                <thead>
                    <tr>
                        <th ref={filterRefs.game} className={filters.game ? 'filtered' : ''}>
                            {activeFilter === 'game' ? (
                                <div className="dropdown" style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: '0',
                                    right: '0',
                                    background: '#1a1a1a',
                                    color: '#ffffff',
                                    border: '1px solid #333333',
                                    borderRadius: '6px',
                                    zIndex: 9999,
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                                    marginTop: '4px',
                                    minWidth: '150px',
                                    whiteSpace: 'nowrap',
                                    display: 'block',
                                    visibility: 'visible'
                                }}>
                                    {filters.game && (
                                        <div
                                            onClick={() => clearFilter('game')}
                                            className="dropdown-item clear-filter"
                                            style={{
                                                padding: '12px 16px',
                                                cursor: 'pointer',
                                                backgroundColor: '#333333',
                                                color: '#ffffff',
                                                borderBottom: '2px solid #444444'
                                            }}
                                        >
                                            ✕ Сбросить фильтр
                                        </div>
                                    )}
                                    {uniqueValues('game').map((value) => (
                                        <div
                                            key={value}
                                            onClick={() => applyFilter('game', value)}
                                            className="dropdown-item"
                                            style={{
                                                padding: '12px 16px',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid #2a2a2a',
                                                backgroundColor: 'transparent',
                                                color: '#ffffff'
                                            }}
                                            onMouseEnter={(e) => e.target.style.backgroundColor = '#2a2a2a'}
                                            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                        >
                                            {value}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <>
                                    Игра{filters.game && ` (${filters.game})`}{' '}
                                    <span className="dropdown-icon" onClick={() => toggleFilter('game')}>
                                        ▼
                                    </span>
                                </>
                            )}
                        </th>
                        <th ref={filterRefs.name} className={filters.name ? 'filtered' : ''}>
                            {activeFilter === 'name' ? (
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <input
                                        name="name"
                                        value={filters.name}
                                        onChange={handleFilterChange}
                                        placeholder="Поиск по названию"
                                        autoFocus
                                        style={{ flex: 1 }}
                                    />
                                    {filters.name && (
                                        <button
                                            onClick={() => clearFilter('name')}
                                            style={{
                                                padding: '4px 8px',
                                                backgroundColor: '#333333',
                                                color: '#ffffff',
                                                border: '1px solid #555555',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '11px'
                                            }}
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <>
                                    Название{filters.name && ` (${filters.name})`}{' '}
                                    <span className="filter-icon" onClick={() => toggleFilter('name')}>
                                        🔍
                                    </span>
                                </>
                            )}
                        </th>
                        <th>
                            Участники{' '}
                            <span className="sort-icon" onClick={() => handleSort('participant_count')}>
                                {sort.field === 'participant_count' && sort.direction === 'asc' ? '▲' : '▼'}
                            </span>
                        </th>
                        <th ref={filterRefs.format} className={filters.format ? 'filtered' : ''}>
                            {activeFilter === 'format' ? (
                                <div className="dropdown" style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: '0',
                                    right: '0',
                                    background: '#1a1a1a',
                                    color: '#ffffff',
                                    border: '1px solid #333333',
                                    borderRadius: '6px',
                                    zIndex: 9999,
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                                    marginTop: '4px',
                                    minWidth: '150px',
                                    whiteSpace: 'nowrap',
                                    display: 'block',
                                    visibility: 'visible'
                                }}>
                                    {filters.format && (
                                        <div
                                            onClick={() => clearFilter('format')}
                                            className="dropdown-item clear-filter"
                                            style={{
                                                padding: '12px 16px',
                                                cursor: 'pointer',
                                                backgroundColor: '#333333',
                                                color: '#ffffff',
                                                borderBottom: '2px solid #444444'
                                            }}
                                        >
                                            ✕ Сбросить фильтр
                                        </div>
                                    )}
                                    {uniqueValues('format').map((value) => (
                                        <div
                                            key={value}
                                            onClick={() => applyFilter('format', value)}
                                            className="dropdown-item"
                                            style={{
                                                padding: '12px 16px',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid #2a2a2a',
                                                backgroundColor: 'transparent',
                                                color: '#ffffff'
                                            }}
                                            onMouseEnter={(e) => e.target.style.backgroundColor = '#2a2a2a'}
                                            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                        >
                                            {value}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <>
                                    Формат{filters.format && ` (${filters.format})`}{' '}
                                    <span className="dropdown-icon" onClick={() => toggleFilter('format')}>
                                        ▼
                                    </span>
                                </>
                            )}
                        </th>
                        <th ref={filterRefs.start_date} className={filters.start_date ? 'filtered' : ''}>
                            {activeFilter === 'start_date' ? (
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <DatePicker
                                        selected={filters.start_date}
                                        onChange={(date) =>
                                            setFilters((prev) => ({ ...prev, start_date: date }))
                                        }
                                        dateFormat="dd.MM.yyyy"
                                        placeholderText="Выберите дату"
                                        autoFocus
                                        style={{ flex: 1 }}
                                    />
                                    {filters.start_date && (
                                        <button
                                            onClick={() => clearFilter('start_date')}
                                            style={{
                                                padding: '4px 8px',
                                                backgroundColor: '#333333',
                                                color: '#ffffff',
                                                border: '1px solid #555555',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '11px'
                                            }}
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <>
                                    Дата{filters.start_date && ` (${filters.start_date.toLocaleDateString('ru-RU')})`}{' '}
                                    <span className="filter-icon" onClick={() => toggleFilter('start_date')}>
                                        🔍
                                    </span>
                                    <span className="sort-icon" onClick={() => handleSort('start_date')}>
                                        {sort.field === 'start_date' && sort.direction === 'asc' ? '▲' : '▼'}
                                    </span>
                                </>
                            )}
                        </th>
                        <th ref={filterRefs.status} className={filters.status ? 'filtered' : ''}>
                            {activeFilter === 'status' ? (
                                <div className="dropdown" style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: '0',
                                    right: '0',
                                    background: '#1a1a1a',
                                    color: '#ffffff',
                                    border: '1px solid #333333',
                                    borderRadius: '6px',
                                    zIndex: 9999,
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                                    marginTop: '4px',
                                    minWidth: '150px',
                                    whiteSpace: 'nowrap',
                                    display: 'block',
                                    visibility: 'visible'
                                }}>
                                    {filters.status && (
                                        <div
                                            onClick={() => clearFilter('status')}
                                            className="dropdown-item clear-filter"
                                            style={{
                                                padding: '12px 16px',
                                                cursor: 'pointer',
                                                backgroundColor: '#333333',
                                                color: '#ffffff',
                                                borderBottom: '2px solid #444444'
                                            }}
                                        >
                                            ✕ Сбросить фильтр
                                        </div>
                                    )}
                                    {uniqueValues('status').map((value) => (
                                        <div
                                            key={value}
                                            onClick={() => applyFilter('status', value)}
                                            className="dropdown-item"
                                            style={{
                                                padding: '12px 16px',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid #2a2a2a',
                                                backgroundColor: 'transparent',
                                                color: '#ffffff'
                                            }}
                                            onMouseEnter={(e) => e.target.style.backgroundColor = '#2a2a2a'}
                                            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                        >
                                            {value === 'active' ? 'Активен' : 
                                             value === 'in_progress' ? 'Идет' : 
                                             value === 'completed' ? 'Завершен' : 
                                             value}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <>
                                    Статус{filters.status && ` (${
                                        filters.status === 'active' ? 'Активен' : 
                                        filters.status === 'in_progress' ? 'Идет' : 
                                        filters.status === 'completed' ? 'Завершен' : 
                                        filters.status
                                    })`}{' '}
                                    <span className="dropdown-icon" onClick={() => toggleFilter('status')}>
                                        ▼
                                    </span>
                                </>
                            )}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {filteredAndSortedTournaments.map((tournament) => (
                        <tr key={tournament.id}>
                            <td data-label="Игра" title={tournament.game}>{tournament.game}</td>
                            <td data-label="Название" title={tournament.name}>
                                <Link to={`/tournaments/${tournament.id}`}>{tournament.name}</Link>
                            </td>
                            <td data-label="Участники">
                                {tournament.max_participants
                                    ? `${tournament.participant_count} из ${tournament.max_participants}`
                                    : tournament.participant_count}
                            </td>
                            <td data-label="Формат" title={tournament.format}>{tournament.format}</td>
                            <td data-label="Дата">{new Date(tournament.start_date).toLocaleDateString('ru-RU')}</td>
                            <td data-label="Статус">
                                <span className={`tournament-status-badge ${
                                    tournament.status === 'active' ? 'tournament-status-active' : 
                                    tournament.status === 'in_progress' ? 'tournament-status-in-progress' : 
                                    tournament.status === 'completed' ? 'tournament-status-completed' : 
                                    'tournament-status-completed'
                                }`}>
                                    {tournament.status === 'active' ? 'Активен' : 
                                     tournament.status === 'in_progress' ? 'Идет' : 
                                     tournament.status === 'completed' ? 'Завершен' : 
                                     'Неизвестно'}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderCardView = () => (
        <div className="tournaments-cards">
            {filteredAndSortedTournaments.map((tournament) => (
                <div key={tournament.id} className="tournament-card">
                    <h3 className="tournament-name">
                        <Link to={`/tournaments/${tournament.id}`}>{tournament.name}</Link>
                    </h3>
                    <div className="tournament-details">
                        <div className="tournament-info">
                            <span className="tournament-label">Игра:</span>
                            <span className="tournament-value">{tournament.game}</span>
                        </div>
                        <div className="tournament-info">
                            <span className="tournament-label">Участники:</span>
                            <span className="tournament-value">
                                {tournament.max_participants
                                    ? `${tournament.participant_count} из ${tournament.max_participants}`
                                    : tournament.participant_count}
                            </span>
                        </div>
                        <div className="tournament-info">
                            <span className="tournament-label">Формат:</span>
                            <span className="tournament-value">{tournament.format}</span>
                        </div>
                        <div className="tournament-info">
                            <span className="tournament-label">Дата:</span>
                            <span className="tournament-value">
                                {new Date(tournament.start_date).toLocaleDateString('ru-RU')}
                            </span>
                        </div>
                        <div className="tournament-info">
                            <span className="tournament-label">Статус:</span>
                            <span className={`tournament-status ${
                                tournament.status === 'active' ? 'active' : 
                                tournament.status === 'in_progress' ? 'in-progress' : 
                                'completed'
                            }`}>
                                {tournament.status === 'active' ? 'Активен' : 
                                 tournament.status === 'in_progress' ? 'Идет' : 
                                 tournament.status === 'completed' ? 'Завершен' : 
                                 'Неизвестный статус'}
                            </span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <section className="tournaments-list">
            <h2>Список турниров</h2>
            {error && <p className="error">{error}</p>}
            
            {/* === 🆕 УЛУЧШЕННЫЕ КОНТРОЛЫ === */}
            <div className="tournaments-view-controls">
                <div className="view-mode-buttons">
                    {!isMobile && (
                        <button className={`view-mode-btn ${effectiveViewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}>
                            Таблица
                        </button>
                    )}
                    <button className={`view-mode-btn ${effectiveViewMode === 'card' ? 'active' : ''}`} onClick={() => setViewMode('card')}>
                        Карточки
                    </button>
                </div>
                
                {/* === 🆕 ФИЛЬТР И СОРТИРОВКА === */}
                <div className="filters-and-sort">
                    {/* Кнопка расширенного фильтра */}
                    <button 
                        className={`filter-btn-tournaments ${hasActiveFilters() ? 'filter-active' : ''}`}
                        onClick={() => setShowFilterModal(true)}
                        title="Фильтр турниров"
                    >
                        {/* 🔧 Белая SVG иконка фильтра высотой 37px */}
                        <svg 
                            width="32" 
                            height="37" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            xmlns="http://www.w3.org/2000/svg"
                            style={{ 
                                filter: hasActiveFilters() ? 'drop-shadow(0 0 6px #ff0000)' : 'none'
                            }}
                        >
                            <path 
                                d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" 
                                fill="#ffffff"
                            />
                        </svg>
                        {getActiveFiltersCount() > 0 && (
                            <span className="filter-count">
                                {getActiveFiltersCount()}
                            </span>
                        )}
                    </button>
                    
                    {/* Сортировка для режима Карточки */}
                    {effectiveViewMode === 'card' && (
                        <div className="sort-controls">
                            <label className="sort-label">
                                Сортировка:
                                <select 
                                    value={`${sort.field}-${sort.direction}`} 
                                    onChange={(e) => {
                                        const [field, direction] = e.target.value.split('-');
                                        setSort({ field, direction });
                                    }}
                                    className="sort-select"
                                >
                                    {sortOptions.map(option => [
                                        <option key={`${option.value}-desc`} value={`${option.value}-desc`}>
                                            {option.label} (по убыванию)
                                        </option>,
                                        <option key={`${option.value}-asc`} value={`${option.value}-asc`}>
                                            {option.label} (по возрастанию)
                                        </option>
                                    ]).flat()}
                                </select>
                            </label>
                        </div>
                    )}
                    
                    {/* Кнопка очистки всех фильтров */}
                    {hasActiveFilters() && (
                        <button 
                            onClick={clearAllFilters}
                            className="clear-filters-btn"
                        >
                            Очистить ({getActiveFiltersCount()})
                        </button>
                    )}
                </div>
            </div>

            {/* Старая панель фильтров для мобильных устройств */}
            <div className="tournaments-filter-bar">
                <input
                    type="text"
                    placeholder="Поиск по названию"
                    value={filters.name}
                    onChange={(e) => setFilters({...filters, name: e.target.value})}
                    className="mobile-filter-input"
                />
            </div>
            
            {/* === 🆕 СТАТИСТИКА РЕЗУЛЬТАТОВ === */}
            {filteredAndSortedTournaments.length !== tournaments.length && (
                <div className="results-summary">
                    <span className="results-count">
                        Показано {filteredAndSortedTournaments.length} из {tournaments.length} турниров
                    </span>
                    {hasActiveFilters() && (
                        <span className="active-filters-summary">
                            (активных фильтров: {getActiveFiltersCount()})
                        </span>
                    )}
                </div>
            )}
            
            {effectiveViewMode === 'table' ? renderTableView() : renderCardView()}
            
            {filteredAndSortedTournaments.length === 0 && <p>Турниров пока нет.</p>}
            
            {/* === 🆕 МОДАЛЬНОЕ ОКНО ФИЛЬТРА === */}
            <TournamentFilterModal
                isOpen={showFilterModal}
                onClose={() => setShowFilterModal(false)}
                filters={filters}
                onApplyFilters={handleApplyAdvancedFilters}
                tournaments={tournaments}
            />
        </section>
    );
}
 
export default TournamentsList;