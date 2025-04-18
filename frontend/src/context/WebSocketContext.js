import React, { createContext, useContext, useState, useEffect } from 'react';

const WebSocketContext = createContext();

export const useWebSocket = () => {
    return useContext(WebSocketContext);
};

export const WebSocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);
    const [userId, setUserId] = useState(null);

    // Инициализация WebSocket соединения
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            // Получаем userId из JWT токена
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            
            const decodedToken = JSON.parse(jsonPayload);
            if (decodedToken.id) {
                setUserId(decodedToken.id);
            }
        } catch (error) {
            console.error('Ошибка при декодировании токена:', error);
            return;
        }

        // Определение корректного адреса WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = process.env.REACT_APP_API_URL 
                    ? new URL(process.env.REACT_APP_API_URL).host 
                    : window.location.host;
        const wsURL = `${protocol}//${host}/ws`;

        // Создание WebSocket соединения
        const ws = new WebSocket(wsURL);

        // Обработчики событий WebSocket
        ws.onopen = () => {
            console.log('WebSocket соединение установлено');
            setConnected(true);
            setSocket(ws);
            
            // Отправляем сообщение о регистрации пользователя
            if (decodedToken.id) {
                ws.send(JSON.stringify({ 
                    type: 'register', 
                    userId: decodedToken.id 
                }));
            }
        };

        ws.onclose = () => {
            console.log('WebSocket соединение закрыто');
            setConnected(false);
            setSocket(null);
        };

        ws.onerror = (error) => {
            console.error('Ошибка WebSocket:', error);
        };

        // Очистка при размонтировании
        return () => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, []);

    // Функция для отправки сообщений
    const sendMessage = (message) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket не подключен');
        }
    };

    // Значение контекста
    const value = {
        socket,
        connected,
        userId,
        sendMessage
    };

    return (
        <WebSocketContext.Provider value={value}>
            {children}
        </WebSocketContext.Provider>
    );
}; 