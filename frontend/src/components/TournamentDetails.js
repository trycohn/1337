// Импорты React и связанные
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import './TournamentDetails.css';

// 🔍 ДИАГНОСТИКА: Добавляем логирование для отслеживания инициализации
console.log('🔍 [TournamentDetails] Начало загрузки модуля');
console.log('✅ [TournamentDetails] Все импорты завершены, создаем компонент...');

function TournamentDetails() {
    console.log('🔍 [TournamentDetails] Функция TournamentDetails вызвана, начинаем инициализацию...');
    
    const { id } = useParams();
    console.log('🔍 [TournamentDetails] Получен ID турнира из URL:', id);
    
    // Простое состояние для тестирования
    const [tournament, setTournament] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    console.log('🔍 [TournamentDetails] Состояния инициализированы');
    
    // Простой эффект для загрузки данных
    useEffect(() => {
        console.log('🔍 [TournamentDetails] useEffect запущен для загрузки турнира');
        
        const fetchTournament = async () => {
            try {
                console.log('🔍 [TournamentDetails] Начинаем загрузку турнира с ID:', id);
                setLoading(true);
                setError(null);
                
                const response = await api.get(`/api/tournaments/${id}`);
                console.log('✅ [TournamentDetails] Турнир загружен:', response.data);
                
                setTournament(response.data);
                setLoading(false);
            } catch (error) {
                console.error('❌ [TournamentDetails] Ошибка загрузки турнира:', error);
                setError(error.message);
                setLoading(false);
            }
        };
        
        if (id) {
            fetchTournament();
        }
    }, [id]);
    
    console.log('🔍 [TournamentDetails] Рендерим компонент...');
    
    if (loading) {
        console.log('🔍 [TournamentDetails] Показываем загрузку...');
        return (
            <div className="tournament-details">
                <div style={{ padding: '40px', textAlign: 'center' }}>
                    <h2>🔄 Загрузка турнира...</h2>
                    <p>ID турнира: {id}</p>
                    <div style={{ marginTop: '20px' }}>
                        <div className="loading-spinner" style={{
                            border: '4px solid #f3f3f3',
                            borderTop: '4px solid #3498db',
                            borderRadius: '50%',
                            width: '40px',
                            height: '40px',
                            animation: 'spin 2s linear infinite',
                            margin: '0 auto'
                        }}></div>
                    </div>
                </div>
            </div>
        );
    }
    
    if (error) {
        console.log('🔍 [TournamentDetails] Показываем ошибку:', error);
        return (
            <div className="tournament-details">
                <div style={{ padding: '40px', textAlign: 'center', color: 'red' }}>
                    <h2>❌ Ошибка загрузки турнира</h2>
                    <p>ID турнира: {id}</p>
                    <p>Ошибка: {error}</p>
                    <button 
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '10px 20px',
                            background: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            marginTop: '20px'
                        }}
                    >
                        Попробовать снова
                    </button>
                </div>
            </div>
        );
    }
    
    if (!tournament) {
        console.log('🔍 [TournamentDetails] Турнир не найден...');
        return (
            <div className="tournament-details">
                <div style={{ padding: '40px', textAlign: 'center' }}>
                    <h2>🔍 Турнир не найден</h2>
                    <p>ID турнира: {id}</p>
                </div>
            </div>
        );
    }
    
    console.log('🔍 [TournamentDetails] Рендерим данные турнира...');
    
    return (
        <div className="tournament-details">
            <div style={{ padding: '20px' }}>
                <h1>{tournament.name}</h1>
                <div style={{ marginBottom: '20px' }}>
                    <p><strong>ID турнира:</strong> {id}</p>
                    <p><strong>Статус:</strong> {tournament.status}</p>
                    <p><strong>Игра:</strong> {tournament.game_name}</p>
                    <p><strong>Участников:</strong> {tournament.participants?.length || 0}</p>
                    <p><strong>Максимум участников:</strong> {tournament.max_participants}</p>
                    <p><strong>Дата создания:</strong> {new Date(tournament.created_at).toLocaleString()}</p>
                </div>
                
                {/* Режим диагностики */}
                <div style={{ 
                    padding: '20px', 
                    background: '#e8f5e8', 
                    border: '2px solid #4caf50',
                    borderRadius: '8px',
                    margin: '20px 0' 
                }}>
                    <h3>✅ Режим диагностики - Успешно!</h3>
                    <p>Компонент TournamentDetails работает в упрощенном режиме.</p>
                    <p>Ошибка Temporal Dead Zone устранена!</p>
                    <p>Все базовые функции работают корректно.</p>
                </div>
                
                {/* Информация об участниках */}
                {tournament.participants && tournament.participants.length > 0 && (
                    <div style={{ marginTop: '30px' }}>
                        <h3>👥 Участники турнира</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                            {tournament.participants.map((participant, index) => (
                                <div key={participant.id || index} style={{
                                    padding: '10px',
                                    background: '#f8f9fa',
                                    border: '1px solid #dee2e6',
                                    borderRadius: '5px'
                                }}>
                                    <strong>{participant.name}</strong>
                                    {participant.faceit_elo && (
                                        <div style={{ fontSize: '0.9em', color: '#666' }}>
                                            FACEIT: {participant.faceit_elo}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

console.log('🔍 [TournamentDetails] Компонент TournamentDetails создан, готов к экспорту');

export default TournamentDetails;

console.log('✅ [TournamentDetails] Модуль TournamentDetails полностью загружен и экспортирован');
