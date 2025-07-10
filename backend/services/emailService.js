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

const sendWelcomeEmail = async (userEmail, username) => {
    const mailOptions = {
        from: process.env.SMTP_USER || 'noreply@1337community.com',
        to: userEmail,
        subject: 'Добро пожаловать в 1337 Community!',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 0;">
                <div style="background-color: #ffffff; border: 1px solid #e0e0e0;">
                    <!-- Header -->
                    <div style="background-color: #000000; color: #ffffff; padding: 20px; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px; font-weight: 300;">1337 COMMUNITY</h1>
                        <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">Добро пожаловать в сообщество</p>
                    </div>
                    
                    <!-- Content -->
                    <div style="padding: 30px;">
                        <h2 style="color: #000000; margin: 0 0 25px 0; font-size: 20px; font-weight: 400; border-bottom: 1px solid #e0e0e0; padding-bottom: 10px;">
                            Поздравляем с регистрацией!
                        </h2>
                        
                        <p>Привет, <strong>${username}</strong>!</p>
                        <p>Ваш аккаунт успешно создан в 1337 Community.</p>
                        
                        <div style="background-color: #f0f8ff; padding: 15px; margin: 20px 0; border-left: 4px solid #000000;">
                            <p style="margin: 0 0 10px 0;"><strong>Данные вашего аккаунта:</strong></p>
                            <ul style="margin: 0; padding-left: 20px;">
                                <li>Имя пользователя: ${username}</li>
                                <li>Email: ${userEmail}</li>
                            </ul>
                        </div>
                        
                        <p>Теперь вы можете:</p>
                        <ul>
                            <li>Участвовать в турнирах</li>
                            <li>Создавать команды</li>
                            <li>Следить за статистикой</li>
                            <li>Общаться с другими игроками</li>
                        </ul>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="https://1337community.com" 
                               style="display: inline-block; background-color: #000000; color: #ffffff; padding: 12px 30px; text-decoration: none; font-size: 14px; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase;">
                                Перейти на сайт
                            </a>
                        </div>
                        
                        <p>Добро пожаловать в наше сообщество!</p>
                    </div>
                    
                    <!-- Footer -->
                    <div style="background-color: #f8f8f8; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
                        <p style="margin: 0 0 5px 0; color: #666666; font-size: 12px;">1337 Community • С уважением, команда проекта</p>
                        <p style="margin: 0; color: #999999; font-size: 11px;">
                            ${new Date().toLocaleString('ru-RU')}
                        </p>
                    </div>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Welcome email sent to:', userEmail);
    } catch (error) {
        console.error('Error sending welcome email:', error);
        throw error;
    }
};

module.exports = {
    sendWelcomeEmail
}; 