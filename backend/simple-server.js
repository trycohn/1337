const express = require('express');
const cors = require('cors');

const app = express();

// Настройка CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Тестовые данные карт для CS2
const cs2Maps = [
    { id: 1, name: 'de_dust2', game: 'Counter-Strike 2', display_name: 'Dust II' },
    { id: 2, name: 'de_mirage', game: 'Counter-Strike 2', display_name: 'Mirage' },
    { id: 3, name: 'de_inferno', game: 'Counter-Strike 2', display_name: 'Inferno' },
    { id: 4, name: 'de_nuke', game: 'Counter-Strike 2', display_name: 'Nuke' },
    { id: 5, name: 'de_overpass', game: 'Counter-Strike 2', display_name: 'Overpass' },
    { id: 6, name: 'de_ancient', game: 'Counter-Strike 2', display_name: 'Ancient' },
    { id: 7, name: 'de_vertigo', game: 'Counter-Strike 2', display_name: 'Vertigo' },
    { id: 8, name: 'de_anubis', game: 'Counter-Strike 2', display_name: 'Anubis' }
];

// API маршрут для получения карт
app.get('/api/maps', (req, res) => {
    const game = req.query.game;
    console.log(`🔍 Запрос карт для игры: ${game}`);
    
    if (game) {
        const filteredMaps = cs2Maps.filter(map => 
            map.game.toLowerCase() === game.toLowerCase() ||
            map.game.toLowerCase().replace('-', ' ') === game.toLowerCase()
        );
        console.log(`✅ Найдено ${filteredMaps.length} карт для игры ${game}`);
        res.json(filteredMaps);
    } else {
        console.log(`✅ Возвращаем все карты: ${cs2Maps.length}`);
        res.json(cs2Maps);
    }
});

// Тестовый маршрут
app.get('/api/test', (req, res) => {
    res.json({ message: 'Тестовый API сервер работает!' });
});

// Запуск сервера
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Тестовый API сервер запущен на порту ${PORT}`);
    console.log(`📍 Доступные маршруты:`);
    console.log(`   GET /api/maps - получить все карты`);
    console.log(`   GET /api/maps?game=Counter-Strike%202 - получить карты для CS2`);
    console.log(`   GET /api/test - тестовый маршрут`);
}); 