import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../utils/api';
import './LiveParticipantSearch.css';

const MIN_QUERY = 2;

function LiveParticipantSearch({ tournamentId, onAdded }) {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [error, setError] = useState('');
    const [addingId, setAddingId] = useState(null);
    const debounceRef = useRef(null);
    const lastRequestIdRef = useRef(0);

    const search = useCallback(async (q) => {
        if (!q || q.length < MIN_QUERY) { setResults([]); return; }
        setLoading(true);
        setError('');
        try {
            // Используем универсальный пользовательский поиск (предполагается /api/users/search?q=...)
            // Если есть другой ваш эндпоинт поиска — замените здесь
            const { data } = await api.get(`/api/users/search?query=${encodeURIComponent(q)}&limit=20`);
            setResults(Array.isArray(data) ? data : (data?.users || []));
        } catch (e) {
            setError('Ошибка поиска');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        const requestId = ++lastRequestIdRef.current;
        debounceRef.current = setTimeout(async () => {
            // защита от устаревших ответов
            const q = query;
            await search(q);
            // если к этому времени появился новый запрос — просто игнорируем (search уже без побочных эффектов)
        }, 400);
        return () => debounceRef.current && clearTimeout(debounceRef.current);
    }, [query, search]);

    const handleAdd = async (user) => {
        if (!user?.id) return;
        setAddingId(user.id);
        try {
            // 📧 Отправляем приглашение пользователю (НЕ добавляем напрямую!)
            await api.post(`/api/tournaments/${tournamentId}/invite`, {
                username: user.username || `User${user.id}` // Backend ожидает username для поиска пользователя
            });
            
            // Показываем сообщение об успехе
            setError(''); // Очищаем предыдущие ошибки
            setQuery(''); // Очищаем поле поиска после успешной отправки приглашения
            setResults([]); // Очищаем результаты
            
            // Уведомляем родительский компонент (для обновления интерфейса, если нужно)
            onAdded?.();
            
            console.log(`✅ Приглашение успешно отправлено пользователю ${user.username}`);
        } catch (e) {
            // Показываем сообщение об ошибке пользователю
            const errorMessage = e.response?.data?.error || e.response?.data?.message || 'Ошибка при отправке приглашения';
            setError(Array.isArray(errorMessage) ? errorMessage.join(', ') : errorMessage);
            console.error('❌ Ошибка при отправке приглашения:', e);
        } finally {
            setAddingId(null);
        }
    };

    return (
        <div className="live-search-container">
            <input
                type="text"
                placeholder="Поиск по пользователям (минимум 3 символа)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="live-search-input"
            />
            {loading && <div className="live-search-loading">Поиск...</div>}
            {error && <div className="live-search-error">{error}</div>}
            {!loading && results && results.length > 0 && (
                <div className="live-search-results">
                    {results.map((u) => (
                        <div key={u.id} className="live-search-row">
                            <div className="live-search-user">
                                <div className="live-search-avatar">
                                    {(u.username || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="live-search-username">{u.username || `User #${u.id}`}</div>
                                    {(u.faceit_elo || u.cs2_premier_rank) && (
                                        <div className="live-search-meta">
                                            {u.faceit_elo && `${u.faceit_elo} ELO`}
                                            {u.faceit_elo && u.cs2_premier_rank ? ' • ' : ''}
                                            {u.cs2_premier_rank && `Premier ${u.cs2_premier_rank}`}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button className="btn btn-primary" disabled={addingId===u.id} onClick={() => handleAdd(u)}>
                                {addingId===u.id ? 'Отправка...' : 'Пригласить'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
            {!loading && query.length >= MIN_QUERY && results.length === 0 && !error && (
                <div className="live-search-empty">Ничего не найдено</div>
            )}
        </div>
    );
}

export default LiveParticipantSearch;

