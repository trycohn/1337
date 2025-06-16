import React, { useState, useRef } from 'react';
import './ChatWindow.css';
import Message from './Message';
import { decodeTokenPayload } from '../utils/userHelpers';
import api from '../axios';
import { ensureHttps } from '../utils/userHelpers';

function ChatWindow({ 
    activeChat, 
    messages, 
    newMessage, 
    onInputChange, 
    onSubmit, 
    onKeyPress,
    onSendAttachment,
    messagesEndRef,
    onDeleteMessage,
    onBackToChats,
    isMobile,
    onHideChat
}) {
    const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
    const [showParticipantsModal, setShowParticipantsModal] = useState(false);
    const [participants, setParticipants] = useState([]);
    const [loadingParticipants, setLoadingParticipants] = useState(false);
    const [chatInfo, setChatInfo] = useState(null);
    const fileInputRef = useRef(null);
    
    // Определяем является ли чат турнирным
    const isTournamentChat = () => {
        return activeChat?.type === 'group' && 
               activeChat?.name && 
               activeChat.name.startsWith('Турнир: ');
    };
    
    // Получаем ID турнира из имени чата
    const getTournamentIdFromChat = () => {
        if (!isTournamentChat()) return null;
        
        // Можно попробовать найти турнир по имени
        // Пока возвращаем null, нужно будет добавить поле tournament_id в чаты или найти другой способ
        return null;
    };
    
    // Обработчик клика на заголовок чата (для турнирных чатов)
    const handleHeaderClick = async () => {
        if (!isTournamentChat()) return;
        
        if (showParticipantsModal) {
            setShowParticipantsModal(false);
            return;
        }

        setLoadingParticipants(true);
        try {
            const token = localStorage.getItem('token');
            
            // Нужно найти турнир по названию чата или добавить tournament_id в чаты
            // Пока попробуем найти по названию
            const tournamentName = activeChat.name.replace('Турнир: ', '');
            
            // Получаем список турниров и ищем нужный
            const tournamentsResponse = await api.get('/api/tournaments', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const tournament = tournamentsResponse.data.find(t => t.name === tournamentName);
            
            if (!tournament) {
                console.error('Турнир не найден');
                return;
            }
            
            const response = await api.get(`/api/tournaments/${tournament.id}/chat/participants`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setParticipants(response.data.participants);
            setChatInfo({
                name: response.data.chat_name,
                creator: response.data.tournament_creator,
                totalCount: response.data.total_count
            });
            setShowParticipantsModal(true);
        } catch (error) {
            console.error('Ошибка загрузки участников чата:', error);
        } finally {
            setLoadingParticipants(false);
        }
    };

    const closeParticipantsModal = () => {
        setShowParticipantsModal(false);
    };
    
    // Если нет активного чата, показываем заглушку
    if (!activeChat) {
        return (
            <div className="chat-window empty-chat">
                <div className="select-chat-message">
                    Выберите чат или начните новую беседу
                </div>
            </div>
        );
    }
    
    // Получаем класс статуса онлайн
    const getOnlineStatusClass = () => {
        if (!activeChat.online_status) return '';
        
        if (activeChat.online_status === 'online') {
            return 'status-online';
        } else {
            return 'status-offline';
        }
    };
    
    // Обработчик клика по кнопке прикрепления файла
    const handleAttachmentClick = () => {
        setShowAttachmentOptions(!showAttachmentOptions);
    };
    
    // Обработчик выбора типа вложения
    const handleAttachmentTypeSelect = (type) => {
        fileInputRef.current.setAttribute('data-type', type);
        fileInputRef.current.click();
        setShowAttachmentOptions(false);
    };
    
    // Обработчик выбора файла
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const type = fileInputRef.current.getAttribute('data-type');
        onSendAttachment(file, type);
        
        // Сбрасываем значение input, чтобы можно было выбрать тот же файл снова
        e.target.value = '';
    };
    
    // Группируем сообщения по дате
    const groupMessagesByDate = () => {
        if (!messages.length) return [];
        
        const groups = [];
        let currentGroup = {
            date: new Date(messages[0].created_at).toDateString(),
            messages: [messages[0]]
        };
        
        for (let i = 1; i < messages.length; i++) {
            const messageDate = new Date(messages[i].created_at).toDateString();
            
            if (messageDate === currentGroup.date) {
                currentGroup.messages.push(messages[i]);
            } else {
                groups.push(currentGroup);
                currentGroup = {
                    date: messageDate,
                    messages: [messages[i]]
                };
            }
        }
        
        groups.push(currentGroup);
        return groups;
    };
    
    // Форматирование даты группы сообщений
    const formatGroupDate = (dateString) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === today.toDateString()) {
            return 'Сегодня';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Вчера';
        } else {
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            return `${day}.${month}.${year}`;
        }
    };
    
    const messageGroups = groupMessagesByDate();

    return (
        <div className="chat-window">
            <div className="chat-header">
                {isMobile && (
                    <button className="back-to-chats" onClick={onBackToChats}>
                        Назад
                    </button>
                )}
                <div className="chat-header-avatar">
                    <img 
                        src={ensureHttps(activeChat.avatar_url) || '/default-avatar.png'} 
                        alt={activeChat.name} 
                        className="chat-avatar"
                    />
                </div>
                <div 
                    className="chat-header-info" 
                    onClick={isTournamentChat() ? handleHeaderClick : undefined}
                    style={{ cursor: isTournamentChat() ? 'pointer' : 'default' }}
                >
                    <h2>{activeChat.name}</h2>
                    {loadingParticipants && <span className="loading-indicator">...</span>}
                    {activeChat.online_status && !isTournamentChat() && (
                        <div className={`online-status ${getOnlineStatusClass()}`}>
                            {activeChat.online_status}
                        </div>
                    )}
                    {isTournamentChat() && (
                        <div className="tournament-chat-status">
                            Групповой чат турнира
                        </div>
                    )}
                </div>
                
                {/* Крестик для скрытия чата */}
                {onHideChat && (
                    <button className="hide-chat-btn" onClick={() => onHideChat(activeChat.id)} title="Скрыть чат">
                        ✕
                    </button>
                )}
            </div>
            
            {/* Модальное окно с участниками турнирного чата */}
            {showParticipantsModal && isTournamentChat() && (
                <div className="participants-modal-overlay" onClick={closeParticipantsModal}>
                    <div className="participants-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Участники: {chatInfo?.name}</h3>
                            <button className="close-button" onClick={closeParticipantsModal}>×</button>
                        </div>
                        <div className="modal-content">
                            <div className="participants-count">
                                Участников: {chatInfo?.totalCount}
                            </div>
                            <div className="participants-list">
                                {participants.map((participant) => (
                                    <div key={participant.user_id} className="participant-item">
                                        <div className="participant-avatar">
                                            <img 
                                                src={ensureHttps(participant.avatar_url) || '/default-avatar.png'} 
                                                alt={participant.username}
                                                onError={(e) => {e.target.src = '/default-avatar.png'}}
                                            />
                                        </div>
                                        <div className="participant-info">
                                            <span className="participant-name">{participant.username}</span>
                                            <div className="participant-badges">
                                                {participant.is_creator && (
                                                    <span className="badge creator-badge">Создатель</span>
                                                )}
                                                {participant.is_admin && !participant.is_creator && (
                                                    <span className="badge admin-badge">Админ</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            <div className="chat-messages">
                {messageGroups.map((group, groupIndex) => (
                    <div key={groupIndex} className="message-group">
                        <div className="message-date-separator">
                            <span>{formatGroupDate(group.date)}</span>
                        </div>
                        
                        {group.messages.map((message, messageIndex) => (
                            <Message 
                                key={message.id || messageIndex} 
                                message={message} 
                                isOwn={(() => {
                                    const payload = decodeTokenPayload(localStorage.getItem('token'));
                                    return payload ? message.sender_id === payload.id : false;
                                })()}
                                onDeleteMessage={onDeleteMessage}
                                showUserInfo={isTournamentChat()} // Для турнирных чатов показываем аватарки и ники
                            />
                        ))}
                    </div>
                ))}
                
                {/* Элемент для прокрутки к последнему сообщению */}
                <div ref={messagesEndRef} />
            </div>
            
            {activeChat.name === '1337community' ? (
                <div className="chat-input-area read-only">
                    <span>Чат только для уведомлений</span>
                </div>
            ) : (
            <div className="chat-input-area">
                <form onSubmit={onSubmit}>
                    <div className="attachment-button" onClick={handleAttachmentClick}>
                        <i className="attachment-icon">📎</i>
                        
                        {showAttachmentOptions && (
                            <div className="attachment-options">
                                <div className="attachment-option" onClick={() => handleAttachmentTypeSelect('image')}>
                                    <i>📷</i> Фото
                                </div>
                                <div className="attachment-option" onClick={() => handleAttachmentTypeSelect('document')}>
                                    <i>📄</i> Документ
                                </div>
                                <div className="attachment-option" onClick={() => handleAttachmentTypeSelect('file')}>
                                    <i>📁</i> Файл
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        style={{ display: 'none' }} 
                        onChange={handleFileSelect}
                    />
                    
                    <input 
                        type="text" 
                        placeholder="Введите сообщение..." 
                        value={newMessage}
                        onChange={onInputChange}
                        onKeyPress={onKeyPress}
                    />
                    
                    <button type="submit">
                        <span>➤</span>
                    </button>
                </form>
            </div>
            )}
        </div>
    );
}

export default ChatWindow; 