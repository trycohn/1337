/**
 * Форматирует дату в удобный для чата формат
 * - Если сообщение было отправлено сегодня, возвращает только время (12:34)
 * - Если вчера - возвращает "Вчера"
 * - Иначе - возвращает дату в формате ДД.ММ.ГГГГ
 */
export const formatDate = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    
    // Проверяем, что дата действительна
    if (isNaN(date.getTime())) {
        return '';
    }
    
    // Получаем часы и минуты
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;
    
    // Проверяем, сегодня ли это было
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    // Если сообщение было сегодня, возвращаем только время
    if (messageDate.getTime() === today.getTime()) {
        return timeString;
    }
    
    // Проверяем, было ли это вчера
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (messageDate.getTime() === yesterday.getTime()) {
        return 'Вчера';
    }
    
    // Если сообщение было в этом году, возвращаем дату в формате ДД.ММ
    if (date.getFullYear() === now.getFullYear()) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${day}.${month}`;
    }
    
    // Иначе возвращаем полную дату
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}.${month}.${year}`;
}; 