    // Функция для получения данных пользователя
    export async function getUserData() {
        const token = localStorage.getItem('jwtToken');
        if (!token) return null;
        try {
            const response = await fetch('/api/users/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Не удалось получить данные пользователя');
            return await response.json();
        } catch (error) {
            console.error(error);
            return null;
        }
    }

document.addEventListener('DOMContentLoaded', async function() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const userInfo = document.getElementById('userInfo');
    const usernameDisplay = document.getElementById('usernameDisplay');
    const logoutButton = document.getElementById('logoutButton');
    const showRegisterFormButton = document.getElementById('showRegisterForm');
    const showLoginFormButton = document.getElementById('showLoginForm');

    // Функция для получения данных пользователя
    getUserData().then(data => console.log("Данные пользователя:", data));

    // Функция для авторизации
    async function login(username, password) {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('jwtToken', data.token);
            localStorage.setItem('userId', data.userId);
            localStorage.setItem('username', username);
            showUserInfo();
        } else {
            throw new Error(data.message || 'Ошибка входа');
        }
    }

    // Функция для выхода
    function logout() {
        localStorage.clear(); // Удаляем все данные
        showLoginForm();
    }

    // Проверка авторизации при загрузке страницы
    const userData = await getUserData();
    if (userData) {
        console.log('Пользователь авторизован:', userData);
        showUserInfo();
    } else {
        console.log('Пользователь не авторизован');
        showLoginForm();
    }

    // Обработчик формы логина
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;
            try {
                await login(username, password);
            } catch (error) {
                alert(error.message);
            }
        });
    }

    // Обработчик формы регистрации
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('registerUsername').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Ошибка регистрации');
                localStorage.setItem('jwtToken', data.token);
                localStorage.setItem('userId', data.userId);
                localStorage.setItem('username', username);
                showUserInfo();
            } catch (error) {
                alert(error.message);
            }
        });
    }

    // Обработчик кнопки выхода
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }

    // Переключение между формами логина и регистрации
    if (showRegisterFormButton && showLoginFormButton) {
        showRegisterFormButton.addEventListener('click', () => {
            if (loginForm && registerForm) {
                loginForm.style.display = 'none';
                registerForm.style.display = 'block';
            }
        });
        showLoginFormButton.addEventListener('click', () => {
            if (loginForm && registerForm) {
                registerForm.style.display = 'none';
                loginForm.style.display = 'block';
            }
        });
    }

    // Показ информации о пользователе
    function showUserInfo() {
        if (!userInfo || !usernameDisplay || !loginForm || !registerForm) return;
        usernameDisplay.textContent = `Привет, ${localStorage.getItem('username')}!`;
        loginForm.style.display = 'none';
        registerForm.style.display = 'none';
        userInfo.style.display = 'block';
    }

    // Показ формы логина
    function showLoginForm() {
        if (!userInfo || !loginForm || !registerForm) return;
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        userInfo.style.display = 'none';
    }
});

