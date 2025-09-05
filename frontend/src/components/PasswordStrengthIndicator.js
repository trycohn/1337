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

                    {/* Убраны подписи и рекомендации по требованию дизайна */}
                </>
            )}
        </div>
    );
}

export default PasswordStrengthIndicator; 