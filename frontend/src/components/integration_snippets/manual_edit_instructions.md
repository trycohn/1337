# Инструкции по ручному добавлению чата в TournamentDetails.js

## Что сделано

1. Создан компонент `TournamentChat.js` для отображения чата
2. Созданы стили `TournamentChat.css` для компонента чата
3. Подготовлена полная документация по интеграции

## Шаги для ручного редактирования

### Шаг 1: Добавление импорта

Откройте файл `1337/frontend/src/components/TournamentDetails.js` и добавьте импорт:

```javascript
import TournamentChat from './TournamentChat';
```

Лучше всего добавить его после импорта BracketRenderer:

```javascript
import BracketRenderer from './BracketRenderer';
import TournamentChat from './TournamentChat';
```

### Шаг 2: Добавление компонента в JSX

Найдите в файле структуру JSX, где используется класс `tournament-layout`. Компонент должен быть добавлен рядом с `div` с классом `tournament-main`.

```jsx
<section className="tournament-details">
    <div className="tournament-layout">
        <div className="tournament-main">
            {/* ... существующий контент ... */}
        </div>
        
        <TournamentChat 
            messages={chatMessages}
            newMessage={newChatMessage}
            onInputChange={handleChatInputChange}
            onSubmit={handleChatSubmit}
            onKeyPress={handleChatKeyPress}
            chatEndRef={chatEndRef}
            user={user}
        />
    </div>
    
    {/* ... модальные окна и другие элементы ... */}
</section>
```

Компонент `TournamentChat` должен быть добавлен после закрытия тега `div` для `tournament-main` и перед закрытием тега `div` для `tournament-layout`.

### Шаг 3: Проверка функциональности

После внесения изменений:

1. Запустите приложение и перейдите на страницу турнира
2. Убедитесь, что чат отображается справа от основного контента
3. Проверьте, что можно вводить и отправлять сообщения
4. Убедитесь, что работает прокрутка чата

### Решение возможных проблем

Если чат не отображается или работает некорректно:

1. **Проблема с импортом:** Убедитесь, что импорт TournamentChat добавлен корректно
2. **Проблема с позицией:** Проверьте правильность размещения компонента в JSX структуре
3. **Проблема со стилями:** Проверьте, что CSS стили загружаются и применяются
4. **Проблема с данными:** Проверьте, что chatMessages и другие связанные данные доступны

### Рекомендации для мобильных устройств

Для адаптивности на мобильных устройствах, в `TournamentChat.css` уже добавлены медиа-запросы:

```css
@media (max-width: 768px) {
    .tournament-chat-panel {
        max-width: 100%;
        margin-left: 0;
        margin-top: 20px;
    }
}
```

Это обеспечит перестроение макета на мобильных устройствах, где чат будет отображаться под основным контентом, а не справа от него. 