const nodemailer = require('nodemailer');

// Используем существующую конфигурацию SMTP из переменных окружения
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT === '465', // true для 465, false для других портов
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Функция для создания HTML шаблона приветственного письма
const createWelcomeEmailTemplate = (username, userEmail) => {
    return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Добро пожаловать в 1337 Community!</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
                line-height: 1.6;
                color: #333333;
                background-color: #f8f9fa;
            }
            
            .email-container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            }
            
            .header {
                background: linear-gradient(135deg, #000000 0%, #111111 100%);
                padding: 40px 30px;
                text-align: center;
                color: white;
            }
            
            .logo {
                width: 160px;
                height: 120px;
                background: #000000;
                border-radius: 20px;
                margin: 0 auto 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 36px;
                font-weight: bold;
                color: white;
                border: 3px solid rgba(255, 255, 255, 0.3);
            }
            
            .header h1 {
                font-size: 28px;
                font-weight: 700;
                margin-bottom: 8px;
                text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }
            
            .header p {
                font-size: 16px;
                opacity: 0.9;
                font-weight: 400;
            }
            
            .content {
                padding: 40px 30px;
            }
            
            .welcome-message {
                text-align: center;
                margin-bottom: 30px;
            }
            
            .welcome-message h2 {
                color: #2c3e50;
                font-size: 24px;
                font-weight: 600;
                margin-bottom: 12px;
            }
            
            .welcome-message p {
                color: #7f8c8d;
                font-size: 16px;
                line-height: 1.6;
            }
            
            .user-info {
                background: linear-gradient(135deg, #f8f9fa, #e9ecef);
                border-radius: 12px;
                padding: 24px;
                margin: 30px 0;
                border-left: 4px solid #667eea;
            }
            
            .user-info h3 {
                color: #2c3e50;
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 16px;
                display: flex;
                align-items: center;
            }
            
            .user-info h3::before {
                content: "👤";
                margin-right: 8px;
                font-size: 20px;
            }
            
            .info-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px solid #dee2e6;
            }
            
            .info-item:last-child {
                border-bottom: none;
            }
            
            .info-label {
                color: #6c757d;
                font-weight: 500;
                font-size: 14px;
            }
            
            .info-value {
                color: #2c3e50;
                font-weight: 600;
                font-size: 14px;
            }
            
            .features {
                margin: 30px 0;
            }
            
            .features h3 {
                color: #2c3e50;
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 16px;
                text-align: center;
            }
            
            .feature-list {
                display: grid;
                gap: 12px;
            }
            
            .feature-item {
                display: flex;
                align-items: center;
                padding: 12px 16px;
                background: #f8f9fa;
                border-radius: 8px;
                border-left: 3px solid #4CAF50;
            }
            
            .feature-icon {
                font-size: 20px;
                margin-right: 12px;
            }
            
            .feature-text {
                color: #495057;
                font-size: 14px;
                font-weight: 500;
            }
            
            .cta-section {
                text-align: center;
                margin: 30px 0;
                padding: 24px;
                background: linear-gradient(135deg, #000000, #111111);
                border-radius: 12px;
                color: white;
            }
            
            .cta-section h3 {
                font-size: 20px;
                font-weight: 600;
                margin-bottom: 12px;
            }
            
            .cta-section p {
                font-size: 14px;
                opacity: 0.9;
                margin-bottom: 20px;
            }
            .cta-section a {
                text-decoration: none;  
                color: #ffffff;
                text-transform: uppercase;
            }
            
            .cta-button {
                display: inline-block;
                background: #000000;
                color: #ffffff;
                text-decoration: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-weight: 600;
                font-size: 18px;
                border: 2px solid #ff0000;
                transition: all 0.3s ease;
            }
            
            .cta-button:hover {
                background: #111111;
                border-color: rgb(255, 0, 0);
            }
            
            .footer {
                color:#000000;
                padding: 24px 30px;
                text-align: center;
                font-size: 12px;
            }
            
            .footer p {
                margin-bottom: 8px;
            }
            
            .footer a {
                color: #3498db;
                text-decoration: none;
            }
            
            .social-links {
                margin-top: 16px;
            }
            
            .social-links a {
                display: inline-block;
                margin: 0 8px;
                color: #bdc3c7;
                text-decoration: none;
                font-size: 16px;
            }
            
            /* Адаптивность */
            @media (max-width: 600px) {
                .email-container {
                    margin: 0;
                    border-radius: 0;
                }
                
                .header, .content, .footer {
                    padding: 24px 20px;
                }
                
                .user-info {
                    padding: 20px;
                }
                
                .info-item {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 4px;
                }
                
                .cta-section {
                    padding: 20px;
                }
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <!-- Заголовок -->
            <div class="header">
                <div class="logo">1337</div>
                <h1>Добро пожаловать!</h1>
                <p>Ваш аккаунт успешно создан</p>
            </div>
            
            <!-- Основное содержание -->
            <div class="content">
                <div class="welcome-message">
                    <h2>Привет, ${username}! 🎉</h2>
                    <p>Спасибо за регистрацию в 1337 Community! Мы рады приветствовать вас в нашем сообществе геймеров и киберспортсменов.</p>
                </div>
                
                <!-- Информация об аккаунте -->
                <div class="user-info">
                    <h3>Данные вашего аккаунта</h3>
                    <div class="info-item">
                        <span class="info-label">Имя пользователя:</span>
                        <span class="info-value">${username}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Email:</span>
                        <span class="info-value">${userEmail}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Дата регистрации:</span>
                        <span class="info-value">${new Date().toLocaleDateString('ru-RU')}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Статус:</span>
                        <span class="info-value">✅ Активен</span>
                    </div>
                </div>
                
                <!-- Возможности платформы -->
                <div class="features">
                    <h3>Что вас ждет на платформе</h3>
                    <div class="feature-list">
                        <div class="feature-item">
                            <span class="feature-icon">🏆</span>
                            <span class="feature-text">Участие в турнирах и соревнованиях</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon">👥</span>
                            <span class="feature-text">Поиск команды и новых друзей</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon">📊</span>
                            <span class="feature-text">Отслеживание статистики и рейтинга</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon">🎮</span>
                            <span class="feature-text">Интеграция с Steam и другими платформами</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon">🏅</span>
                            <span class="feature-text">Система достижений и наград</span>
                        </div>
                    </div>
                </div>
                
                <!-- Призыв к действию -->
                <div class="cta-section">
                    <h3>Готовы начать?</h3>
                    <p>Присоединяйтесь к нашему сообществу и начните свой путь к киберспортивным вершинам!</p>
                    <a href="https://1337community.com" class="cta-button">Перейти на сайт</a>
                </div>
            </div>
            
            <!-- Подвал -->
            <div class="footer">
                <p><strong>1337 Community</strong> - Ваше киберспортивное сообщество</p>
                <p>Если у вас есть вопросы, свяжитесь с нами: <a href="mailto:support@1337community.com">support@1337community.com</a></p>
                
                <div class="social-links">
                    <a href="#">Discord</a>
                    <a href="#">Telegram</a>
                    <a href="#">VK</a>
                </div>
                
                <p style="margin-top: 16px; color: #95a5a6;">
                    © 2024 1337 Community. Все права защищены.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;
};

const sendWelcomeEmail = async (userEmail, username) => {
    try {
        const htmlContent = createWelcomeEmailTemplate(username, userEmail);
        
        const mailOptions = {
            from: {
                name: '1337 Community',
                address: process.env.SMTP_USER || 'noreply@1337community.com'
            },
            to: userEmail,
            subject: '🎉 Добро пожаловать в 1337 Community!',
            html: htmlContent,
            // Текстовая версия для клиентов, не поддерживающих HTML
            text: `
Привет, ${username}!

Добро пожаловать в 1337 Community! Ваш аккаунт успешно создан.

Данные вашего аккаунта:
- Имя пользователя: ${username}
- Email: ${userEmail}
- Дата регистрации: ${new Date().toLocaleDateString('ru-RU')}

Что вас ждет на платформе:
• Участие в турнирах и соревнованиях
• Поиск команды и новых друзей
• Отслеживание статистики и рейтинга
• Интеграция с Steam и другими платформами
• Система достижений и наград

Перейти на сайт: https://1337community.com

По вопросам обращайтесь: support@1337community.com

С уважением,
Команда 1337 Community
            `.trim()
        };

        const result = await transporter.sendMail(mailOptions);
        console.log('✅ Приветственное письмо отправлено:', result.messageId);
        return { success: true, messageId: result.messageId };
        
    } catch (error) {
        console.error('❌ Ошибка отправки приветственного письма:', error);
        return { success: false, error: error.message };
    }
};

// Функция для отправки уведомления о сбросе пароля
const sendPasswordResetEmail = async (userEmail, username, resetToken) => {
    try {
        const resetUrl = `https://1337community.com/reset-password?token=${resetToken}`;
        
        const mailOptions = {
            from: {
                name: '1337 Community Security',
                address: process.env.SMTP_USER || 'security@1337community.com'
            },
            to: userEmail,
            subject: '🔐 Сброс пароля - 1337 Community',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                    <div style="background: linear-gradient(135deg, #e74c3c, #c0392b); padding: 30px; text-align: center; color: white;">
                        <h1 style="margin: 0; font-size: 24px;">Сброс пароля</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">1337 Community</p>
                    </div>
                    
                    <div style="padding: 30px;">
                        <h2 style="color: #2c3e50; margin-bottom: 16px;">Привет, ${username}!</h2>
                        <p style="color: #7f8c8d; line-height: 1.6; margin-bottom: 20px;">
                            Мы получили запрос на сброс пароля для вашего аккаунта. Если это были вы, нажмите кнопку ниже:
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetUrl}" style="background: #e74c3c; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; display: inline-block;">
                                Сбросить пароль
                            </a>
                        </div>
                        
                        <p style="color: #7f8c8d; font-size: 14px; line-height: 1.6;">
                            Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо. Ссылка действительна в течение 1 часа.
                        </p>
                        
                        <p style="color: #7f8c8d; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1;">
                            Если кнопка не работает, скопируйте эту ссылку в браузер:<br>
                            <a href="${resetUrl}" style="color: #3498db; word-break: break-all;">${resetUrl}</a>
                        </p>
                    </div>
                </div>
            `,
            text: `
Привет, ${username}!

Мы получили запрос на сброс пароля для вашего аккаунта.

Для сброса пароля перейдите по ссылке: ${resetUrl}

Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.
Ссылка действительна в течение 1 часа.

С уважением,
Команда 1337 Community
            `.trim()
        };

        const result = await transporter.sendMail(mailOptions);
        console.log('✅ Письмо сброса пароля отправлено:', result.messageId);
        return { success: true, messageId: result.messageId };
        
    } catch (error) {
        console.error('❌ Ошибка отправки письма сброса пароля:', error);
        return { success: false, error: error.message };
    }
};

// Проверка соединения с SMTP сервером
const testEmailConnection = async () => {
    try {
        await transporter.verify();
        console.log('✅ SMTP сервер готов к отправке писем');
        return true;
    } catch (error) {
        console.error('❌ Ошибка подключения к SMTP серверу:', error);
        return false;
    }
};

module.exports = {
    sendWelcomeEmail,
    sendPasswordResetEmail,
    testEmailConnection,
    transporter
}; 