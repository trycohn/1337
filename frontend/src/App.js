import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import TournamentDetails from './components/TournamentDetails';
import TournamentsPage from './pages/TournamentsPage';
import Layout from './components/Layout'; // Импортируем Layout как корневой компонент
import Profile from './components/Profile'; // Добавляем импорт Profile

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Home />} />
                    <Route path="/tournaments" element={<TournamentsPage />} />
                    <Route path="/tournaments/:id" element={<TournamentDetails />} />
                    <Route path="/register" element={<div>Страница регистрации</div>} /> {/* Пример для ссылки */}
                    <Route path="/profile" element={<Profile />} /> {/* Добавляем маршрут для профиля */}
                </Route>
            </Routes>
        </Router>
    );
}

export default App;