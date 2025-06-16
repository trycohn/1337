import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Home from './components/Home';
import TournamentDetails from './components/TournamentDetails';
import TournamentsPage from './pages/TournamentsPage';
import Layout from './components/Layout'; // Импортируем Layout как корневой компонент
import Profile from './components/Profile'; // Добавляем импорт Profile
import UserProfile from './components/UserProfile'; // Импортируем компонент UserProfile
import OrganizerProfile from './components/OrganizerProfile'; // Импортируем компонент OrganizerProfile
import CreateTournament from './components/CreateTournament'; // Импортируем компонент CreateTournament
import AdminPanel from './components/AdminPanel'; // Импортируем компонент AdminPanel
import AuthPage from './pages/AuthPage'; // Добавляем импорт нового компонента
import ForgotPasswordPage from './pages/ForgotPasswordPage'; // Импорт страницы восстановления пароля
import ResetPasswordPage from './pages/ResetPasswordPage'; // Импорт страницы сброса пароля
import { LoaderProvider } from './context/LoaderContext';
import { AuthProvider } from './context/AuthContext'; // Импортируем AuthProvider
import { UserProvider } from './context/UserContext'; // Импортируем UserProvider
import { PrivateRoute } from './utils/PrivateRoute';
import Messenger from './components/Messenger';
import SocketTest from './components/SocketTest';

// Компонент для обработки аутентификации через Steam
function AuthCallback() {
    const location = useLocation();
    const navigate = useNavigate();
    
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const token = searchParams.get('token');
        
        if (token) {
            localStorage.setItem('token', token);
            navigate('/');
        } else {
            const errorMessage = searchParams.get('message');
            if (errorMessage) {
                navigate(`/login?error=${errorMessage}`);
            } else {
                navigate('/login');
            }
        }
    }, [location, navigate]);
    
    return <div>Авторизация...</div>;
}

function App() {
    return (
        <LoaderProvider>
            <AuthProvider>
                <UserProvider>
                    <Router>
                        <Routes>
                            <Route path="/" element={<Layout />}>
                                <Route index element={<Home />} />
                                <Route path="/tournaments" element={<TournamentsPage />} />
                                <Route path="/tournaments/:id" element={<TournamentDetails />} />
                                <Route path="/register" element={<Navigate to="/auth?register=true" replace />} />
                                <Route path="/login" element={<AuthPage />} /> {/* Добавляем маршрут для входа */}
                                <Route path="/auth" element={<AuthPage />} /> {/* Добавляем новый маршрут для страницы авторизации */}
                                <Route path="/forgot-password" element={<ForgotPasswordPage />} /> {/* Маршрут для восстановления пароля */}
                                <Route path="/reset-password" element={<ResetPasswordPage />} /> {/* Маршрут для сброса пароля */}
                                <Route path="/profile" element={<PrivateRoute component={Profile} />} /> {/* Маршрут для своего профиля */}
                                <Route path="/user/:userId" element={<PrivateRoute component={UserProfile} />} /> {/* Маршрут для просмотра профиля по ID */}
                                <Route path="/organizer/:slug" element={<OrganizerProfile />} /> {/* Маршрут для профиля организатора */}
                                <Route path="/create" element={<CreateTournament />} /> {/* Добавляем маршрут для создания турнира */}
                                <Route path="/messages" element={<PrivateRoute component={Messenger} />} />
                                <Route path="/admin" element={<PrivateRoute component={AdminPanel} />} /> {/* Добавляем маршрут для админ панели */}
                                <Route path="/socket-test" element={<PrivateRoute component={SocketTest} />} /> {/* Тестирование Socket.IO */}
                                <Route path="/auth-callback" element={<AuthCallback />} />
                                <Route path="/auth-error" element={<Navigate to="/login" />} />
                            </Route>
                        </Routes>
                    </Router>
                </UserProvider>
            </AuthProvider>
        </LoaderProvider>
    );
}

export default App;