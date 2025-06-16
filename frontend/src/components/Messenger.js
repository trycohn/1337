import React, { useState, useEffect, useRef } from 'react';
import api from '../axios';
import './Messenger.css';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import './AttachmentModal.css';
import { useSocket } from '../hooks/useSocket';

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
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    
    // Состояние для предпросмотра вложения
    const [showAttachmentModal, setShowAttachmentModal] = useState(false);
    const [attachmentFile, setAttachmentFile] = useState(null);
    const [attachmentType, setAttachmentType] = useState(null);
    const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState('');
    const [attachmentCaption, setAttachmentCaption] = useState('');
    const [isClosing, setIsClosing] = useState(false);

    const activeChatRef = useRef(null);

    // Отслеживаем изменение размера окна
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Добавляем класс к main элементу для переопределения стилей
    useEffect(() => {
        const mainElement = document.querySelector('main');
        if (mainElement) {
            mainElement.classList.add('messenger-page');
        }
        
        return () => {
            if (mainElement) {
                mainElement.classList.remove('messenger-page');
            }
        };
    }, []);

    // 🚀 Socket.IO подключение с новым hook
    const socketHook = useSocket();

    // Инициализация Socket.IO (только один раз)
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        console.log('🚀 [Messenger] Подключение к Socket.IO...');
        
        // Подключаемся к Socket.IO
        const connected = socketHook.connect(token);
        
        if (connected) {
            console.log('✅ [Messenger] Socket.IO инициализирован');
            
            // Обработчики событий
            const handleError = (error) => {
                console.error('❌ [Messenger] Socket.IO ошибка:', error);
                setError('Ошибка подключения к серверу чата');
            };
            
            // Подписываемся на события
            socketHook.on('new_message', handleNewMessage);
            socketHook.on('read_status', updateMessageReadStatus);
            socketHook.on('notification_update', handleNotificationUpdate);
            socketHook.on('error', handleError);

            // Устанавливаем сокет для совместимости
            setSocket(socketHook.getSocket());
            
            // Загружаем чаты
            fetchChats();

            // Cleanup - отписываемся от событий
            return () => {
                console.log('🧹 [Messenger] Отписываемся от Socket.IO событий');
                socketHook.off('new_message', handleNewMessage);
                socketHook.off('read_status', updateMessageReadStatus);
                socketHook.off('notification_update', handleNotificationUpdate);
                socketHook.off('error', handleError);
            };
        }
    }, []); // Убрали все зависимости для одноразового выполнения
    
    // Обновляем онлайн статус каждую минуту
    useEffect(() => {
        if (!activeChat) return;
        
        // При первом рендере и смене чата сразу получаем статус
        const lastFetchedChatId = activeChatRef.current;
        if (lastFetchedChatId !== activeChat.id) {
            fetchChatUserInfo(activeChat.id);
        }
        
        // Устанавливаем интервал обновления статуса раз в 3 минуты
        const intervalId = setInterval(() => {
            if (activeChat) {
                fetchChatUserInfo(activeChat.id);
            }
        }, 180000); // Каждые 3 минуты
        
        return () => clearInterval(intervalId);
    }, [activeChat?.id]);
    
    // Прокрутка до последнего сообщения при добавлении новых
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);
    
    // Загружаем сообщения при смене активного чата
    useEffect(() => {
        activeChatRef.current = activeChat ? activeChat.id : null;

        if (activeChat) {
            console.log('🔄 [Messenger] Активный чат изменен на:', activeChat.id);
            
            // Присоединяемся к комнате чата через Socket.IO
            console.log('🔗 [Messenger] Присоединяемся к комнате чата:', activeChat.id);
            socketHook.chat.join(activeChat.id);
            
            fetchMessages(activeChat.id);
            markChatAsRead(activeChat.id);
        }
    }, [activeChat]);
    
    // Обработка нового сообщения: обновляем сообщения и динамически обновляем, сортируя список чатов
    const handleNewMessage = (message) => {
        console.log('📨 [Messenger] Получено новое сообщение:', message);
        const chatId = Number(message.chat_id);
        console.log('📨 [Messenger] Chat ID:', chatId, 'Active chat:', activeChatRef.current);
        
        // Добавляем сообщение только если оно для активного чата
        if (Number(activeChatRef.current) === chatId) {
            setMessages(prevMessages => {
                if (prevMessages.some(m => m.id === message.id)) {
                    console.log('📨 [Messenger] Сообщение уже существует, пропускаем');
                    return prevMessages;
                }
                console.log('📨 [Messenger] Добавляем новое сообщение в активный чат');
                return [...prevMessages, message];
            });
        } else {
            console.log('📨 [Messenger] Сообщение не для активного чата, не добавляем в список');
        }
        
        // Обновляем last_message и пересортировываем чаты по дате последнего сообщения
        setChats(prevChats => {
            const updatedChats = prevChats.map(chat =>
                chat.id === chatId ? { ...chat, last_message: message } : chat
            );
            return updatedChats
                .slice()
                .sort((a, b) => {
                    // Сначала закрепленные чаты
                    if (a.is_pinned !== b.is_pinned) return b.is_pinned ? 1 : -1;
                    // Затем по дате последнего сообщения
                    return new Date(b.last_message?.created_at || b.updated_at) - new Date(a.last_message?.created_at || a.updated_at);
                });
        });
        
        // Если сообщение в активном чате, отмечаем как прочитанное, иначе увеличиваем счетчик непрочитанных
        if (Number(activeChatRef.current) === chatId) {
            console.log('📨 [Messenger] Сообщение в активном чате, помечаем как прочитанное');
            markMessageAsRead(message.id);
        } else {
            console.log('📨 [Messenger] Сообщение в неактивном чате, увеличиваем счетчик');
            setUnreadCounts(prev => ({
                ...prev,
                [chatId]: (prev[chatId] || 0) + 1
            }));
        }
    };
    
    // Обновление статуса прочтения сообщения
    const updateMessageReadStatus = (data) => {
        if (activeChatRef.current && Number(activeChatRef.current) === Number(data.chat_id)) {
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
            
            // Не запрашиваем онлайн-статус здесь, так как это делается в useEffect
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка загрузки сообщений');
        }
    };
    
    // Получение информации о пользователе чата для отображения онлайн статуса
    const fetchChatUserInfo = async (chatId) => {
        try {
            // Находим текущий чат
            const chat = chats.find(c => c.id === chatId);
            if (!chat || !chat.user_id) return;
            
            const token = localStorage.getItem('token');
            const response = await api.get(`/api/users/profile/${chat.user_id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Обновляем онлайн статус в активном чате
            if (response.data && response.data.online_status) {
                setActiveChat(prev => ({
                    ...prev,
                    online_status: response.data.online_status
                }));
            }
        } catch (err) {
            console.error('Ошибка получения статуса онлайн:', err);
            // Не показываем ошибку пользователю, так как это не критично
        }
    };
    
    // Отправка сообщения
    const sendMessage = () => {
        if (!activeChat || !newMessage.trim()) {
            console.log('📤 [Messenger] Не отправляем: нет активного чата или сообщение пустое');
            return;
        }
        
        console.log('📤 [Messenger] Отправляем сообщение через Socket.IO:', {
            chatId: activeChat.id,
            message: newMessage.trim()
        });
        
        // Используем новый API Socket.IO
        socketHook.chat.sendMessage(activeChat.id, newMessage.trim());
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

            // Отправляем событие через Socket.IO для обновления счетчика в Layout.js
            if (socketHook.connected) {
                const socket = socketHook.getSocket();
                if (socket) {
                    socket.emit('messages_read', { chat_id: chatId });
                    console.log('📖 [Messenger] Отправлено событие messages_read для чата:', chatId);
                }
            }
            
        } catch (err) {
            console.error('Ошибка при пометке чата как прочитанного:', err);
        }
    };
    
    // Пометка конкретного сообщения как прочитанного
    const markMessageAsRead = async (messageId) => {
        if (!socketHook.connected) return;
        // Используем прямой доступ к сокету для этого специфичного API
        const socket = socketHook.getSocket();
        if (socket) {
            socket.emit('read_status', { message_id: messageId });
        }
    };
    
    // Переназначаем отправку вложения на показ модалки
    const handleFileSelect = (file, type) => {
        // Создаём preview
        const url = URL.createObjectURL(file);
        setAttachmentFile(file);
        setAttachmentType(type);
        setAttachmentPreviewUrl(url);
        setAttachmentCaption('');
        setShowAttachmentModal(true);
        setIsClosing(false);
    };

    // Подтверждение отправки вложения
    const confirmSendAttachment = async () => {
        if (!attachmentFile) {
            closeModal();
            return;
        }
        const formData = new FormData();
        formData.append('file', attachmentFile);
        formData.append('chat_id', activeChat.id);
        formData.append('type', attachmentType);
        formData.append('caption', attachmentCaption);
        try {
            const token = localStorage.getItem('token');
            const response = await api.post('/api/chats/attachment', formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            // Оптимистичный рендер: добавляем сразу новое сообщение
            if (response.data?.message) {
                handleNewMessage(response.data.message);
            }
            // Обновляем список сообщений из сервера для корректности
            if (activeChat) {
                await fetchMessages(activeChat.id);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка отправки вложения');
        }
        // Очистка
        closeModal();
    };

    // Функция для плавного закрытия модального окна
    const closeModal = () => {
        setIsClosing(true);
        setTimeout(() => {
            URL.revokeObjectURL(attachmentPreviewUrl);
            setShowAttachmentModal(false);
            setAttachmentFile(null);
            setAttachmentType(null);
            setAttachmentPreviewUrl('');
            setAttachmentCaption('');
            setIsClosing(false);
        }, 300);
    };

    // Отмена отправки вложения
    const cancelSendAttachment = () => {
        closeModal();
    };
    
    // Обработка изменения активного чата
    const handleChatSelect = (chat) => {
        console.log('💬 [Messenger] Выбран новый чат:', chat.id);
        setActiveChat(chat);
        setNewMessage('');
        
        // Присоединяемся к комнате чата через Socket.IO
        console.log('🔗 [Messenger] Присоединяемся к комнате чата через Socket.IO');
        socketHook.chat.join(chat.id);
        
        fetchMessages(chat.id);
        markChatAsRead(chat.id);
    };
    
    // Функция для возврата к списку чатов на мобильных устройствах
    const handleBackToChats = () => {
        setActiveChat(null);
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

    // Функция для удаления сообщения
    const deleteMessage = async (messageId) => {
        try {
            const token = localStorage.getItem('token');
            await api.delete(`/api/chats/messages/${messageId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Оптимистичное удаление сообщения из UI
            setMessages(prevMessages => prevMessages.filter(msg => msg.id !== messageId));
            
            // Обновляем последнее сообщение в чате если это было оно
            if (activeChat) {
                const chatId = activeChat.id;
                setChats(prevChats => {
                    return prevChats.map(chat => {
                        if (chat.id === chatId && chat.last_message?.id === messageId) {
                            // Находим предпоследнее сообщение
                            const newLastMessage = messages
                                .filter(msg => msg.id !== messageId)
                                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;
                            
                            return { ...chat, last_message: newLastMessage };
                        }
                        return chat;
                    });
                });
            }
            
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка удаления сообщения');
        }
    };

    // Функция для скрытия чата
    const hideChat = async (chatId) => {
        try {
            // Убираем чат из списка локально
            setChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
            
            // Если скрытый чат был активным, сбрасываем активный чат
            if (activeChat?.id === chatId) {
                setActiveChat(null);
            }
            
            // В будущем можно добавить API для скрытия чата на сервере
            console.log('Чат скрыт:', chatId);
            
        } catch (err) {
            setError('Ошибка при скрытии чата');
        }
    };

    // Обработка обновления уведомления в системном чате
    const handleNotificationUpdate = (data) => {
        if (!data || !data.id) return;
        
        console.log('Получено обновление статуса уведомления:', data);
        
        // Находим все сообщения, которые содержат ссылку на это уведомление
        setMessages(prevMessages => 
            prevMessages.map(msg => {
                if (msg.content_meta?.notification_id === data.id) {
                    // Обновляем meta информацию, добавляя статус обработки
                    return {
                        ...msg,
                        content_meta: {
                            ...msg.content_meta,
                            action: data.action,
                            processed: true
                        }
                    };
                }
                return msg;
            })
        );
    };

    return (
        <div className="messenger">
            <div className={`messenger-container ${activeChat && isMobile ? 'chat-active' : ''}`}>
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
                    onSendAttachment={handleFileSelect}
                    messagesEndRef={messagesEndRef}
                    onDeleteMessage={deleteMessage}
                    onBackToChats={handleBackToChats}
                    isMobile={isMobile}
                    onHideChat={hideChat}
                />
            </div>
            
            {error && <div className="messenger-error">{error}</div>}

            {showAttachmentModal && (
                <div className={`attachment-modal ${isClosing ? 'closing' : ''}`}>
                    <div className="attachment-modal-content">
                        <h2>Send {attachmentType}</h2>
                        {attachmentType === 'image' && (
                            <img src={attachmentPreviewUrl} alt="preview" className="attachment-preview" />
                        )}
                        <textarea
                            placeholder="Add a caption..."
                            value={attachmentCaption}
                            onChange={e => setAttachmentCaption(e.target.value)}
                            className="attachment-caption"
                        />
                        <button className="attachment-send-btn" onClick={confirmSendAttachment}>Send</button>
                        <button className="attachment-cancel-btn" onClick={cancelSendAttachment}>Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Messenger; 