/**
 * Middleware для обработки ошибок турниров
 */
const tournamentErrorHandler = (err, req, res, next) => {
    console.error('❌ Ошибка в турнирном модуле:', err);

    // Определяем тип ошибки и соответствующий HTTP статус
    const errorMap = {
        'Турнир не найден': 404,
        'Недостаточно прав': 403,
        'Турнир неактивен': 400,
        'Турнир заполнен': 400,
        'Вы уже участвуете в этом турнире': 409,
        'Команда заполнена': 400,
        'Команда не найдена': 404,
        'Участник не найден': 404,
        'Неверный размер команды': 400,
        'Нельзя изменить размер команды после генерации сетки': 400,
        'Доступ к чату только для участников турнира': 403,
        'Только создатель или администратор может выполнить это действие': 403
    };

    // Находим подходящий статус код
    let statusCode = 500;
    for (const [errorMessage, code] of Object.entries(errorMap)) {
        if (err.message && err.message.includes(errorMessage)) {
            statusCode = code;
            break;
        }
    }

    // Формируем ответ в зависимости от типа ошибки
    const response = {
        success: false,
        error: err.message || 'Внутренняя ошибка сервера',
        timestamp: new Date().toISOString()
    };

    // В development режиме добавляем stack trace
    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
    }

    res.status(statusCode).json(response);
};

/**
 * Wrapper для асинхронных функций с автоматической обработкой ошибок
 */
const asyncErrorHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = {
    tournamentErrorHandler,
    asyncErrorHandler
}; 