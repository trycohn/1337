import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';
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
    const [validationErrors, setValidationErrors] = useState({});
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });

        // Очищаем ошибку для поля при изменении
        if (validationErrors[name]) {
            setValidationErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }

        // Очищаем общее сообщение об ошибке
        if (message) {
            setMessage('');
        }
    };

    // Валидация email формата
    const validateEmail = (email) => {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email);
    };

    // Продвинутая валидация пароля
    const validatePassword = (password) => {
        const errors = [];
        
        if (password.length < 8) {
            errors.push('Пароль должен содержать минимум 8 символов');
        }
        
        if (!/[A-Z]/.test(password)) {
            errors.push('Пароль должен содержать заглавные буквы');
        }
        
        if (!/[a-z]/.test(password)) {
            errors.push('Пароль должен содержать строчные буквы');
        }
        
        if (!/\d/.test(password)) {
            errors.push('Пароль должен содержать цифры');
        }
        
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('Пароль должен содержать специальные символы');
        }
        
        if (/\s/.test(password)) {
            errors.push('Пароль не должен содержать пробелы');
        }
        
        return errors;
    };

    // Валидация всей формы
    const validateForm = () => {
        const errors = {};
        
        // Проверка имени пользователя
        if (!formData.username.trim()) {
            errors.username = 'Имя пользователя обязательно';
        } else if (formData.username.length < 3) {
            errors.username = 'Имя пользователя должно содержать минимум 3 символа';
        } else if (formData.username.length > 20) {
            errors.username = 'Имя пользователя не должно превышать 20 символов';
        } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
            errors.username = 'Имя пользователя может содержать только буквы, цифры, _ и -';
        }
        
        // Проверка email
        if (!formData.email.trim()) {
            errors.email = 'Email обязателен';
        } else if (!validateEmail(formData.email)) {
            errors.email = 'Введите корректный email адрес';
        }
        
        // Проверка пароля
        const passwordErrors = validatePassword(formData.password);
        if (passwordErrors.length > 0) {
            errors.password = passwordErrors[0]; // Показываем первую ошибку
        }
        
        // Проверка подтверждения пароля
        if (!formData.confirmPassword) {
            errors.confirmPassword = 'Подтвердите пароль';
        } else if (formData.password !== formData.confirmPassword) {
            errors.confirmPassword = 'Пароли не совпадают';
        }
        
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        
        if (!validateForm()) {
            return;
        }

        setIsLoading(true);

        try {
            const response = await axios.post('/api/users/register', {
                username: formData.username.trim(),
                email: formData.email.trim().toLowerCase(),
                password: formData.password
            });

            setShowSuccessModal(true);
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Произошла ошибка при регистрации';
            setMessage(errorMessage);
            
            // Обработка специфических ошибок сервера
            if (error.response?.data?.field) {
                setValidationErrors(prev => ({
                    ...prev,
                    [error.response.data.field]: errorMessage
                }));
            }
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
            <div className="register-form-wrapper">
                <div className="register-header">
                    <h2>Создание аккаунта</h2>
                    <p>Присоединяйтесь к сообществу 1337</p>
                </div>

                <form onSubmit={handleSubmit} className="register-form">
                    {/* Имя пользователя */}
                    <div className="form-group">
                        <label htmlFor="username">Имя пользователя</label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            className={validationErrors.username ? 'error' : ''}
                            placeholder="Введите имя пользователя"
                            maxLength="20"
                            required
                        />
                        {validationErrors.username && (
                            <div className="field-error">{validationErrors.username}</div>
                        )}
                    </div>

                    {/* Email */}
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className={validationErrors.email ? 'error' : ''}
                            placeholder="example@domain.com"
                            required
                        />
                        {validationErrors.email && (
                            <div className="field-error">{validationErrors.email}</div>
                        )}
                    </div>

                    {/* Пароль */}
                    <div className="form-group">
                        <label htmlFor="password">Пароль</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            className={validationErrors.password ? 'error' : ''}
                            placeholder="Введите надежный пароль"
                            required
                        />
                        {validationErrors.password && (
                            <div className="field-error">{validationErrors.password}</div>
                        )}
                        
                        {/* Индикатор силы пароля */}
                        <PasswordStrengthIndicator 
                            password={formData.password}
                            confirmPassword={formData.confirmPassword}
                        />
                    </div>

                    {/* Подтверждение пароля */}
                    <div className="form-group">
                        <label htmlFor="confirmPassword">Подтвердите пароль</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            className={validationErrors.confirmPassword ? 'error' : ''}
                            placeholder="Повторите пароль"
                            required
                        />
                        {validationErrors.confirmPassword && (
                            <div className="field-error">{validationErrors.confirmPassword}</div>
                        )}
                    </div>

                    {/* Кнопка регистрации */}
                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className={`register-button ${isLoading ? 'loading' : ''}`}
                    >
                        {isLoading ? (
                            <>
                                <span className="loading-spinner"></span>
                                Создание аккаунта...
                            </>
                        ) : (
                            'Создать аккаунт'
                        )}
                    </button>

                    {/* Общее сообщение об ошибке */}
                    {message && (
                        <div className="general-error">
                            {message}
                        </div>
                    )}
                </form>

                <div className="register-footer">
                    <p>
                        Уже есть аккаунт? <a href="/login">Войти</a>
                    </p>
                </div>
            </div>

            {/* Модальное окно успеха */}
            {showSuccessModal && (
                <div className="modal-overlay success-modal" onClick={handleModalClose}>
                    <div className="modal-content success-content" onClick={(e) => e.stopPropagation()}>
                        <div className="success-icon">
                            <div className="checkmark">
                                <div className="checkmark-circle"></div>
                                <div className="checkmark-stem"></div>
                                <div className="checkmark-kick"></div>
                            </div>
                        </div>
                        
                        <h3>Поздравляем!</h3>
                        <p>Ваш аккаунт успешно создан!</p>
                        <p className="success-details">
                            На email <strong>{formData.email}</strong> отправлено приветственное письмо с данными аккаунта.
                        </p>
                        
                        <div className="success-actions">
                            <button onClick={handleModalClose} className="success-button">
                                Продолжить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Register;