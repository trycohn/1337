import React, { useState, useEffect, useRef } from 'react';
import api from '../axios';
import './Messenger.css';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';

function Messenger() {
    const [chats, setChats] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [socket, setSocket] = useState(null);
    const [newMessage, setNewMessage] = useState('');
    const [unreadCounts, setUnreadCounts] = useState({});
    
    const messagesEndRef = useRef(null);

    // Инициализация WebSocket соединения
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        const baseUrl = process.env.REACT_APP_API_URL || window.location.origin;
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = baseUrl.replace(/^https?:/, wsProtocol) + '/chat';
        
        const ws = new WebSocket(`${wsUrl}?token=${token}`);
        
        ws.onopen = () => {
            console.log('WebSocket соединение установлено');
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'message') {
                // Добавление нового сообщения
                handleNewMessage(data.payload);
            } else if (data.type === 'read_status') {
                // Обновление статуса прочтения
                updateMessageReadStatus(data.payload);
            }
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket ошибка:', error);
            setError('Ошибка подключения к серверу чата');
        };
        
        ws.onclose = () => {
            console.log('WebSocket соединение закрыто');
        };
        
        setSocket(ws);
        
        // Загружаем список чатов при монтировании компонента
        fetchChats();
        
        return () => {
            if (ws) {
                ws.close();
            }
        };
    }, []);
    
    // Прокрутка до последнего сообщения при добавлении новых
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);
    
    // Загружаем сообщения при смене активного чата
    useEffect(() => {
        if (activeChat) {
            fetchMessages(activeChat.id);
            markChatAsRead(activeChat.id);
        }
    }, [activeChat]);
    
    // Обработка нового сообщения
    const handleNewMessage = (message) => {
        if (activeChat && Number(activeChat.id) === Number(message.chat_id)) {
            // Если чат активен, добавляем сообщение в список и помечаем как прочитанное
            setMessages(prevMessages => [...prevMessages, message]);
            markMessageAsRead(message.id);
        } else {
            // Если чат не активен, увеличиваем счетчик непрочитанных сообщений
            setUnreadCounts(prevCounts => ({
                ...prevCounts,
                [message.chat_id]: (prevCounts[message.chat_id] || 0) + 1
            }));
            
            // Обновляем список чатов, чтобы показать последнее сообщение
            fetchChats();
        }
    };
    
    // Обновление статуса прочтения сообщения
    const updateMessageReadStatus = (data) => {
        if (activeChat && Number(activeChat.id) === Number(data.chat_id)) {
            setMessages(prevMessages => 
                prevMessages.map(msg => 
                    msg.id === data.message_id 
                        ? { ...msg, is_read: true, read_at: data.read_at } 
                        : msg
                )
            );
        }
    };
    
    // Получение списка чатов
    const fetchChats = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await api.get('/api/chats', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setChats(response.data);
            
            // Обновляем счетчики непрочитанных сообщений
            const counts = {};
            response.data.forEach(chat => {
                counts[chat.id] = chat.unread_count || 0;
            });
            setUnreadCounts(counts);
            
            // Если есть чаты, но активный чат не выбран, выбираем первый
            if (response.data.length > 0 && !activeChat) {
                setActiveChat(response.data[0]);
            }
            
            setError('');
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка загрузки списка чатов');
        } finally {
            setLoading(false);
        }
    };
    
    // Получение сообщений для конкретного чата
    const fetchMessages = async (chatId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.get(`/api/chats/${chatId}/messages`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMessages(response.data);
            setError('');
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка загрузки сообщений');
        }
    };
    
    // Отправка сообщения
    const sendMessage = () => {
        if (!socket || !activeChat || !newMessage.trim()) return;
        
        const messageData = {
            type: 'message',
            payload: {
                chat_id: activeChat.id,
                content: newMessage,
                message_type: 'text'
            }
        };
        
        socket.send(JSON.stringify(messageData));
        setNewMessage('');
    };
    
    // Пометка чата как прочитанного
    const markChatAsRead = async (chatId) => {
        try {
            const token = localStorage.getItem('token');
            await api.post(`/api/chats/${chatId}/read`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Обнуляем счетчик непрочитанных сообщений для этого чата
            setUnreadCounts(prevCounts => ({
                ...prevCounts,
                [chatId]: 0
            }));
            
        } catch (err) {
            console.error('Ошибка при пометке чата как прочитанного:', err);
        }
    };
    
    // Пометка конкретного сообщения как прочитанного
    const markMessageAsRead = async (messageId) => {
        if (!socket) return;
        
        const readData = {
            type: 'read_status',
            payload: {
                message_id: messageId
            }
        };
        
        socket.send(JSON.stringify(readData));
    };
    
    // Отправка вложения
    const sendAttachment = async (file, type) => {
        if (!activeChat || !file) return;
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('chat_id', activeChat.id);
        formData.append('type', type);
        
        try {
            const token = localStorage.getItem('token');
            await api.post('/api/chats/attachment', formData, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            // Сообщение будет добавлено через WebSocket
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка отправки вложения');
        }
    };
    
    // Обработка изменения активного чата
    const handleChatSelect = (chat) => {
        setActiveChat(chat);
    };
    
    // Обработчик ввода сообщения
    const handleInputChange = (e) => {
        setNewMessage(e.target.value);
    };
    
    // Обработчик отправки формы
    const handleSubmit = (e) => {
        e.preventDefault();
        sendMessage();
    };
    
    // Обработка нажатия Enter
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };
    
    // Функция для создания нового чата
    const createChat = async (userId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.post('/api/chats', { userId }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Обновляем список чатов и переключаемся на новый чат
            await fetchChats();
            setActiveChat(response.data);
            
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка создания чата');
        }
    };

    return (
        <div className="messenger">
            <div className="messenger-container">
                <ChatList 
                    chats={chats} 
                    activeChat={activeChat} 
                    onChatSelect={handleChatSelect} 
                    unreadCounts={unreadCounts}
                    onCreateChat={createChat}
                />
                
                <ChatWindow 
                    activeChat={activeChat}
                    messages={messages}
                    newMessage={newMessage}
                    onInputChange={handleInputChange}
                    onSubmit={handleSubmit}
                    onKeyPress={handleKeyPress}
                    onSendAttachment={sendAttachment}
                    messagesEndRef={messagesEndRef}
                />
            </div>
            
            {error && <div className="messenger-error">{error}</div>}
        </div>
    );
}

export default Messenger; 