import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import './Toast.css';

// Создаем контекст
const ToastContext = createContext();

// Компонент Toast
const Toast = ({ id, type, message, onClose }) => {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose(id);
    }, 300); // Задержка для анимации
  }, [id, onClose]);

  // Автоматическое закрытие через 3 секунды
  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [handleClose]);

  return (
    <div className={`toast ${isClosing ? 'closing' : ''} toast-${type}`}>
      <span>{message}</span>
      <button className="toast-close" onClick={handleClose}>×</button>
    </div>
  );
};

// Провайдер для контекста уведомлений
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  // Добавление нового уведомления
  const addToast = useCallback((type, message) => {
    const id = Date.now();
    setToasts(prevToasts => [...prevToasts, { id, type, message }]);
    return id;
  }, []);

  // Удаление уведомления
  const removeToast = useCallback(id => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  }, []);

  // Функции для различных типов уведомлений
  const success = useCallback((message) => addToast('success', message), [addToast]);
  const error = useCallback((message) => addToast('error', message), [addToast]);
  const info = useCallback((message) => addToast('info', message), [addToast]);
  const warning = useCallback((message) => addToast('warning', message), [addToast]);

  return (
    <ToastContext.Provider value={{ success, error, info, warning }}>
      {children}
      <div className="toast-container">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            id={toast.id}
            type={toast.type}
            message={toast.message}
            onClose={removeToast}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// Хук для использования уведомлений в компонентах
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}; 