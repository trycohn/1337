import React, { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket';
import useTournamentManagement from '../hooks/tournament/useTournamentManagement';

const SocketTest = () => {
  const socket = useSocket();
  const [messages, setMessages] = useState([]);
  const [tournamentId, setTournamentId] = useState('1');
  const [chatId, setChatId] = useState('1');
  const [messageText, setMessageText] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      socket.connect(token);
    }
  }, [socket]);

  useEffect(() => {
    socket.on('new_message', (message) => {
      setMessages(prev => [...prev, {
        type: 'chat',
        data: message,
        timestamp: new Date().toLocaleTimeString()
      }]);
    });

    socket.on('tournament_message', (message) => {
      setMessages(prev => [...prev, {
        type: 'tournament',
        data: message,
        timestamp: new Date().toLocaleTimeString()
      }]);
    });

    socket.on('tournament_updated', (data) => {
      setMessages(prev => [...prev, {
        type: 'tournament_update',
        data: data,
        timestamp: new Date().toLocaleTimeString()
      }]);
    });

    return () => {
      socket.off('new_message');
      socket.off('tournament_message'); 
      socket.off('tournament_updated');
    };
  }, [socket]);

  const handleJoinTournament = () => {
    socket.tournament.join(tournamentId);
    setMessages(prev => [...prev, {
      type: 'action',
      data: `Присоединился к турниру ${tournamentId}`,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const handleSendChatMessage = () => {
    if (messageText.trim()) {
      socket.chat.sendMessage(chatId, messageText);
      setMessageText('');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>🧪 Тестирование Socket.IO</h2>
      
      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: socket.connected ? '#d4edda' : '#f8d7da', borderRadius: '5px' }}>
        <strong>Статус:</strong> {socket.connected ? '✅ Подключен' : '❌ Отключен'}
        {socket.socketId && <span> | ID: {socket.socketId}</span>}
      </div>

      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>🏆 Турниры</h3>
        <input 
          type="text" 
          value={tournamentId} 
          onChange={(e) => setTournamentId(e.target.value)}
          placeholder="ID турнира"
          style={{ marginRight: '10px', padding: '5px' }}
        />
        <button onClick={handleJoinTournament}>Присоединиться</button>
      </div>

      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>💬 Чаты</h3>
        <input 
          type="text" 
          value={chatId} 
          onChange={(e) => setChatId(e.target.value)}
          placeholder="ID чата"
          style={{ marginRight: '10px', padding: '5px' }}
        />
        <input 
          type="text" 
          value={messageText} 
          onChange={(e) => setMessageText(e.target.value)}
          placeholder="Сообщение"
          style={{ marginRight: '10px', padding: '5px', width: '200px' }}
        />
        <button onClick={handleSendChatMessage}>Отправить</button>
      </div>

      <div style={{ border: '1px solid #ddd', borderRadius: '5px', height: '300px', overflow: 'auto', padding: '10px' }}>
        <h3>📋 События</h3>
        {messages.map((msg, index) => (
          <div key={index} style={{ marginBottom: '5px', fontSize: '12px' }}>
            <span style={{ color: '#666' }}>{msg.timestamp}</span> - 
            <span style={{ fontWeight: 'bold' }}>{msg.type}</span>: 
            {JSON.stringify(msg.data)}
          </div>
        ))}
      </div>
    </div>
  );
};

// Тестовый компонент для диагностики поиска пользователей
const UserSearchTest = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState(null);
    
    // Используем хук с фиктивным ID турнира для тестирования
    const tournamentManagement = useTournamentManagement(1);

    const testSearch = useCallback(async () => {
        if (!query || query.trim().length < 2) {
            setResults([]);
            return;
        }

        setIsSearching(true);
        setError(null);
        
        try {
            console.log('🔍 [TEST] Начинаем тестовый поиск:', query);
            const result = await tournamentManagement.searchUsers(query.trim());
            
            console.log('🔍 [TEST] Результат тестового поиска:', result);
            
            if (result.success) {
                setResults(result.data || []);
                setError(null);
            } else {
                setResults([]);
                setError(result.error || 'Неизвестная ошибка');
            }
        } catch (err) {
            console.error('🔍 [TEST] Ошибка тестового поиска:', err);
            setResults([]);
            setError(err.message || 'Критическая ошибка');
        } finally {
            setIsSearching(false);
        }
    }, [query, tournamentManagement]);

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
            <h2>🔍 Тест поиска пользователей</h2>
            
            <div style={{ marginBottom: '20px' }}>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Введите имя пользователя для поиска..."
                    style={{
                        width: '100%',
                        padding: '10px',
                        fontSize: '16px',
                        border: '1px solid #ccc',
                        borderRadius: '4px'
                    }}
                />
            </div>

            <button 
                onClick={testSearch}
                disabled={isSearching || !query.trim()}
                style={{
                    padding: '10px 20px',
                    fontSize: '16px',
                    backgroundColor: isSearching ? '#ccc' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isSearching ? 'not-allowed' : 'pointer'
                }}
            >
                {isSearching ? 'Поиск...' : 'Найти пользователей'}
            </button>

            {error && (
                <div style={{
                    marginTop: '20px',
                    padding: '10px',
                    backgroundColor: '#f8d7da',
                    color: '#721c24',
                    border: '1px solid #f5c6cb',
                    borderRadius: '4px'
                }}>
                    ❌ Ошибка: {error}
                </div>
            )}

            {results.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                    <h3>Результаты поиска ({results.length}):</h3>
                    {results.map((user) => (
                        <div 
                            key={user.id}
                            style={{
                                padding: '10px',
                                margin: '5px 0',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                backgroundColor: '#f9f9f9'
                            }}
                        >
                            <strong>{user.username}</strong> (ID: {user.id})
                            {user.faceit_elo && <span> | FACEIT: {user.faceit_elo}</span>}
                            {user.cs2_premier_rank && <span> | CS2: {user.cs2_premier_rank}</span>}
                        </div>
                    ))}
                </div>
            )}

            {!isSearching && query.trim() && results.length === 0 && !error && (
                <div style={{
                    marginTop: '20px',
                    padding: '10px',
                    backgroundColor: '#fff3cd',
                    color: '#856404',
                    border: '1px solid #ffeaa7',
                    borderRadius: '4px'
                }}>
                    🔍 Пользователи не найдены
                </div>
            )}
        </div>
    );
};

export default UserSearchTest; 