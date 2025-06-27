import React, { useState } from 'react';
import axios from 'axios';
import './InteractiveMessage.css';

const InteractiveMessage = ({ message, metadata, onActionComplete }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [actionResult, setActionResult] = useState(null);

    // Обработка нажатия на кнопку действия
    const handleActionClick = async (action) => {
        setIsProcessing(true);
        
        try {
            if (action.url && action.target === '_blank') {
                // Открываем ссылку в новой вкладке
                window.open(action.url, '_blank');
                setIsProcessing(false);
                return;
            }
            
            if (action.endpoint) {
                // Выполняем API запрос
                const response = await axios.post(action.endpoint, {}, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                
                setActionResult({
                    type: 'success',
                    message: response.data.message || 'Действие выполнено успешно'
                });
                
                // Уведомляем родительский компонент
                if (onActionComplete) {
                    onActionComplete(action.type, response.data);
                }
            }
        } catch (error) {
            console.error('Ошибка выполнения действия:', error);
            setActionResult({
                type: 'error',
                message: error.response?.data?.message || 'Ошибка выполнения действия'
            });
        } finally {
            setIsProcessing(false);
        }
    };

    // Проверяем, истекло ли приглашение
    const isExpired = metadata?.expires_at && new Date(metadata.expires_at) < new Date();

    // Форматируем сообщение с поддержкой Markdown
    const formatMessage = (text) => {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
            .replace(/\n/g, '<br/>');
    };

    return (
        <div className="interactive-message">
            <div className="message-content">
                <div 
                    className="message-text"
                    dangerouslySetInnerHTML={{ __html: formatMessage(message) }}
                />
                
                {actionResult && (
                    <div className={`action-result ${actionResult.type}`}>
                        {actionResult.message}
                    </div>
                )}
                
                {isExpired && (
                    <div className="expiration-notice">
                        ⏰ Срок действия приглашения истек
                    </div>
                )}
                
                {metadata?.actions && !isExpired && !actionResult && (
                    <div className="message-actions">
                        {metadata.actions.map((action, index) => (
                            <button
                                key={index}
                                className={`action-btn ${action.style || 'primary'}`}
                                onClick={() => handleActionClick(action)}
                                disabled={isProcessing}
                            >
                                {isProcessing && action.endpoint ? (
                                    <span className="loading-spinner">⏳</span>
                                ) : null}
                                {action.label}
                            </button>
                        ))}
                    </div>
                )}
                
                {metadata?.expires_at && !isExpired && (
                    <div className="expiration-info">
                        ⏰ Истекает: {new Date(metadata.expires_at).toLocaleDateString('ru-RU', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default InteractiveMessage; 