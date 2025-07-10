import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Register.css';

function Register() {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const validatePasswords = () => {
        if (formData.password !== formData.confirmPassword) {
            setMessage('Пароли не совпадают');
            return false;
        }
        if (formData.password.length < 6) {
            setMessage('Пароль должен содержать минимум 6 символов');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        
        if (!validatePasswords()) {
            return;
        }

        setIsLoading(true);

        try {
            // Используем относительный путь для API
            const response = await axios.post('/api/users/register', {
                username: formData.username,
                email: formData.email,
                password: formData.password
            });

            setShowSuccessModal(true);
        } catch (error) {
            setMessage(error.response?.data?.message || 'Произошла ошибка при регистрации');
        } finally {
            setIsLoading(false);
        }
    };

    const handleModalClose = () => {
        setShowSuccessModal(false);
        navigate('/');
    };

    return (
        <div className="register-container">
            <h2>Регистрация</h2>
            <form onSubmit={handleSubmit}>
                <div>
                    <label>Имя пользователя:</label>
                    <input
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div>
                    <label>Email:</label>
                    <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div>
                    <label>Пароль:</label>
                    <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div>
                    <label>Подтвердите пароль:</label>
                    <input
                        type="password"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        required
                    />
                </div>
                <button type="submit" disabled={isLoading}>
                    {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
                </button>
            </form>
            {message && <p className="message">{message}</p>}

            {/* Success Modal */}
            {showSuccessModal && (
                <div className="modal-overlay" onClick={handleModalClose}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Поздравляем!</h3>
                        <p>Регистрация прошла успешно!</p>
                        <p>На ваш email отправлено приветственное письмо с данными аккаунта.</p>
                        <button onClick={handleModalClose}>Продолжить</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Register;