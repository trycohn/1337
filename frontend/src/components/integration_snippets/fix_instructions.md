# Инструкция по исправлению ошибки сборки и интеграции чата

## Шаг 1: Исправление ошибки дублирующихся импортов

Ошибка: `Syntax error: Identifier 'useHandleRequestAdmin' has already been declared. (85:9) (85:9)`

В файле `TournamentDetails.js` обнаружено дублирование импортов, включая 
`useHandleRequestAdmin` и многие другие. Необходимо заменить все импорты на исправленный список.

1. Откройте файл `1337/frontend/src/components/TournamentDetails.js`
2. Замените **все импорты** в начале файла (до начала кода компонента) на список из файла `fixed_imports.js` 
3. Убедитесь, что удалили все повторяющиеся импорты

## Шаг 2: Интеграция компонента чата

После исправления импортов нужно добавить компонент чата в JSX структуру:

1. В файле `TournamentDetails.js` найдите структуру возвращаемого JSX
2. Найдите блок, содержащий `<div className="tournament-layout">`
3. Внутри этого блока, перед закрывающим тегом `</div>` (после блока `<div className="tournament-main">...</div>`) добавьте компонент TournamentChat, как показано в файле `chat_jsx_integration.js`

Итоговая структура должна выглядеть так:

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

## Шаг 3: Сборка и тестирование

1. Сохраните изменения
2. Запустите сборку проекта
3. Убедитесь, что ошибка "Identifier has already been declared" больше не появляется
4. Проверьте работу чата на странице турнира 