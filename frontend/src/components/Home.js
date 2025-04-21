import React from 'react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './Home.css';

function Home() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            axios
                .get('/api/users/me', {
                    headers: { Authorization: `Bearer ${token}` },
                })
                .then((response) => {
                    setUser(response.data);
                })
                .catch((error) => {
                    console.error('Ошибка загрузки пользователя:', error);
                });
        }
    }, []);

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