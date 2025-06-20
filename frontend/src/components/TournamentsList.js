// frontend/src/components/TournamentsList.js
import { useState, useEffect, useRef } from 'react';
import api from '../axios'; // Импортируем настроенный экземпляр axios
import { Link } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './Home.css';

function TournamentsList() {
    const [tournaments, setTournaments] = useState([]);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        game: '',
        name: '',
        format: '',
        status: '',
        start_date: null,
    });
    const [sort, setSort] = useState({ field: '', direction: 'asc' });
    const [activeFilter, setActiveFilter] = useState(null);
    const [viewMode, setViewMode] = useState(window.innerWidth <= 600 ? 'card' : 'table');
    const filterRefs = {
        name: useRef(null),
        game: useRef(null),
        format: useRef(null),
        status: useRef(null),
        start_date: useRef(null),
    };

    useEffect(() => {
        const handleResize = () => {
            setViewMode(window.innerWidth <= 600 ? 'card' : 'table');
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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

    const handleSort = (field) => {
        setSort((prev) => ({
            field,
            direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    const applyFilter = (field, value) => {
        setFilters((prev) => ({ ...prev, [field]: value }));
        setActiveFilter(null);
    };

    const clearFilter = (field) => {
        setFilters((prev) => ({ ...prev, [field]: field === 'start_date' ? null : '' }));
        setActiveFilter(null);
    };

    const clearAllFilters = () => {
        setFilters({
            game: '',
            name: '',
            format: '',
            status: '',
            start_date: null,
        });
        setActiveFilter(null);
    };

    const toggleFilter = (filterName) => {
        console.log('🔧 Toggle filter called:', filterName, 'Current active:', activeFilter);
        console.log('🔧 Window width:', window.innerWidth);
        console.log('🔧 Tournaments data:', tournaments.length, 'tournaments');
        const newActiveFilter = activeFilter === filterName ? null : filterName;
        console.log('🔧 Setting active filter to:', newActiveFilter);
        setActiveFilter(newActiveFilter);
        
        // Принудительная проверка через небольшую задержку
        setTimeout(() => {
            const dropdownElement = document.querySelector('.tournaments-list th .dropdown');
            console.log('🔧 Dropdown element found:', dropdownElement);
            if (dropdownElement) {
                const styles = window.getComputedStyle(dropdownElement);
                console.log('🔧 Dropdown styles:', styles);
                console.log('🔧 Dropdown display:', styles.display);
                console.log('🔧 Dropdown visibility:', styles.visibility);
                console.log('🔧 Dropdown z-index:', styles.zIndex);
                
                // Дополнительная диагностика
                const rect = dropdownElement.getBoundingClientRect();
                console.log('🔧 Dropdown position:', {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                    bottom: rect.bottom,
                    right: rect.right
                });
                
                // Проверяем, не перекрыт ли элемент
                const elementAtCenter = document.elementFromPoint(
                    rect.left + rect.width / 2,
                    rect.top + rect.height / 2
                );
                console.log('🔧 Element at dropdown center:', elementAtCenter);
                
                // Проверяем родительские элементы на overflow
                let parent = dropdownElement.parentElement;
                while (parent) {
                    const parentStyles = window.getComputedStyle(parent);
                    if (parentStyles.overflow !== 'visible' || parentStyles.overflowX !== 'visible' || parentStyles.overflowY !== 'visible') {
                        console.log('🔧 Parent with overflow:', parent, {
                            overflow: parentStyles.overflow,
                            overflowX: parentStyles.overflowX,
                            overflowY: parentStyles.overflowY
                        });
                    }
                    parent = parent.parentElement;
                }
                
                // Проверяем высоту контента
                console.log('🔧 Dropdown content height:', dropdownElement.scrollHeight);
                console.log('🔧 Dropdown children count:', dropdownElement.children.length);
            }
        }, 100);
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

    const hasActiveFilters = () => {
        return filters.game !== '' || filters.name !== '' || filters.format !== '' || 
               filters.status !== '' || filters.start_date !== null;
    };

    const filteredAndSortedTournaments = tournaments
        .filter((tournament) => {
            return (
                (filters.game === '' || tournament.game === filters.game) &&
                (filters.name === '' || tournament.name?.toLowerCase().includes(filters.name.toLowerCase())) &&
                (filters.format === '' || tournament.format === filters.format) &&
                (filters.status === '' || tournament.status === filters.status) &&
                (filters.start_date === null ||
                    new Date(tournament.start_date).toLocaleDateString('ru-RU') ===
                    filters.start_date.toLocaleDateString('ru-RU'))
            );
        })
        .sort((a, b) => {
            if (!sort.field) return 0;
            if (sort.field === 'participant_count') {
                return sort.direction === 'asc'
                    ? a.participant_count - b.participant_count
                    : b.participant_count - a.participant_count;
            }
            if (sort.field === 'start_date') {
                return sort.direction === 'asc'
                    ? new Date(a.start_date) - new Date(b.start_date)
                    : new Date(b.start_date) - new Date(a.start_date);
            }
            return 0;
        });

    const renderTableView = () => (
        <div>
            {hasActiveFilters() && (
                <div style={{ marginBottom: '16px', textAlign: 'right' }}>
                    <button 
                        onClick={clearAllFilters}
                        className="clear-all-filters-btn"
                    >
                        ✕ Сбросить все фильтры
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
            
            <div className="tournaments-view-controls">
                <button className={`view-mode-btn ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}>
                    Таблица
                </button>
                <button className={`view-mode-btn ${viewMode === 'card' ? 'active' : ''}`} onClick={() => setViewMode('card')}>
                    Карточки
                </button>
            </div>

            <div className="tournaments-filter-bar">
                <input
                    type="text"
                    placeholder="Поиск по названию"
                    value={filters.name}
                    onChange={(e) => setFilters({...filters, name: e.target.value})}
                    className="mobile-filter-input"
                />
            </div>
            
            {viewMode === 'table' ? renderTableView() : renderCardView()}
            
            {filteredAndSortedTournaments.length === 0 && <p>Турниров пока нет.</p>}
        </section>
    );
}
 
export default TournamentsList;