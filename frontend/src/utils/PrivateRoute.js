import React from 'react';
import { Navigate } from 'react-router-dom';

export const PrivateRoute = ({ component: Component, ...rest }) => {
    const token = localStorage.getItem('token');
    
    if (!token) {
        // Если пользователь не авторизован, перенаправляем на страницу логина
        return <Navigate to="/login" replace />;
    }
    
    // Иначе рендерим запрошенный компонент
    return <Component {...rest} />;
}; 