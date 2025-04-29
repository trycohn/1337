# Руководство по интеграции чата в TournamentDetails

## Созданные компоненты

1. **TournamentChat.js** - компонент для отображения чата турнира
2. **TournamentChat.css** - стили для компонента чата

## Имеющиеся элементы в TournamentDetails.js

В компоненте TournamentDetails.js уже есть необходимые состояния и функции для работы чата:
- `chatMessages` - массив сообщений чата
- `newChatMessage` - текущее сообщение в поле ввода
- `chatEndRef` - ссылка на DOM-элемент для прокрутки к последнему сообщению
- `handleChatInputChange` - обработчик изменения ввода
- `handleChatSubmit` - обработчик отправки сообщения
- `handleChatKeyPress` - обработчик нажатия клавиш

Также имеется интеграция с WebSocket для реального времени:
- Socket.IO подключение для обмена сообщениями
- Обработчик события `tournament_message`
- Запрос истории сообщений при загрузке компонента

## Шаги по интеграции

1. **Добавить импорт компонента TournamentChat в TournamentDetails.js**:
   ```javascript
   import TournamentChat from './TournamentChat';
   ```

2. **Интегрировать компонент TournamentChat в JSX структуру**:
   - Найти в файле TournamentDetails.js блок с классом `tournament-layout` 
   - После закрытия div с классом `tournament-main` и перед закрытием div с классом `tournament-layout` добавить:
   ```jsx
   <TournamentChat 
       messages={chatMessages}
       newMessage={newChatMessage}
       onInputChange={handleChatInputChange}
       onSubmit={handleChatSubmit}
       onKeyPress={handleChatKeyPress}
       chatEndRef={chatEndRef}
       user={user}
   />
   ```

3. **Проверить работу стилей**:
   CSS-классы `.tournament-layout`, `.tournament-main` и `.tournament-chat-panel` уже определены в TournamentDetails.css и готовы к использованию.

## Структура JSX в TournamentDetails

```jsx
<section className="tournament-details">
    <div className="tournament-layout">
        <div className="tournament-main">
            {/* Существующий контент */}
        </div>
        
        {/* Сюда добавить компонент чата */}
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
    
    {/* Модальные окна и другие элементы */}
</section>
```

## Проверка функциональности

После интеграции компонента нужно убедиться, что:
1. Сообщения чата загружаются при открытии страницы турнира
2. Отправка новых сообщений работает корректно
3. Новые сообщения от других пользователей появляются в реальном времени
4. Чат адекватно отображается на разных размерах экрана 