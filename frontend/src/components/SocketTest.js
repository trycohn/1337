import React, { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';

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

export default SocketTest; 