import React from 'react';
import { Navigate } from 'react-router-dom';

export const PrivateRoute = ({ component: Component, ...rest }) => {
    const token = localStorage.getItem('token');
    
    console.log('🚨 [PrivateRoute] Проверка:', {
        hasToken: !!token,
        componentName: Component?.name,
        rest
    });
    
    if (!token) {
        console.log('🚨 [PrivateRoute] НЕТ ТОКЕНА - редирект на /login');
        // Если пользователь не авторизован, перенаправляем на страницу логина
        return <Navigate to="/login" replace />;
    }
    
    console.log('🚨 [PrivateRoute] ТОКЕН ЕСТЬ - рендерим компонент:', Component?.name);
    // Иначе рендерим запрошенный компонент
    return <Component {...rest} />;
}; 