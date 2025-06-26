/**
 * Обертка для асинхронных функций контроллеров
 * Автоматически обрабатывает ошибки и передает их в middleware обработки ошибок
 * 
 * @param {Function} fn - Асинхронная функция контроллера
 * @returns {Function} - Обернутая функция
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = { asyncHandler }; 