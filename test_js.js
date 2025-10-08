/**
 * Тестовый скрипт для проверки webhook
 * Использование: node test_webhook.js
 */

const https = require('https');

const data = JSON.stringify({
  event: 'series_end',
  matchid: 999888777,
  winner: {
    side: '3',
    team: 'team1'
  },
  team1_series_score: 1,
  team2_series_score: 0,
  time_until_restore: 10
});

const options = {
  hostname: '1337community.com',
  port: 443,
  path: '/api/matchzy/match-end',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'Authorization': 'Bearer 2a262f61e1138fb19445e5aa64c75f9f25bc85581666f00605e3da99245f2f59'
  }
};

console.log('📤 Отправка тестового webhook...\n');
console.log('URL:', `https://${options.hostname}${options.path}`);
console.log('Headers:', options.headers);
console.log('Body:', data);
console.log('\n⏳ Ожидание ответа...\n');

const req = https.request(options, (res) => {
  console.log(`✅ Статус: ${res.statusCode}`);
  console.log(`📋 Заголовки ответа:`, res.headers);
  
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log(`📥 Ответ:`, responseData);
    console.log('\n✅ Webhook успешно отправлен!');
    
    if (res.statusCode === 200) {
      console.log('\n🎉 Backend получил webhook! Проверь логи: pm2 logs 1337-backend');
    } else {
      console.log('\n⚠️ Неожиданный статус код. Проверь настройки.');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Ошибка отправки webhook:', error.message);
});

req.write(data);
req.end();
