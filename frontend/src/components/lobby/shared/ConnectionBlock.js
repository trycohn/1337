// 🔗 ConnectionBlock - Блок подключения к серверу
import React, { useState } from 'react';
import './ConnectionBlock.css';

function ConnectionBlock({ 
    connectUrl, 
    gotvUrl, 
    serverLocation = null,
    status = 'waiting', // 'waiting' | 'ready' | 'active'
    matchPageUrl = null
}) {
    const [copied, setCopied] = useState({ connect: false, gotv: false });

    const handleCopy = async (text, type) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(prev => ({ ...prev, [type]: true }));
            setTimeout(() => {
                setCopied(prev => ({ ...prev, [type]: false }));
            }, 2000);
        } catch (err) {
            console.error('Ошибка копирования:', err);
        }
    };

    const handleSteamConnect = (url) => {
        window.location.href = url;
    };

    if (status === 'waiting') {
        return (
            <div className="connection-block waiting">
                <div className="connection-status">
                    <span className="status-icon">⏳</span>
                    <span className="status-text">Ожидание завершения выбора карт...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="connection-block active">
            <div className="connection-header">
                <h3>🎮 Подключение к серверу</h3>
                {serverLocation && (
                    <span className="server-location">📍 {serverLocation}</span>
                )}
            </div>

            {connectUrl && (
                <div className="connection-item">
                    <label>Игроки:</label>
                    <div className="connection-actions">
                        <button 
                            className="btn-connect"
                            onClick={() => handleSteamConnect(connectUrl)}
                        >
                            🎮 Подключиться
                        </button>
                        <button 
                            className="btn-copy"
                            onClick={() => handleCopy(connectUrl, 'connect')}
                        >
                            {copied.connect ? '✅ Скопировано' : '📋 Копировать'}
                        </button>
                    </div>
                    <input 
                        type="text" 
                        value={connectUrl} 
                        readOnly 
                        className="connection-url"
                    />
                </div>
            )}

            {gotvUrl && (
                <div className="connection-item">
                    <label>Наблюдатели (GOTV):</label>
                    <div className="connection-actions">
                        <button 
                            className="btn-connect"
                            onClick={() => handleSteamConnect(gotvUrl)}
                        >
                            👁️ Подключиться
                        </button>
                        <button 
                            className="btn-copy"
                            onClick={() => handleCopy(gotvUrl, 'gotv')}
                        >
                            {copied.gotv ? '✅ Скопировано' : '📋 Копировать'}
                        </button>
                    </div>
                    <input 
                        type="text" 
                        value={gotvUrl} 
                        readOnly 
                        className="connection-url"
                    />
                </div>
            )}

            {matchPageUrl && (
                <div className="connection-match-link">
                    <a href={matchPageUrl} className="btn-match-page">
                        📊 Перейти на страницу матча
                    </a>
                </div>
            )}
        </div>
    );
}

export default ConnectionBlock;

