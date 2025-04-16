import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './components/Home';
import TournamentDetails from './components/TournamentDetails';
import TournamentsPage from './pages/TournamentsPage';
import Layout from './components/Layout'; // Импортируем Layout как корневой компонент
import Profile from './components/Profile'; // Добавляем импорт Profile
import CreateTournament from './components/CreateTournament'; // Импортируем компонент CreateTournament
import AuthPage from './pages/AuthPage'; // Добавляем импорт нового компонента

function App() {
    return (
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
                </Route>
            </Routes>
        </Router>
    );
}

export default App;