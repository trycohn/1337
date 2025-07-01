#!/usr/bin/env node

/**
 * 🔍 Диагностический скрипт для проверки API endpoints генерации сетки
 * 
 * Проверяет:
 * 1. Доступность роутов /api/tournaments/:id/generate-bracket
 * 2. Доступность роутов /api/tournaments/:id/regenerate-bracket
 * 3. Правильность работы контроллеров и сервисов
 * 4. Логирование всех этапов обработки запроса
 */

const http = require('http');
const https = require('https');

// Тестовые данные
const SERVER_URL = 'http://localhost:3001'; // Backend сервер
const TEST_TOURNAMENT_ID = 1; // ID существующего турнира для тестов
const TEST_TOKEN = 'test-token'; // Тестовый токен

// Функция для выполнения HTTP запроса
function makeRequest(method, path, data = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, SERVER_URL);
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Test-API-Endpoints/1.0'
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        if (data) {
            const jsonData = JSON.stringify(data);
            options.headers['Content-Length'] = Buffer.byteLength(jsonData);
        }

        console.log(`🔍 Тестируем: ${method} ${url.href}`);
        console.log(`📤 Заголовки:`, options.headers);
        if (data) console.log(`📤 Данные:`, data);

        const req = http.request(url, options, (res) => {
            let responseData = '';
            
            res.on('data', chunk => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: parsed
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: responseData
                    });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

// Основная функция тестирования
async function runTests() {
    console.log('🎯 ЗАПУСК ДИАГНОСТИКИ API ENDPOINTS ГЕНЕРАЦИИ СЕТКИ');
    console.log('=' + '='.repeat(60));
    
    try {
        // Тест 1: Проверка доступности сервера
        console.log('\n📡 Тест 1: Проверка доступности сервера');
        try {
            const healthCheck = await makeRequest('GET', '/health');
            console.log(`✅ Сервер доступен: статус ${healthCheck.status}`);
        } catch (error) {
            console.log(`❌ Сервер недоступен:`, error.message);
            return;
        }

        // Тест 2: Проверка роута получения турнира
        console.log('\n📋 Тест 2: Получение турнира');
        try {
            const tournamentResponse = await makeRequest('GET', `/api/tournaments/${TEST_TOURNAMENT_ID}`);
            console.log(`📊 Статус: ${tournamentResponse.status}`);
            if (tournamentResponse.status === 200) {
                console.log(`✅ Турнир найден: ${tournamentResponse.data.name || 'Без названия'}`);
            } else {
                console.log(`❌ Турнир не найден или ошибка:`, tournamentResponse.data);
            }
        } catch (error) {
            console.log(`❌ Ошибка получения турнира:`, error.message);
        }

        // Тест 3: Проверка роута генерации сетки (без авторизации)
        console.log('\n🔄 Тест 3: Генерация сетки (без токена)');
        try {
            const generateResponse = await makeRequest('POST', `/api/tournaments/${TEST_TOURNAMENT_ID}/generate-bracket`, {
                thirdPlaceMatch: false
            });
            console.log(`📊 Статус: ${generateResponse.status}`);
            console.log(`📤 Ответ:`, generateResponse.data);
            
            if (generateResponse.status === 401) {
                console.log(`✅ Правильно: требуется авторизация`);
            } else {
                console.log(`⚠️ Неожиданный статус: ${generateResponse.status}`);
            }
        } catch (error) {
            console.log(`❌ Ошибка генерации:`, error.message);
        }

        // Тест 4: Проверка роута регенерации сетки (без авторизации)
        console.log('\n🔄 Тест 4: Регенерация сетки (без токена)');
        try {
            const regenerateResponse = await makeRequest('POST', `/api/tournaments/${TEST_TOURNAMENT_ID}/regenerate-bracket`, {
                shuffle: true,
                thirdPlaceMatch: false
            });
            console.log(`📊 Статус: ${regenerateResponse.status}`);
            console.log(`📤 Ответ:`, regenerateResponse.data);
            
            if (regenerateResponse.status === 401) {
                console.log(`✅ Правильно: требуется авторизация`);
            } else {
                console.log(`⚠️ Неожиданный статус: ${regenerateResponse.status}`);
            }
        } catch (error) {
            console.log(`❌ Ошибка регенерации:`, error.message);
        }

        // Тест 5: Проверка с неправильным токеном
        console.log('\n🔐 Тест 5: Проверка с неправильным токеном');
        try {
            const tokenResponse = await makeRequest('POST', `/api/tournaments/${TEST_TOURNAMENT_ID}/generate-bracket`, {
                thirdPlaceMatch: false
            }, 'invalid-token');
            console.log(`📊 Статус: ${tokenResponse.status}`);
            console.log(`📤 Ответ:`, tokenResponse.data);
        } catch (error) {
            console.log(`❌ Ошибка с неправильным токеном:`, error.message);
        }

        console.log('\n🎯 ДИАГНОСТИКА ЗАВЕРШЕНА');
        console.log('=' + '='.repeat(60));
        
    } catch (error) {
        console.error('❌ Критическая ошибка при тестировании:', error);
    }
}

// Запуск тестов
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { runTests, makeRequest }; 