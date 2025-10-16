import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import HomePage from './pages/HomePage'; // Заменяем Home на HomePage
import TournamentDetails from './components/TournamentDetails';
import TournamentsPage from './pages/TournamentsPage';
import Layout from './components/Layout'; // Импортируем Layout как корневой компонент
import FullMixDraftPage from './pages/FullMixDraftPage';
import BracketSharePage from './pages/BracketSharePage';
import Profile from './components/Profile'; // Добавляем импорт Profile
import UserProfile from './components/UserProfile'; // Импортируем компонент UserProfile
import OrganizerProfile from './components/OrganizerProfile'; // Импортируем компонент OrganizerProfile
import CreateTournamentEntry from './pages/CreateTournamentEntry'; // 🆕 Новая точка входа для создания турниров (Wizard + Ручная настройка)
import AdminPanel from './components/AdminPanel'; // Импортируем компонент AdminPanel
import AuthPage from './pages/AuthPage'; // Добавляем импорт нового компонента
import ForgotPasswordPage from './pages/ForgotPasswordPage'; // Импорт страницы восстановления пароля
import ResetPasswordPage from './pages/ResetPasswordPage'; // Импорт страницы сброса пароля
import { LoaderProvider } from './context/LoaderContext';
import { AuthProvider, useAuth } from './context/AuthContext'; // Импортируем AuthProvider и useAuth
import { UserProvider } from './context/UserContext'; // Импортируем UserProvider
import { PrivateRoute } from './utils/PrivateRoute';
import { AdminRoute } from './utils/AdminRoute';
import Messenger from './components/Messenger';
import SocketTest from './components/SocketTest';
import MatchLobbyPage from './components/tournament/MatchLobby/MatchLobbyPage'; // Импортируем компонент лобби
import MatchDetailsPage from './components/tournament/MatchDetailsPage'; // Импортируем страницу деталей матча
import TeamProfile from './components/tournament/TeamProfile';
import ReferralLanding from './pages/ReferralLanding';
import MyTournaments from './pages/MyTournaments';
import TournamentRulesPage from './pages/TournamentRulesPage';
import { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import AdminMatchPage from './pages/AdminMatchPage';
import CustomMatchPage from './pages/CustomMatchPage';
import GlobalLeaderboardPage from './pages/GlobalLeaderboardPage';

// 🔍 ДИАГНОСТИЧЕСКОЕ ЛОГИРОВАНИЕ
console.log('🚨 [App.js] MatchLobbyPage импортирован:', !!MatchLobbyPage);

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

// Главная страница теперь доступна всем пользователям
// HomeGate удален - HomePage открыта для всех

function App() {
    return (
        <LoaderProvider>
            <AuthProvider>
                <UserProvider>
                    <SkeletonTheme baseColor="#111111" highlightColor="#1a1a1a" duration={1.2}>
                    <Router>
                        <Routes>
                            <Route path="/" element={<Layout />}>
                                <Route index element={<HomePage />} /> {/* Главная страница доступна всем */}
                                <Route path="/tournaments" element={<TournamentsPage />} />
                                <Route path="/tournaments/:id" element={<TournamentDetails />} />
                                <Route path="/tournaments/:id/fullmix/draft" element={<PrivateRoute component={FullMixDraftPage} />} />
                                <Route path="/tournaments/:tournamentId/match/:matchId" element={<MatchDetailsPage />} />
                                <Route path="/register" element={<RegisterRedirect />} />
                                <Route path="/login" element={<AuthPage />} /> {/* Добавляем маршрут для входа */}
                                <Route path="/auth" element={<AuthPage />} /> {/* Добавляем новый маршрут для страницы авторизации */}
                                <Route path="/forgot-password" element={<ForgotPasswordPage />} /> {/* Маршрут для восстановления пароля */}
                                <Route path="/reset-password" element={<ResetPasswordPage />} /> {/* Маршрут для сброса пароля */}
                                <Route path="/profile" element={<PrivateRoute component={Profile} />} /> {/* Маршрут для своего профиля */}
                                <Route path="/teams/:teamId" element={<TeamProfile />} />
                                <Route path="/user/:userId" element={<UserProfile />} /> {/* Публичный профиль пользователя */}
                                <Route path="/organizer/:slug" element={<OrganizerProfile />} /> {/* Маршрут для профиля организатора */}
                                <Route path="/create" element={<CreateTournamentEntry />} /> {/* 🆕 Новая точка входа: Wizard + Ручная настройка */}
                                <Route path="/messages" element={<PrivateRoute component={Messenger} />} />
                                <Route path="/admin" element={<PrivateRoute component={AdminPanel} />} /> {/* Добавляем маршрут для админ панели */}
                                <Route path="/socket-test" element={<PrivateRoute component={SocketTest} />} /> {/* Тестирование Socket.IO */}
                                <Route path="/auth-callback" element={<AuthCallback />} />
                                <Route path="/auth-error" element={<Navigate to="/login" />} />
                                <Route path="/lobby/:lobbyId" element={<PrivateRoute component={MatchLobbyPage} />} /> {/* Маршрут для лобби матча */}
                                <Route path="/invite/:referralCode" element={<ReferralLanding />} />
                                <Route path="/tournaments/:id/rules" element={<TournamentRulesPage />} />
                                <Route path="/my-tournaments" element={<PrivateRoute component={MyTournaments} />} />
                                <Route path="/admin/match" element={<PrivateRoute component={AdminMatchPage} />} />
                                <Route path="/matches/custom/:id" element={<PrivateRoute component={CustomMatchPage} />} />
                                <Route path="/leaderboard" element={<AdminRoute component={GlobalLeaderboardPage} />} />
                            </Route>
                            {/* Страница шеринга сетки без Layout (без хедера) */}
                            <Route path="/tournaments/:id/bracket" element={<BracketSharePage />} />
                        </Routes>
                    </Router>
                    </SkeletonTheme>
                </UserProvider>
            </AuthProvider>
        </LoaderProvider>
    );
}

export default App;

// Сохраняем query-параметры (включая ?referral=) при редиректе на /auth и добавляем register=true
function RegisterRedirect() {
    const location = useLocation();
    const params = new URLSearchParams(location.search || '');
    if (!params.has('register')) params.set('register', 'true');
    const search = params.toString();
    return <Navigate to={`/auth${search ? `?${search}` : ''}`} replace />;
}