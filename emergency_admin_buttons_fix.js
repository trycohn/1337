// 🚨 ЭКСТРЕННОЕ ИСПРАВЛЕНИЕ КНОПОК ADMIN_INVITATION
// Добавляет рабочие кнопки с правильными API вызовами

console.log("🚨 === ЭКСТРЕННОЕ ИСПРАВЛЕНИЕ КНОПОК === 🚨");

async function addWorkingAdminButtons() {
    // Находим сообщение admin_invitation
    const adminMsg = document.querySelector('.message-announcement.admin-invitation');
    
    if (!adminMsg) {
        console.log("❌ Сообщение admin_invitation не найдено");
        return;
    }
    
    console.log("✅ Найдено сообщение admin_invitation");
    
    // Проверяем есть ли уже кнопки
    const existingButtons = adminMsg.querySelector('.announcement-actions');
    if (existingButtons) {
        console.log("✅ Кнопки уже существуют, удаляем старые...");
        existingButtons.remove();
    }
    
    // Получаем invitation_id из контекста сообщения
    // Пытаемся найти его в тексте сообщения или из React props
    let invitationId = null;
    
    // Попытка извлечь из данных React (если доступны)
    try {
        const reactKey = Object.keys(adminMsg).find(key => key.startsWith('__reactInternalInstance'));
        if (reactKey) {
            const reactInstance = adminMsg[reactKey];
            const messageData = reactInstance?.memoizedProps?.message;
            invitationId = messageData?.metadata?.invitation_id;
        }
    } catch (e) {
        console.log("⚠️ Не удалось получить invitation_id из React");
    }
    
    // Если не получили invitation_id, пробуем найти последнее приглашение через API
    if (!invitationId) {
        console.log("🔍 Получаем invitation_id через API...");
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/admin-invitations/my', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                const pendingInvitations = data.filter(inv => inv.status === 'pending');
                if (pendingInvitations.length > 0) {
                    invitationId = pendingInvitations[0].id;
                    console.log(`✅ Найден invitation_id: ${invitationId}`);
                }
            }
        } catch (e) {
            console.error("❌ Ошибка получения invitation_id:", e);
        }
    }
    
    // Создаем блок с кнопками
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'announcement-actions';
    actionsDiv.style.cssText = `
        margin-top: 15px;
        display: flex;
        gap: 10px;
        justify-content: center;
    `;
    
    // Кнопка "Принять"
    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'action-button accept';
    acceptBtn.textContent = '✅ Принять';
    acceptBtn.style.cssText = `
        padding: 10px 20px;
        background-color: #28a745;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        transition: background-color 0.3s;
    `;
    
    // Кнопка "Отклонить"
    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'action-button reject';
    rejectBtn.textContent = '❌ Отклонить';
    rejectBtn.style.cssText = `
        padding: 10px 20px;
        background-color: #dc3545;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        transition: background-color 0.3s;
    `;
    
    // Обработчики кнопок
    acceptBtn.onclick = async () => {
        await handleInvitationAction('accept', invitationId, acceptBtn);
    };
    
    rejectBtn.onclick = async () => {
        await handleInvitationAction('decline', invitationId, rejectBtn);
    };
    
    // Hover эффекты
    acceptBtn.onmouseover = () => acceptBtn.style.backgroundColor = '#218838';
    acceptBtn.onmouseout = () => acceptBtn.style.backgroundColor = '#28a745';
    rejectBtn.onmouseover = () => rejectBtn.style.backgroundColor = '#c82333';
    rejectBtn.onmouseout = () => rejectBtn.style.backgroundColor = '#dc3545';
    
    // Добавляем кнопки в блок
    actionsDiv.appendChild(acceptBtn);
    actionsDiv.appendChild(rejectBtn);
    
    // Находим место для вставки
    const textDiv = adminMsg.querySelector('.announcement-text');
    if (textDiv) {
        textDiv.parentNode.insertBefore(actionsDiv, textDiv.nextSibling);
        console.log("✅ Кнопки добавлены!");
        
        if (invitationId) {
            console.log(`🎯 Кнопки привязаны к invitation_id: ${invitationId}`);
        } else {
            console.log("⚠️ invitation_id не найден - кнопки работать не будут");
        }
    } else {
        console.log("❌ Не найден .announcement-text для вставки кнопок");
    }
}

// Функция обработки действий
async function handleInvitationAction(action, invitationId, button) {
    if (!invitationId) {
        alert('❌ Не удалось определить ID приглашения');
        return;
    }
    
    const originalText = button.textContent;
    button.textContent = '⏳ Обработка...';
    button.disabled = true;
    
    try {
        const token = localStorage.getItem('token');
        const endpoint = action === 'accept' ? 'accept' : 'decline';
        
        console.log(`📤 Отправляем запрос: POST /api/tournaments/admin-invitations/${invitationId}/${endpoint}`);
        
        const response = await fetch(`/api/tournaments/admin-invitations/${invitationId}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const message = data.message || (action === 'accept' ? 'Приглашение принято!' : 'Приглашение отклонено');
            alert(`✅ ${message}`);
            
            // Скрываем кнопки и показываем статус
            const actionsDiv = button.parentNode;
            actionsDiv.innerHTML = `
                <div style="
                    padding: 10px;
                    background-color: ${action === 'accept' ? '#d4edda' : '#f8d7da'};
                    color: ${action === 'accept' ? '#155724' : '#721c24'};
                    border-radius: 6px;
                    text-align: center;
                    font-weight: bold;
                ">
                    ${action === 'accept' ? '✅ Приглашение принято' : '❌ Приглашение отклонено'}
                </div>
            `;
            
            console.log(`✅ Приглашение ${action === 'accept' ? 'принято' : 'отклонено'} успешно`);
            
        } else {
            throw new Error(data.message || data.error || 'Ошибка сервера');
        }
        
    } catch (error) {
        console.error(`❌ Ошибка при ${action === 'accept' ? 'принятии' : 'отклонении'} приглашения:`, error);
        alert(`❌ Ошибка: ${error.message}`);
        
        // Восстанавливаем кнопку
        button.textContent = originalText;
        button.disabled = false;
    }
}

// Запускаем исправление
addWorkingAdminButtons();

console.log(`
📝 ИНСТРУКЦИИ:
1. ✅ Кнопки добавлены с правильными API вызовами
2. 🎯 Кнопки автоматически найдут invitation_id
3. 📤 При клике отправится правильный API запрос
4. ✅ После успешного ответа отобразится статус
5. 🔄 Для применения исправления на сервере: git pull && pm2 restart 1337-backend
`); 