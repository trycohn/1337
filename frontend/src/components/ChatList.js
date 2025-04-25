import React, { useState } from 'react';
import './ChatList.css';
import { formatDate } from '../utils/dateHelpers';

function ChatList({ chats, activeChat, onChatSelect, unreadCounts, onCreateChat }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [showFriendsList, setShowFriendsList] = useState(false);
    const [friends, setFriends] = useState([]);
    const [loadingFriends, setLoadingFriends] = useState(false);
    
    // Форматирование последнего сообщения для отображения в списке
    const formatLastMessage = (message) => {
        if (!message) return '';
        
        // Ограничиваем длину сообщения
        let content = message.content;
        if (content.length > 40) {
            content = content.substring(0, 38) + '...';
        }
        
        // Добавляем префикс в зависимости от типа сообщения
        switch (message.message_type) {
            case 'image':
                return '📷 Фото';
            case 'file':
                return '📎 Файл';
            case 'document':
                return '📄 Документ';
            case 'announcement':
                return '📣 ' + content;
            default:
                return content;
        }
    };
    
    // Получение префикса статуса для чата
    const getChatStatusPrefix = (chat) => {
        if (chat.is_pinned) return '📌 ';
        if (chat.is_muted) return '🔇 ';
        return '';
    };
    
    // Получение индикатора статуса сообщения
    const getMessageStatusIndicator = (message) => {
        if (!message) return '';
        
        if (message.is_read) return '✅ ';
        
        // Не добавляем иконку для уведомлений, так как она уже добавляется в formatLastMessage
        switch (message.message_type) {
            case 'image':
                return '';
            case 'file':
                return '';
            case 'document':
                return '';
            case 'announcement':
                // Убираем иконку для уведомлений, чтобы избежать дублирования
                return '';
            default:
                return '';
        }
    };
    
    // Функция для префикса отправителя перед последним сообщением
    const getSenderPrefix = (chat) => {
        if (!chat.last_message) return '';
        // Особая логика для приватных чатов
        if (chat.type === 'private') {
            // Если последнее сообщение от собеседника
            if (chat.last_message.sender_id === chat.user_id) {
                return `${chat.name}: `;
            }
            // Иначе — от текущего пользователя
            return 'Вы: ';
        }
        // Для групповых чатов, если известен имя отправителя
        if (chat.last_message.sender_username) {
            return `${chat.last_message.sender_username}: `;
        }
        return '';
    };
    
    // Фильтрация чатов по поисковому запросу
    const filteredChats = chats.filter(chat => 
        chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (chat.last_message && chat.last_message.content.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    
    // Загрузка списка друзей для создания нового чата
    const loadFriends = async () => {
        setLoadingFriends(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/friends', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                // Фильтруем только принятые заявки в друзья
                const acceptedFriends = data.filter(f => f.status === 'accepted');
                setFriends(acceptedFriends);
            }
        } catch (error) {
            console.error('Ошибка загрузки списка друзей:', error);
        } finally {
            setLoadingFriends(false);
        }
    };
    
    // Открытие окна выбора друга для создания чата
    const openFriendsList = () => {
        setShowFriendsList(true);
        loadFriends();
    };
    
    // Обработка выбора друга для создания нового чата
    const handleFriendSelect = (friendId) => {
        onCreateChat(friendId);
        setShowFriendsList(false);
    };

    return (
        <div className="chat-list">
            <div className="chat-list-header">
                <h2>Сообщения</h2>
                <button className="new-chat-btn" onClick={openFriendsList}>
                    Новый чат
                </button>
            </div>
            
            <div className="chat-search">
                <input 
                    type="text" 
                    placeholder="Поиск..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            
            <div className="chats-container">
                {filteredChats.length > 0 ? (
                    filteredChats.map(chat => (
                        <div 
                            key={chat.id} 
                            className={`chat-item ${activeChat?.id === chat.id ? 'active' : ''}`}
                            onClick={() => onChatSelect(chat)}
                        >
                            <div className="chat-avatar">
                                <img 
                                    src={chat.avatar_url || '/default-avatar.png'} 
                                    alt={chat.name} 
                                />
                            </div>
                            
                            <div className="chat-info">
                                <div className="chat-name">
                                    {getChatStatusPrefix(chat)}{chat.name}
                                </div>
                                <div className="chat-last-message-container">
                                    <div className="chat-last-message">
                                        {getSenderPrefix(chat)}
                                        {getMessageStatusIndicator(chat.last_message)}
                                        {formatLastMessage(chat.last_message)}
                                    </div>
                                    {unreadCounts[chat.id] > 0 && (
                                        <div className="unread-count">
                                            {unreadCounts[chat.id]}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="chat-meta">
                                {chat.last_message && (
                                    <div className="chat-time">
                                        {formatDate(chat.last_message.created_at)}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="no-chats">
                        {searchQuery ? 'Нет результатов поиска' : 'У вас пока нет сообщений'}
                    </div>
                )}
            </div>
            
            {/* Модальное окно выбора друга для нового чата */}
            {showFriendsList && (
                <div className="friends-modal-overlay" onClick={() => setShowFriendsList(false)}>
                    <div className="friends-modal-content" onClick={e => e.stopPropagation()}>
                        <h3>Выберите друга для чата</h3>
                        
                        {loadingFriends ? (
                            <div className="loading-friends">Загрузка списка друзей...</div>
                        ) : (
                            <div className="friends-list">
                                {friends.length > 0 ? (
                                    friends.map(friend => (
                                        <div 
                                            key={friend.id} 
                                            className="friend-item"
                                            onClick={() => handleFriendSelect(friend.friend.id)}
                                        >
                                            <img 
                                                src={friend.friend.avatar_url || '/default-avatar.png'} 
                                                alt={friend.friend.username} 
                                                className="friend-avatar" 
                                            />
                                            <span className="friend-username">{friend.friend.username}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="no-friends">
                                        У вас пока нет друзей. Добавьте друзей в профиле.
                                    </div>
                                )}
                            </div>
                        )}
                        
                        <button 
                            className="close-friends-modal" 
                            onClick={() => setShowFriendsList(false)}
                        >
                            Закрыть
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ChatList; 