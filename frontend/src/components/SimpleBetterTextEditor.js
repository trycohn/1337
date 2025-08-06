import React, { useRef, useCallback, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import './SimpleBetterTextEditor.css';

/**
 * 🚀 ПРОСТОЙ НО МОЩНЫЙ RICH TEXT РЕДАКТОР
 * Альтернатива React Quill без проблем совместимости с React 19
 * Использует contentEditable с полной защитой от XSS
 */
const SimpleBetterTextEditor = ({ 
    value = '', 
    onChange, 
    placeholder = 'Введите текст...', 
    disabled = false,
    maxLength = 5000,
    className = '',
    id
}) => {
    const editorRef = useRef(null);
    const [isFocused, setIsFocused] = useState(false);
    const [currentLength, setCurrentLength] = useState(0);

    // Конфигурация DOMPurify для максимальной безопасности
    const purifyConfig = useMemo(() => ({
        ALLOWED_TAGS: [
            'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 
            'ul', 'ol', 'li', 'blockquote', 'a', 'h3', 'h4', 'h5', 'h6'
        ],
        ALLOWED_ATTR: {
            'a': ['href', 'title'],
            '*': ['class']
        },
        FORBID_TAGS: ['script', 'object', 'embed', 'iframe', 'form', 'input', 'textarea', 'select', 'button', 'style'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
        ALLOW_DATA_ATTR: false,
        SANITIZE_DOM: true,
        KEEP_CONTENT: true,
        FORBID_SCRIPT: true
    }), []);

    // Безопасная санитизация контента
    const sanitizeContent = useCallback((content) => {
        try {
            return DOMPurify.sanitize(content, purifyConfig);
        } catch (error) {
            console.error('❌ Ошибка санитизации:', error);
            return '';
        }
    }, [purifyConfig]);

    // Инициализация контента
    const safeValue = useMemo(() => {
        return sanitizeContent(value || '');
    }, [value, sanitizeContent]);

    // Обработка изменений контента
    const handleInput = useCallback((e) => {
        const content = e.target.innerHTML;
        const textLength = e.target.textContent.length;

        // Проверка длины
        if (textLength > maxLength) {
            // Обрезаем контент
            const truncated = e.target.textContent.substring(0, maxLength);
            e.target.textContent = truncated;
            return;
        }

        setCurrentLength(textLength);

        // Санитизация и передача наружу
        const sanitizedContent = sanitizeContent(content);
        
        if (onChange && typeof onChange === 'function') {
            onChange(sanitizedContent);
        }
    }, [onChange, maxLength, sanitizeContent]);

    // Обработка вставки контента
    const handlePaste = useCallback((e) => {
        e.preventDefault();
        
        // Получаем текст из буфера обмена
        const text = (e.clipboardData || window.clipboardData).getData('text');
        const sanitizedText = sanitizeContent(text);
        
        // Вставляем как обычный текст
        document.execCommand('insertText', false, sanitizedText);
    }, [sanitizeContent]);

    // Применение форматирования
    const applyFormat = useCallback((command, value = null) => {
        if (disabled) return;
        
        document.execCommand(command, false, value);
        editorRef.current?.focus();
        
        // Обновляем контент после форматирования
        const content = editorRef.current?.innerHTML || '';
        const sanitizedContent = sanitizeContent(content);
        
        if (onChange) {
            onChange(sanitizedContent);
        }
    }, [disabled, onChange, sanitizeContent]);

    // Обработчики кнопок форматирования
    const formatHandlers = useMemo(() => ({
        bold: () => applyFormat('bold'),
        italic: () => applyFormat('italic'),
        underline: () => applyFormat('underline'),
        strikethrough: () => applyFormat('strikeThrough'),
        insertUnorderedList: () => applyFormat('insertUnorderedList'),
        insertOrderedList: () => applyFormat('insertOrderedList'),
        formatBlock: (tag) => applyFormat('formatBlock', tag),
        createLink: () => {
            const url = prompt('Введите URL:');
            if (url) {
                applyFormat('createLink', url);
            }
        },
        removeFormat: () => applyFormat('removeFormat')
    }), [applyFormat]);

    // Обработка фокуса
    const handleFocus = useCallback(() => {
        setIsFocused(true);
    }, []);

    const handleBlur = useCallback(() => {
        setIsFocused(false);
    }, []);

    // Обновление контента при изменении value извне
    React.useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== safeValue) {
            editorRef.current.innerHTML = safeValue;
            setCurrentLength(editorRef.current.textContent.length);
        }
    }, [safeValue]);

    return (
        <div className={`simple-text-editor ${className} ${isFocused ? 'focused' : ''} ${disabled ? 'disabled' : ''}`}>
            {/* Панель инструментов */}
            <div className="editor-toolbar">
                <div className="toolbar-group">
                    <button 
                        type="button" 
                        onClick={formatHandlers.bold}
                        disabled={disabled}
                        title="Жирный (Ctrl+B)"
                    >
                        <strong>B</strong>
                    </button>
                    <button 
                        type="button" 
                        onClick={formatHandlers.italic}
                        disabled={disabled}
                        title="Курсив (Ctrl+I)"
                    >
                        <em>I</em>
                    </button>
                    <button 
                        type="button" 
                        onClick={formatHandlers.underline}
                        disabled={disabled}
                        title="Подчеркивание (Ctrl+U)"
                    >
                        <u>U</u>
                    </button>
                    <button 
                        type="button" 
                        onClick={formatHandlers.strikethrough}
                        disabled={disabled}
                        title="Зачеркивание"
                    >
                        <s>S</s>
                    </button>
                </div>

                <div className="toolbar-separator"></div>

                <div className="toolbar-group">
                    <select 
                        onChange={(e) => formatHandlers.formatBlock(e.target.value)}
                        disabled={disabled}
                        defaultValue=""
                    >
                        <option value="">Обычный текст</option>
                        <option value="h3">Заголовок 3</option>
                        <option value="h4">Заголовок 4</option>
                        <option value="h5">Заголовок 5</option>
                        <option value="h6">Заголовок 6</option>
                        <option value="blockquote">Цитата</option>
                    </select>
                </div>

                <div className="toolbar-separator"></div>

                <div className="toolbar-group">
                    <button 
                        type="button" 
                        onClick={formatHandlers.insertUnorderedList}
                        disabled={disabled}
                        title="Маркированный список"
                    >
                        • Список
                    </button>
                    <button 
                        type="button" 
                        onClick={formatHandlers.insertOrderedList}
                        disabled={disabled}
                        title="Нумерованный список"
                    >
                        1. Список
                    </button>
                </div>

                <div className="toolbar-separator"></div>

                <div className="toolbar-group">
                    <button 
                        type="button" 
                        onClick={formatHandlers.createLink}
                        disabled={disabled}
                        title="Вставить ссылку"
                    >
                        🔗 Ссылка
                    </button>
                    <button 
                        type="button" 
                        onClick={formatHandlers.removeFormat}
                        disabled={disabled}
                        title="Очистить форматирование"
                    >
                        🧹 Очистить
                    </button>
                </div>
            </div>

            {/* Редактор */}
            <div
                ref={editorRef}
                contentEditable={!disabled}
                className="editor-content"
                onInput={handleInput}
                onPaste={handlePaste}
                onFocus={handleFocus}
                onBlur={handleBlur}
                data-placeholder={placeholder}
                id={id}
                suppressContentEditableWarning={true}
                dangerouslySetInnerHTML={{ __html: safeValue }}
            />

            {/* Подвал с информацией */}
            <div className="editor-footer">
                <span className="character-count">
                    {currentLength} / {maxLength}
                </span>
                <span className="security-badge" title="Защищено DOMPurify">
                    🛡️ Безопасно
                </span>
            </div>
        </div>
    );
};

export default SimpleBetterTextEditor;