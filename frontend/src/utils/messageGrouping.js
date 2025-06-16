// Группируем сообщения по дате
export const groupMessagesByDate = (messages) => {
    if (!messages.length) return [];
    
    const groups = [];
    let currentGroup = {
        date: new Date(messages[0].created_at).toDateString(),
        messages: [messages[0]]
    };
    
    for (let i = 1; i < messages.length; i++) {
        const messageDate = new Date(messages[i].created_at).toDateString();
        
        if (messageDate === currentGroup.date) {
            currentGroup.messages.push(messages[i]);
        } else {
            groups.push(currentGroup);
            currentGroup = {
                date: messageDate,
                messages: [messages[i]]
            };
        }
    }
    
    groups.push(currentGroup);
    return groups;
};

// Форматирование даты группы сообщений
export const formatGroupDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return 'Сегодня';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Вчера';
    } else {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    }
}; 