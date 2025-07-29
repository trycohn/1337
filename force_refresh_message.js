// ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ СООБЩЕНИЯ ADMIN_INVITATION
// Обновляет данные сообщения из API если React не синхронизируется с БД

console.log("=== ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ СООБЩЕНИЯ ===");

// Функция для получения обновленных данных сообщения
async function refreshAdminInvitationMessage() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.log("❌ Нет токена авторизации");
            return;
        }

        // Пытаемся найти chat_id из текущей страницы
        const urlParts = window.location.pathname.split('/');
        const chatId = urlParts[urlParts.indexOf('chats') + 1];
        
        if (chatId) {
            console.log(`🔄 Обновляем сообщения для чата ${chatId}...`);
            
            // Запрашиваем обновленные сообщения
            const response = await fetch(`/api/chats/${chatId}/messages`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log("✅ Получены обновленные сообщения:", data);
                
                // Находим admin_invitation сообщения
                const adminInvitations = data.messages?.filter(msg => 
                    msg.message_type === 'admin_invitation'
                ) || [];
                
                console.log(`📧 Найдено admin_invitation сообщений: ${adminInvitations.length}`);
                
                adminInvitations.forEach((msg, index) => {
                    console.log(`📧 Сообщение ${index + 1}:`, {
                        id: msg.id,
                        invitation_id: msg.metadata?.invitation_id,
                        has_actions: !!msg.metadata?.actions,
                        processed: !!msg.metadata?.processed,
                        action: msg.metadata?.action
                    });
                });
                
                // Перезагружаем страницу для применения обновлений
                console.log("🔄 Перезагружаем страницу для применения обновлений...");
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
                
            } else {
                console.log("❌ Ошибка получения сообщений:", response.status);
            }
        } else {
            console.log("❌ Не удалось определить chat_id");
            
            // Альтернативный способ - просто перезагрузить страницу
            console.log("🔄 Перезагружаем страницу...");
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }
        
    } catch (error) {
        console.error("❌ Ошибка обновления сообщений:", error);
        
        // В случае ошибки - просто перезагружаем
        console.log("🔄 Перезагружаем страницу из-за ошибки...");
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }
}

// Запускаем обновление
refreshAdminInvitationMessage();

console.log("\n📝 ИНСТРУКЦИИ:");
console.log("1. Этот скрипт обновит данные сообщений из API");
console.log("2. Страница автоматически перезагрузится через 2 секунды"); 
console.log("3. После перезагрузки кнопки должны появиться автоматически"); 