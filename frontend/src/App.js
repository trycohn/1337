import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Home from './components/Home';
import TournamentDetails from './components/TournamentDetails';
import TournamentsPage from './pages/TournamentsPage';
import Layout from './components/Layout'; // Импортируем Layout как корневой компонент
import Profile from './components/Profile'; // Добавляем импорт Profile
import CreateTournament from './components/CreateTournament'; // Импортируем компонент CreateTournament
import AuthPage from './pages/AuthPage'; // Добавляем импорт нового компонента
import { LoaderProvider } from './context/LoaderContext';

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
            <Router>
                <Routes>
                    <Route path="/" element={<Layout />}>
                        <Route index element={<Home />} />
                        <Route path="/tournaments" element={<TournamentsPage />} />
                        <Route path="/tournaments/:id" element={<TournamentDetails />} />
                        <Route path="/register" element={<Navigate to="/auth?register=true" replace />} />
                        <Route path="/auth" element={<AuthPage />} /> {/* Добавляем новый маршрут для страницы авторизации */}
                        <Route path="/profile" element={<Profile />} /> {/* Добавляем маршрут для профиля */}
                        <Route path="/create" element={<CreateTournament />} /> {/* Добавляем маршрут для создания турнира */}
                        <Route path="/auth-callback" element={<AuthCallback />} />
                        <Route path="/auth-error" element={<Navigate to="/login" />} />
                    </Route>
                </Routes>
            </Router>
        </LoaderProvider>
    );
}

export default App;