/**
 * 🔒 ADMIN ROUTE
 * Защищенный маршрут только для админов платформы
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';

export const AdminRoute = ({ component: Component, ...rest }) => {
    const { user } = useUser();
    const token = localStorage.getItem('token');
    
    // Если не авторизован - редирект на логин
    if (!token) {
        return <Navigate to="/login" replace />;
    }
    
    // Проверяем роль админа (поддержка старой и новой системы ролей)
    const isAdmin = user?.role === 'admin' || user?.roles?.includes('platform_admin');
    
    // Если не админ - редирект на главную
    if (!isAdmin) {
        return <Navigate to="/tournaments" replace />;
    }
    
    // Иначе рендерим компонент
    return <Component {...rest} />;
};

