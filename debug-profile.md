# 🔧 Диагностика проблемы с вкладкой "Турниры"

## Шаг 1: Проверка файла Profile.js

Убедитесь, что в файле `frontend/src/components/Profile.js` есть:

### Навигация (строка ~1857):
```jsx
<button 
    className={`nav-tab-profile ${activeTab === 'tournaments' ? 'active' : ''}`} 
    onClick={() => switchTab('tournaments')}
>
    <div className="nav-tab-content-profile">
        <span className="nav-tab-icon-profile">🏆</span>
        <span>Турниры</span>
    </div>
</button>
```

### Контент (строка ~2808):
```jsx
{activeTab === 'tournaments' && (
    <>
        <div className="content-header">
            <h2 className="content-title">Турниры</h2>
        </div>
        // ... остальной контент
    </>
)}
```

## Шаг 2: Очистка кеша браузера

1. **Chrome/Edge**: Ctrl+Shift+R (жесткая перезагрузка)
2. **Firefox**: Ctrl+F5
3. **Или**: 
   - F12 → Application/Хранилище → Clear Storage → Clear site data
   - F12 → Network → Disable cache (поставить галочку)

## Шаг 3: Проверка консоли браузера

1. Откройте F12 (Developer Tools)
2. Перейдите на вкладку **Console**
3. Вставьте и выполните этот код:

```javascript
// Диагностика вкладок профиля
console.log('🔍 Проверка вкладок профиля...');

const navTabs = document.querySelectorAll('.nav-tab-profile');
console.log('Найдено вкладок:', navTabs.length);

navTabs.forEach((tab, index) => {
    const text = tab.querySelector('span:last-child')?.textContent;
    console.log(`${index + 1}. ${text}`);
});

// Проверка кликабельности вкладки Турниры
const tournamentTab = Array.from(navTabs).find(tab => 
    tab.querySelector('span:last-child')?.textContent === 'Турниры'
);

if (tournamentTab) {
    console.log('✅ Вкладка "Турниры" найдена');
    console.log('Класс активности:', tournamentTab.className);
    
    // Попробуем кликнуть
    console.log('Кликаем на вкладку...');
    tournamentTab.click();
    
    setTimeout(() => {
        const isActive = tournamentTab.classList.contains('active');
        console.log('Вкладка активна после клика:', isActive);
    }, 100);
} else {
    console.log('❌ Вкладка "Турниры" НЕ найдена');
}
```

## Шаг 4: Перезапуск dev-сервера

Остановите и перезапустите сервер разработки:

```bash
# В терминале где запущен npm start
Ctrl+C  # остановить

# Затем снова запустить
cd frontend
npm start
```

## Шаг 5: Проверка React DevTools

Если у вас установлен React DevTools:

1. F12 → вкладка React
2. Найдите компонент `Profile`
3. Проверьте состояние `activeTab`
4. Попробуйте изменить его на `'tournaments'` вручную

## Шаг 6: Проверка ошибок

Ищите ошибки в консоли (красные сообщения), особенно:
- Ошибки импорта компонентов
- Синтаксические ошибки JavaScript
- Ошибки сети (failed to load)

## Возможные причины проблемы:

1. **Кеш браузера** - самая частая причина
2. **Не сохранился файл** - проверьте, что Profile.js сохранен
3. **Ошибки в консоли** - мешают работе React
4. **Не перезапущен dev-сервер** после изменений
5. **Конфликт CSS** - вкладка скрыта стилями

## Если ничего не помогает:

1. Закройте браузер полностью
2. Остановите dev-сервер (Ctrl+C)
3. Очистите кеш node_modules: `rm -rf frontend/node_modules && npm install`
4. Запустите заново: `npm start`
5. Откройте в режиме инкогнито

---

**Важно**: Все изменения в коде есть, проблема скорее всего в браузере или кеше! 