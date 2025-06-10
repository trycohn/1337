import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Home.css';

function Home() {
    const { user } = useAuth(); // Получаем пользователя из AuthContext

    return (
        <div className="home-container">
            <main>
                <section>
                    <h2>Добро пожаловать на главную страницу!</h2>
                    <h3>Пока сайт работает в тестовом режиме, функциональность ограничена.</h3>
                    <p>Здесь будет другой контент, например, новости, статистика или анонсы турниров. </p>
                    <p>
                        Чтобы посмотреть список турниров, перейдите в{' '}
                        <Link to="/tournaments">раздел Турниры</Link>.
                    </p>
                    {user && <p>Привет, {user.username}! Ваша авторизация активна.</p>}
                </section>
            </main>
        </div>
    );
}

export default Home;