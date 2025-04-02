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
    const filterRefs = {
        name: useRef(null),
        game: useRef(null),
        format: useRef(null),
        status: useRef(null),
        start_date: useRef(null),
    };

    useEffect(() => {
        const fetchTournaments = async () => {
            try {
                const response = await api.get('/api/tournaments'); // Добавили /api/
                // Проверяем, что response.data — это массив
                if (Array.isArray(response.data)) {
                    setTournaments(response.data);
                    console.log('🔍 Tournaments data:', response.data);
                } else {
                    console.error('❌ Ожидался массив турниров, получено:', response.data);
                    setError('Ошибка загрузки турниров: данные не в ожидаемом формате');
                    setTournaments([]); // Исправили setTournament на setTournaments
                }
            } catch (error) {
                console.error('❌ Ошибка получения турниров:', error.response ? error.response.data : error.message);
                setError('Ошибка загрузки турниров');
                setTournaments([]); // Исправили setTournament на setTournaments
            }
        };
        fetchTournaments();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                (filterRefs.name.current && !filterRefs.name.current.contains(event.target) && !filters.name) ||
                (filterRefs.game.current && !filterRefs.game.current.contains(event.target)) ||
                (filterRefs.format.current && !filterRefs.format.current.contains(event.target)) ||
                (filterRefs.status.current && !filterRefs.status.current.contains(event.target)) ||
                (filterRefs.start_date.current && !filterRefs.start_date.current.contains(event.target))
            ) {
                setActiveFilter(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [filterRefs.name, filterRefs.game, filterRefs.format, filterRefs.status, filterRefs.start_date, filters.name]);

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

    const uniqueValues = (field) => {
        return [...new Set(tournaments.map((t) => t[field]?.toLowerCase()))].sort();
    };

    const filteredAndSortedTournaments = tournaments
        .filter((tournament) => {
            return (
                (filters.game === '' || tournament.game?.toLowerCase() === filters.game.toLowerCase()) &&
                (filters.name === '' || tournament.name?.toLowerCase().includes(filters.name.toLowerCase())) &&
                (filters.format === '' || tournament.format?.toLowerCase() === filters.format.toLowerCase()) &&
                (filters.status === '' || tournament.status?.toLowerCase() === filters.status.toLowerCase()) &&
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

    return (
        <section className="tournaments-list">
            <h2>Список турниров</h2>
            {error && <p className="error">{error}</p>}
            <table>
                <thead>
                    <tr>
                        <th ref={filterRefs.game}>
                            {activeFilter === 'game' ? (
                                <div className="dropdown">
                                    {uniqueValues('game').map((value) => (
                                        <div
                                            key={value}
                                            onClick={() => applyFilter('game', value)}
                                            className="dropdown-item"
                                        >
                                            {value}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <>
                                    Игра{' '}
                                    <span className="dropdown-icon" onClick={() => setActiveFilter('game')}>
                                        ▼
                                    </span>
                                </>
                            )}
                        </th>
                        <th ref={filterRefs.name}>
                            {activeFilter === 'name' ? (
                                <input
                                    name="name"
                                    value={filters.name}
                                    onChange={handleFilterChange}
                                    placeholder="Поиск по названию"
                                    autoFocus
                                />
                            ) : (
                                <>
                                    Название турнира{' '}
                                    <span className="filter-icon" onClick={() => setActiveFilter('name')}>
                                        🔍
                                    </span>
                                </>
                            )}
                        </th>
                        <th>
                            Кол-во участников{' '}
                            <span className="sort-icon" onClick={() => handleSort('participant_count')}>
                                {sort.field === 'participant_count' && sort.direction === 'asc' ? '▲' : '▼'}
                            </span>
                        </th>
                        <th ref={filterRefs.format}>
                            {activeFilter === 'format' ? (
                                <div className="dropdown">
                                    {uniqueValues('format').map((value) => (
                                        <div
                                            key={value}
                                            onClick={() => applyFilter('format', value)}
                                            className="dropdown-item"
                                        >
                                            {value}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <>
                                    Формат{' '}
                                    <span className="dropdown-icon" onClick={() => setActiveFilter('format')}>
                                        ▼
                                    </span>
                                </>
                            )}
                        </th>
                        <th ref={filterRefs.start_date}>
                            {activeFilter === 'start_date' ? (
                                <DatePicker
                                    selected={filters.start_date}
                                    onChange={(date) =>
                                        setFilters((prev) => ({ ...prev, start_date: date }))
                                    }
                                    dateFormat="dd.MM.yyyy"
                                    placeholderText="Выберите дату"
                                    autoFocus
                                />
                            ) : (
                                <>
                                    Дата старта{' '}
                                    <span className="filter-icon" onClick={() => setActiveFilter('start_date')}>
                                        🔍
                                    </span>
                                    <span className="sort-icon" onClick={() => handleSort('start_date')}>
                                        {sort.field === 'start_date' && sort.direction === 'asc' ? '▲' : '▼'}
                                    </span>
                                </>
                            )}
                        </th>
                        <th ref={filterRefs.status}>
                            {activeFilter === 'status' ? (
                                <div className="dropdown">
                                    {uniqueValues('status').map((value) => (
                                        <div
                                            key={value}
                                            onClick={() => applyFilter('status', value)}
                                            className="dropdown-item"
                                        >
                                            {value === 'active' ? 'Активен' : 'Завершён'}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <>
                                    Статус{' '}
                                    <span className="dropdown-icon" onClick={() => setActiveFilter('status')}>
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
                            <td>{tournament.game}</td>
                            <td>
                                <Link to={`/tournaments/${tournament.id}`}>{tournament.name}</Link>
                            </td>
                            <td>
                                {tournament.max_participants
                                    ? `${tournament.participant_count} из ${tournament.max_participants}`
                                    : tournament.participant_count}
                            </td>
                            <td>{tournament.format}</td>
                            <td>{new Date(tournament.start_date).toLocaleDateString('ru-RU')}</td>
                            <td>{tournament.status === 'active' ? 'Активен' : 'Завершён'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {filteredAndSortedTournaments.length === 0 && <p>Турниров пока нет.</p>}
        </section>
    );
}

export default TournamentsList;