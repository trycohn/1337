import React, { useCallback, useMemo, useState, useEffect } from 'react';
import ReactQuillWrapper from './ReactQuillWrapper';
import SimpleBetterTextEditor from './SimpleBetterTextEditor';
import DOMPurify from 'dompurify';
import './SafeRichTextEditor.css';

/**
 * Безопасный Rich Text Editor с полной защитой от XSS
 * Использует DOMPurify для санитизации контента
 */
const SafeRichTextEditor = ({ 
    value = '', 
    onChange, 
    placeholder = 'Введите текст...', 
    disabled = false,
    maxLength = 5000,
    className = '',
    id
}) => {
    const [useSimpleEditor, setUseSimpleEditor] = useState(false);
    const [editorError, setEditorError] = useState(null);

    // Проверка совместимости React Quill
    useEffect(() => {
        // Проверяем наличие findDOMNode
        try {
            const ReactDOM = require('react-dom');
            if (!ReactDOM.findDOMNode) {
                console.warn('⚠️ [SafeRichTextEditor] findDOMNode не найден, используем простой редактор');
                setUseSimpleEditor(true);
            }
        } catch (error) {
            console.warn('⚠️ [SafeRichTextEditor] Ошибка проверки совместимости:', error);
            setUseSimpleEditor(true);
        }
    }, []);
    // Конфигурация DOMPurify для максимальной безопасности
    const purifyConfig = useMemo(() => ({
        ALLOWED_TAGS: [
            'p', 'br', 'strong', 'em', 'u', 's', 'sub', 'sup',
            'ul', 'ol', 'li', 'blockquote',
            'a', 'h3', 'h4', 'h5', 'h6'
        ],
        ALLOWED_ATTR: {
            'a': ['href', 'title'],
            '*': ['class'] // Только безопасные CSS классы
        },
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
        FORBID_TAGS: ['script', 'object', 'embed', 'iframe', 'form', 'input', 'textarea', 'select', 'button', 'style'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
        ALLOW_DATA_ATTR: false,
        ALLOW_UNKNOWN_PROTOCOLS: false,
        SANITIZE_DOM: true,
        KEEP_CONTENT: true,
        FORBID_SCRIPT: true,
        USE_PROFILES: { html: true }
    }), []);

    // Безопасная конфигурация toolbar - только необходимые функции
    const modules = useMemo(() => ({
        toolbar: [
            ['bold', 'italic', 'underline', 'strike'],        // Базовое форматирование
            [{ 'header': [3, 4, 5, 6, false] }],             // Заголовки (исключаем h1, h2)
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],     // Списки
            ['blockquote'],                                   // Цитаты
            ['link'],                                         // Только ссылки (без изображений)
            [{ 'script': 'sub'}, { 'script': 'super' }],     // Подстрочный/надстрочный текст
            ['clean']                                         // Очистка форматирования
        ],
        clipboard: {
            // Очистка вставляемого контента
            matchVisual: false,
        }
    }), []);

    // Разрешенные форматы (строго контролируем)
    const formats = useMemo(() => [
        'bold', 'italic', 'underline', 'strike',
        'header', 'list', 'bullet', 'blockquote',
        'link', 'script'
    ], []);

    // Безопасный обработчик изменений с санитизацией
    const handleChange = useCallback((content, delta, source, editor) => {
        try {
            // Получаем HTML контент
            const htmlContent = editor.getHTML();
            
            // Проверяем длину (до санитизации для производительности)
            if (htmlContent.length > maxLength) {
                return; // Блокируем слишком длинный контент
            }

            // Санитизируем контент
            const sanitizedContent = DOMPurify.sanitize(htmlContent, purifyConfig);
            
            // Дополнительная проверка на опасные паттерны
            const dangerousPatterns = [
                /javascript:/gi,
                /data:text\/html/gi,
                /vbscript:/gi,
                /on\w+\s*=/gi,
                /<script/gi,
                /<iframe/gi,
                /<object/gi,
                /<embed/gi,
                /expression\s*\(/gi
            ];

            const hasUnsafeContent = dangerousPatterns.some(pattern => pattern.test(sanitizedContent));
            
            if (hasUnsafeContent) {
                console.warn('⚠️ Заблокирован потенциально опасный контент');
                return;
            }

            // Передаем очищенный контент
            if (onChange && typeof onChange === 'function') {
                onChange(sanitizedContent);
            }
        } catch (error) {
            console.error('❌ Ошибка при обработке контента:', error);
        }
    }, [onChange, maxLength, purifyConfig]);

    // Безопасное значение для отображения
    const safeValue = useMemo(() => {
        if (!value) return '';
        
        try {
            return DOMPurify.sanitize(value, purifyConfig);
        } catch (error) {
            console.error('❌ Ошибка санитизации значения:', error);
            return '';
        }
    }, [value, purifyConfig]);

    // Если нужно использовать простой редактор
    if (useSimpleEditor || editorError) {
        return (
            <div className={`safe-rich-editor-fallback ${className}`}>
                {editorError && (
                    <div className="editor-error-notice">
                        ⚠️ Переключен на совместимый редактор
                    </div>
                )}
                <SimpleBetterTextEditor
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    disabled={disabled}
                    maxLength={maxLength}
                    id={id}
                />
            </div>
        );
    }

    return (
        <div className={`safe-rich-editor-container ${className}`}>
            <ReactQuillWrapper
                theme="snow"
                value={safeValue}
                onChange={handleChange}
                modules={modules}
                formats={formats}
                placeholder={placeholder}
                readOnly={disabled}
                className={`safe-rich-editor ${disabled ? 'disabled' : ''}`}
                id={id}
                bounds=".safe-rich-editor-container"
                preserveWhitespace={false}
            />
            
            {/* Счетчик символов */}
            <div className="editor-footer">
                <span className="character-count">
                    {safeValue.length} / {maxLength}
                </span>
                <span className="security-badge" title="Защищено DOMPurify">
                    🛡️ Безопасно
                </span>
            </div>
        </div>
    );
};

export default SafeRichTextEditor;