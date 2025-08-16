import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../axios';
import './Messenger.css';
import ChatList from './ChatList';
import MobileChatSheet from './MobileChatSheet';
import './MobileChatSheet.css';
import ChatWindow from './ChatWindow';
import './AttachmentModal.css';
import { useSocket } from '../hooks/useSocket';

function Messenger() {
    const [chats, setChats] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [error, setError] = useState('');
    const [newMessage, setNewMessage] = useState('');
    const [unreadCounts, setUnreadCounts] = useState({});
    const messagesEndRef = useRef(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [sheetOpen, setSheetOpen] = useState(false);
    
    // Состояние для предпросмотра вложения
    const [showAttachmentModal, setShowAttachmentModal] = useState(false);
    const [attachmentFile, setAttachmentFile] = useState(null);
    const [attachmentType, setAttachmentType] = useState(null);
    const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState('');
    const [attachmentCaption, setAttachmentCaption] = useState('');
    const [isClosing, setIsClosing] = useState(false);

    const activeChatRef = useRef(null);

    // 🛡️ ЗАЩИТА ОТ ЧАСТЫХ ЗАПРОСОВ
    const lastRequestTimes = useRef({
        fetchMessages: 0,
        markChatAsRead: 0,
        fetchChatUserInfo: 0,
        fetchChats: 0,
        createChat: 0  // Добавляем счетчик для создания чата
    });

    // 🆕 Добавляем отслеживание последнего активного чата для исключений
    const lastActiveChatId = useRef(null);
    
    const REQUEST_COOLDOWNS = {
        fetchMessages: 300,       // 0.3 секунды (было 1000)
        markChatAsRead: 200,      // 0.2 секунды (было 500)
        fetchChatUserInfo: 10000, // 10 секунд между запросами информации о пользователе
        fetchChats: 1000,         // 1 секунда (было 2000)
        createChat: 10000         // 10 секунд между созданиями чатов
    };

    // Функция проверки возможности выполнения запроса
    const canMakeRequest = useCallback((requestType, chatId = null) => {
        const now = Date.now();
        const lastTime = lastRequestTimes.current[requestType] || 0;
        const cooldown = REQUEST_COOLDOWNS[requestType] || 1000;
        
        // 🆕 ИСКЛЮЧЕНИЕ: при смене активного чата разрешаем запросы без cooldown
        if (chatId && chatId !== lastActiveChatId.current) {
            console.log(`✅ [Messenger] ${requestType} разрешен для нового чата: ${chatId}`);
            lastRequestTimes.current[requestType] = now;
            return true;
        }
        
        if (now - lastTime < cooldown) {
            console.log(`🛡️ [Messenger] Запрос ${requestType} заблокирован (cooldown ${cooldown}ms)`);
            return false;
        }
        
        lastRequestTimes.current[requestType] = now;
        return true;
    }, []);

    // 🚀 Socket.IO подключение с новым hook
    const socketHook = useSocket();

    // Пометка конкретного сообщения как прочитанного
    const markMessageAsRead = useCallback(async (messageId) => {
        if (!socketHook.connected) return;
        // Используем прямой доступ к сокету для этого специфичного API
        const socket = socketHook.getSocket();
        if (socket) {
            socket.emit('read_status', { message_id: messageId });
        }
    }, [socketHook]);

    // Загрузка чатов С ЗАЩИТОЙ ОТ ЧАСТЫХ ЗАПРОСОВ
    const fetchChats = useCallback(async () => {
        if (!canMakeRequest('fetchChats')) {
            console.log('🛡️ [Messenger] fetchChats заблокирован cooldown-ом');
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.log('No token available');
                return;
            }
            
            console.log('🔄 [Messenger] Загружаем список чатов...');
            const response = await api.get('/api/chats', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            console.log('✅ [Messenger] Чаты загружены:', response.data);
            setChats(response.data);
            
            // Инициализируем счетчики непрочитанных из данных чатов (если они есть)
            const initialUnreadCounts = {};
            response.data.forEach(chat => {
                if (chat.unread_count !== undefined) {
                    initialUnreadCounts[chat.id] = chat.unread_count;
                }
            });
            
            setUnreadCounts(initialUnreadCounts);
            setError('');
            
        } catch (err) {
            console.error('❌ [Messenger] Ошибка загрузки чатов:', err);
            setError(err.response?.data?.error || 'Ошибка загрузки чатов');
        }
    }, [canMakeRequest]);

    // Обработка нового сообщения
    const handleNewMessage = useCallback((message) => {
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
    }, [markMessageAsRead]);

    // Загрузка информации о пользователе чата С ЗАЩИТОЙ ОТ ЧАСТЫХ ЗАПРОСОВ
    const fetchChatUserInfo = useCallback(async (chatId) => {
        if (!canMakeRequest('fetchChatUserInfo', chatId)) {
            console.log('🛡️ [Messenger] fetchChatUserInfo заблокирован cooldown-ом');
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            console.log('👤 [Messenger] Загружаем информацию о пользователе чата:', chatId);
            const response = await api.get(`/api/chats/${chatId}/info`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            console.log('✅ [Messenger] Информация о пользователе загружена:', response.data);
            // Обновляем информацию о чате
            setChats(prevChats => 
                prevChats.map(chat => 
                    chat.id === chatId 
                        ? { ...chat, ...response.data }
                        : chat
                )
            );
        } catch (error) {
            console.error('❌ [Messenger] Ошибка загрузки информации о чате:', error);
        }
    }, [canMakeRequest]);

    // Пометка чата как прочитанного С ЗАЩИТОЙ ОТ ЧАСТЫХ ЗАПРОСОВ
    const markChatAsRead = useCallback(async (chatId) => {
        if (!canMakeRequest('markChatAsRead', chatId)) {
            console.log('🛡️ [Messenger] markChatAsRead заблокирован cooldown-ом');
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            console.log('👁️ [Messenger] Помечаем чат как прочитанный:', chatId);
            await api.post(`/api/chats/${chatId}/read`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Обнуляем счетчик непрочитанных для этого чата
            setUnreadCounts(prev => ({
                ...prev,
                [chatId]: 0
            }));
        } catch (error) {
            console.error('❌ [Messenger] Ошибка пометки чата как прочитанного:', error);
        }
    }, [canMakeRequest]);

    // Отслеживаем изменение размера окна
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Свайп-открытие от левого края экрана на мобайле
    const [dragDx, setDragDx] = useState(0);
    const [isDraggingOpen, setIsDraggingOpen] = useState(false);
    useEffect(() => {
        if (!isMobile) return;
        let startX = null;
        let startY = null;
        const threshold = 45; // px
        function onTouchStart(e) {
            if (e.touches[0].clientX < 20) {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                setIsDraggingOpen(true);
            } else {
                startX = null; startY = null;
                setIsDraggingOpen(false);
            }
        }
        function onTouchMove(e) {
            if (startX == null) return;
            const dx = e.touches[0].clientX - startX;
            if (dx > 0) setDragDx(dx); else setDragDx(0);
        }
        function onTouchEnd(e) {
            if (startX == null) return;
            const dx = e.changedTouches[0].clientX - startX;
            const dy = Math.abs(e.changedTouches[0].clientY - startY);
            if (dx > threshold && dy < 60) setSheetOpen(true);
            setDragDx(0);
            setIsDraggingOpen(false);
            startX = null; startY = null;
        }
        document.addEventListener('touchstart', onTouchStart, { passive: true });
        document.addEventListener('touchmove', onTouchMove, { passive: true });
        document.addEventListener('touchend', onTouchEnd, { passive: true });
        return () => {
            document.removeEventListener('touchstart', onTouchStart);
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
        };
    }, [isMobile]);

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
    }, [fetchChats, handleNewMessage, socketHook]);
    
    // ✅ ВКЛЮЧАЕМ ОБРАТНО автоматическое обновление онлайн статуса С ЗАЩИТОЙ
    useEffect(() => {
        if (!activeChat) return;
        
        // При первом рендере и смене чата сразу получаем статус (если прошел cooldown)
        const lastFetchedChatId = activeChatRef.current;
        if (lastFetchedChatId !== activeChat.id) {
            console.log('🔄 [Messenger] Новый активный чат, загружаем информацию о пользователе');
            fetchChatUserInfo(activeChat.id);
        }
        
        // Устанавливаем интервал обновления статуса раз в 5 минут (увеличено с 3 минут)
        const intervalId = setInterval(() => {
            if (activeChat) {
                console.log('⏰ [Messenger] Интервальное обновление статуса пользователя');
                fetchChatUserInfo(activeChat.id);
            }
        }, 300000); // Каждые 5 минут (300000ms) вместо 3 минут для снижения нагрузки
        
        return () => {
            console.log('🧹 [Messenger] Очищаем интервал обновления статуса');
            clearInterval(intervalId);
        };
    }, [activeChat, fetchChatUserInfo]);
    
    // Прокрутка до последнего сообщения при добавлении новых
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);
    
    // Загружаем сообщения при смене активного чата
    useEffect(() => {
        activeChatRef.current = activeChat ? activeChat.id : null;
        lastActiveChatId.current = activeChat ? activeChat.id : null; // Обновляем последний активный чат

        if (activeChat) {
            console.log('🔄 [Messenger] Активный чат изменен на:', activeChat.id);
            
            // Присоединяемся к комнате чата через Socket.IO
            console.log('🔗 [Messenger] Присоединяемся к комнате чата:', activeChat.id);
            socketHook.chat.join(activeChat.id);
            
            fetchMessages(activeChat.id);
            markChatAsRead(activeChat.id);
        }
    }, [activeChat, markChatAsRead, socketHook.chat]);
    
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
    
    // Получение сообщений для конкретного чата С ЗАЩИТОЙ ОТ ЧАСТЫХ ЗАПРОСОВ
    const fetchMessages = async (chatId) => {
        if (!canMakeRequest('fetchMessages', chatId)) {
            console.log('��️ [Messenger] fetchMessages заблокирован cooldown-ом');
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            console.log('📥 [Messenger] Загружаем сообщения для чата:', chatId);
            const response = await api.get(`/api/chats/${chatId}/messages`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            console.log('✅ [Messenger] Сообщения загружены:', response.data.length, 'сообщений');
            setMessages(response.data);
            setError('');
            
        } catch (err) {
            console.error('❌ [Messenger] Ошибка загрузки сообщений:', err);
            setError(err.response?.data?.error || 'Ошибка загрузки сообщений');
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
    
    // Обработка изменения активного чата С ЗАЩИТОЙ ОТ ДУБЛИРОВАНИЯ
    const handleChatSelect = (chat) => {
        // Избегаем дублирования если тот же чат уже активен
        if (activeChat && activeChat.id === chat.id) {
            console.log('💬 [Messenger] Чат уже активен, пропускаем обработку');
            return;
        }
        
        console.log('💬 [Messenger] Выбран новый чат:', chat.id);
        setActiveChat(chat);
        setNewMessage('');
        
        // Присоединяемся к комнате чата через Socket.IO
        console.log('🔗 [Messenger] Присоединяемся к комнате чата через Socket.IO');
        socketHook.chat.join(chat.id);
        
        // fetchMessages и markChatAsRead будут вызваны из useEffect при смене activeChat
        // но мы можем вызвать их здесь для более быстрого отклика (с защитой от дублирования)
        setTimeout(() => {
            fetchMessages(chat.id);
            markChatAsRead(chat.id);
        }, 100); // Небольшая задержка чтобы useEffect сработал
    };
    
    // Функция для возврата к списку чатов на мобильных устройствах
    const handleBackToChats = () => {
        console.log('📱 [Messenger] Возврат к списку чатов');
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
    
    // Функция для создания нового чата С ЗАЩИТОЙ ОТ ЧАСТЫХ ВЫЗОВОВ
    const createChat = async (userId) => {
        if (!canMakeRequest('createChat', userId)) {
            console.log('🛡️ [Messenger] createChat заблокирован cooldown-ом');
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            console.log('➕ [Messenger] Создаем новый чат с пользователем:', userId);
            const response = await api.post('/api/chats', { userId }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            console.log('✅ [Messenger] Новый чат создан:', response.data);
            
            // Обновляем список чатов
            await fetchChats();
            
            // Активируем новый чат
            setActiveChat(response.data);
            setError('');
            
        } catch (err) {
            console.error('❌ [Messenger] Ошибка создания чата:', err);
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
            <div className={`messenger-container ${activeChat && isMobile ? 'chat-active' : ''} ${sheetOpen && isMobile ? 'sheet-open' : ''}`}>
                {/* Десктоп: список чатов слева; Мобайл: прячем, заменяем выезжающей панелью */}
                {!isMobile && (
                    <ChatList 
                        chats={chats} 
                        activeChat={activeChat} 
                        onChatSelect={handleChatSelect} 
                        unreadCounts={unreadCounts}
                        onCreateChat={createChat}
                    />
                )}
                
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

            {/* Плавающая кнопка-стрелка для мобайла */}
            {isMobile && (
                <button 
                    className="chat-toggle-button" 
                    onClick={() => setSheetOpen(true)}
                    aria-label="Открыть список чатов"
                >
                    <span className="triangle" />
                    {Object.values(unreadCounts).reduce((a,b)=>a+(b||0),0) > 0 && (
                        <span className="chat-toggle-badge">{Math.min(99, Object.values(unreadCounts).reduce((a,b)=>a+(b||0),0))}</span>
                    )}
                </button>
            )}

            {/* Мобильный выезжающий список чатов с поддержкой свайпа закрытия */}
            {isMobile && (
                <MobileChatSheet
                    isOpen={sheetOpen}
                    onClose={() => setSheetOpen(false)}
                    chats={chats}
                    activeChat={activeChat}
                    unreadCounts={unreadCounts}
                    onChatSelect={handleChatSelect}
                    onCreateChat={createChat}
                    dragDx={dragDx}
                    isDraggingOpen={isDraggingOpen}
                />
            )}
            
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