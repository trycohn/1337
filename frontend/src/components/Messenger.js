import React, { useState, useEffect, useRef } from 'react';
import api from '../axios';
import './Messenger.css';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import { io } from 'socket.io-client';

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

    // Инициализация Socket.IO соединения
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        // Сохраняем userId в localStorage для временных сообщений
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => 
                '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
            ).join(''));
            
            const decoded = JSON.parse(jsonPayload);
            if (decoded.id) {
                localStorage.setItem('userId', decoded.id);
            }
        } catch (error) {
            console.error('Ошибка при декодировании токена:', error);
        }

        const baseUrl = process.env.REACT_APP_API_URL || window.location.origin;
        const socketClient = io(baseUrl, { query: { token } });

        socketClient.on('connect', () => {
            console.log('Socket.IO соединение установлено');
        });

        socketClient.on('message', (message) => {
            console.log('Получено сообщение от сервера:', message);
            handleNewMessage(message);
        });
        socketClient.on('read_status', updateMessageReadStatus);

        socketClient.on('error', (error) => {
            console.error('Socket.IO ошибка:', error);
            setError('Ошибка подключения к серверу чата');
        });

        socketClient.on('connect_error', (error) => {
            console.error('Socket.IO ошибка подключения:', error);
            setError('Ошибка подключения к серверу чата');
        });

        setSocket(socketClient);
        fetchChats();

        return () => {
            socketClient.disconnect();
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
        console.log('Обработка сообщения:', message);
        
        // Проверяем, если это объект с payload внутри (старый формат)
        const actualMessage = message.payload || message;
        
        if (activeChat && Number(activeChat.id) === Number(actualMessage.chat_id)) {
            // Если чат активен, добавляем сообщение в список и помечаем как прочитанное
            setMessages(prevMessages => {
                // Заменяем временное сообщение реальным или добавляем новое
                const filtered = prevMessages.filter(msg => !msg.is_temp);
                return [...filtered, actualMessage];
            });
            if (actualMessage.id) {
                markMessageAsRead(actualMessage.id);
            }
        } else {
            // Если чат не активен, увеличиваем счетчик непрочитанных сообщений
            setUnreadCounts(prevCounts => ({
                ...prevCounts,
                [actualMessage.chat_id]: (prevCounts[actualMessage.chat_id] || 0) + 1
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
        
        console.log('Отправка сообщения:', {
            chat_id: activeChat.id,
            content: newMessage,
            message_type: 'text'
        });

        socket.emit('message', {
            chat_id: activeChat.id,
            content: newMessage,
            message_type: 'text'
        });
        
        // Временно добавляем сообщение локально (без id и timestamp, которые должен дать сервер)
        const tempMessage = {
            chat_id: activeChat.id,
            content: newMessage,
            message_type: 'text',
            is_own: true,
            sender_id: localStorage.getItem('userId') || 'temp',
            created_at: new Date().toISOString(),
            is_temp: true // Помечаем как временное сообщение, сервер должен заменить его актуальным
        };
        
        // Добавляем временное сообщение в список для отображения
        setMessages(prevMessages => [...prevMessages, tempMessage]);
        
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
        socket.emit('read_status', { message_id: messageId });
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