import React from 'react';
import './PasswordStrengthIndicator.css';

function PasswordStrengthIndicator({ password, confirmPassword }) {
    // Функция для анализа силы пароля
    const analyzePasswordStrength = (password) => {
        if (!password) {
            return { score: 0, level: 'none', feedback: [], checks: {} };
        }

        let score = 0;
        const feedback = [];
        const checks = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            numbers: /\d/.test(password),
            noSpaces: !/\s/.test(password)
        };

        // Проверка длины (обязательная)
        if (checks.length) {
            score += 30;
            if (password.length >= 12) {
                score += 10; // Бонус за длинный пароль
            }
        } else {
            feedback.push('Увеличьте длину пароля до 8+ символов');
        }

        // Проверка заглавных букв
        if (checks.uppercase) {
            score += 20;
        } else {
            feedback.push('Добавьте заглавные буквы (A-Z)');
        }

        // Проверка строчных букв
        if (checks.lowercase) {
            score += 20;
        } else {
            feedback.push('Добавьте строчные буквы (a-z)');
        }

        // Проверка цифр
        if (checks.numbers) {
            score += 20;
        } else {
            feedback.push('Добавьте цифры (0-9)');
        }

        // Проверка на отсутствие пробелов
        if (checks.noSpaces) {
            score += 10;
        } else {
            feedback.push('Уберите пробелы из пароля');
        }

        // Определение уровня и цвета
        let level, color, bgColor;
        if (score >= 80) {
            level = 'Отличный';
            color = '#4CAF50';
            bgColor = '#4CAF50';
        } else if (score >= 60) {
            level = 'Хороший';
            color = '#8BC34A';
            bgColor = '#8BC34A';
        } else if (score >= 40) {
            level = 'Средний';
            color = '#FF9800';
            bgColor = '#FF9800';
        } else if (score >= 20) {
            level = 'Слабый';
            color = '#FF5722';
            bgColor = '#FF5722';
        } else {
            level = 'Очень слабый';
            color = '#F44336';
            bgColor = '#F44336';
        }

        return { 
            score: Math.min(score, 100), // Максимум 100%
            level, 
            color,
            bgColor,
            feedback,
            checks
        };
    };

    const strength = analyzePasswordStrength(password);
    const passwordsMatch = password && confirmPassword && password === confirmPassword;

    // Определение цвета и текста для полосы прогресса
    const getStrengthColor = () => {
        switch (strength.level) {
            case 'strong':
                return '#4CAF50'; // Зеленый
            case 'medium':
                return '#FF9800'; // Оранжевый
            case 'weak':
                return '#F44336'; // Красный
            default:
                return '#E0E0E0'; // Серый
        }
    };

    const getStrengthText = () => {
        switch (strength.level) {
            case 'strong':
                return 'Надежный пароль';
            case 'medium':
                return 'Средний пароль';
            case 'weak':
                return 'Слабый пароль';
            default:
                return 'Введите пароль';
        }
    };

    const getStrengthWidth = () => {
        const maxScore = 7;
        return Math.min((strength.score / maxScore) * 100, 100);
    };

    if (!password) {
        return null;
    }

    return (
        <div className="password-strength-indicator">
            {password && (
                <>
                    {/* Полоса силы пароля */}
                    <div className="strength-bar-container">
                        <div 
                            className="strength-bar"
                            style={{
                                width: `${strength.score}%`,
                                backgroundColor: strength.bgColor || '#E0E0E0'
                            }}
                        />
                    </div>

                    {/* Текст уровня силы */}
                    <div 
                        className="strength-text"
                        style={{ color: strength.color || '#757575' }}
                    >
                        Сила пароля: {strength.level} ({strength.score}%)
                    </div>

                    {/* Требования к паролю */}
                    <div className="password-requirements">
                        <div className={`requirement ${strength.checks.length ? 'met' : 'unmet'}`}>
                            <span className="requirement-icon">
                                {strength.checks.length ? '✓' : '○'}
                            </span>
                            <span>Минимум 8 символов</span>
                        </div>
                        <div className={`requirement ${strength.checks.uppercase ? 'met' : 'unmet'}`}>
                            <span className="requirement-icon">
                                {strength.checks.uppercase ? '✓' : '○'}
                            </span>
                            <span>Заглавные буквы (A-Z)</span>
                        </div>
                        <div className={`requirement ${strength.checks.lowercase ? 'met' : 'unmet'}`}>
                            <span className="requirement-icon">
                                {strength.checks.lowercase ? '✓' : '○'}
                            </span>
                            <span>Строчные буквы (a-z)</span>
                        </div>
                        <div className={`requirement ${strength.checks.numbers ? 'met' : 'unmet'}`}>
                            <span className="requirement-icon">
                                {strength.checks.numbers ? '✓' : '○'}
                            </span>
                            <span>Цифры (0-9)</span>
                        </div>
                        <div className={`requirement ${strength.checks.noSpaces ? 'met' : 'unmet'}`}>
                            <span className="requirement-icon">
                                {strength.checks.noSpaces ? '✓' : '○'}
                            </span>
                            <span>Без пробелов</span>
                        </div>
                    </div>

                    {/* Совпадение паролей */}
                    {confirmPassword && (
                        <div className={`password-match ${
                            password === confirmPassword ? 'match' : 'no-match'
                        }`}>
                            <span style={{ marginRight: '8px' }}>
                                {password === confirmPassword ? '✓' : '✗'}
                            </span>
                            {password === confirmPassword 
                                ? 'Пароли совпадают' 
                                : 'Пароли не совпадают'
                            }
                        </div>
                    )}

                    {/* Обратная связь */}
                    {strength.feedback.length > 0 && (
                        <div className="password-feedback">
                            <div className="feedback-title">💡 Рекомендации:</div>
                            <ul className="feedback-list">
                                {strength.feedback.map((tip, index) => (
                                    <li key={index} className="feedback-item">{tip}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default PasswordStrengthIndicator; 