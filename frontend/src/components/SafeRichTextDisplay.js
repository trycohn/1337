import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import './SafeRichTextDisplay.css';

/**
 * Безопасный компонент для отображения Rich Text контента
 * Использует DOMPurify для санитизации перед рендерингом
 */
const SafeRichTextDisplay = ({ 
    content = '', 
    className = '', 
    maxLength = null,
    showReadMore = false,
    onReadMoreClick = null 
}) => {
    // Строгая конфигурация DOMPurify для отображения
    const displayPurifyConfig = useMemo(() => ({
        ALLOWED_TAGS: [
            'p', 'br', 'strong', 'em', 'u', 's', 'sub', 'sup',
            'ul', 'ol', 'li', 'blockquote',
            'a', 'h3', 'h4', 'h5', 'h6'
        ],
        ALLOWED_ATTR: {
            'a': ['href', 'title', 'target', 'rel'],
            '*': ['class']
        },
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
        FORBID_TAGS: [
            'script', 'object', 'embed', 'iframe', 'form', 
            'input', 'textarea', 'select', 'button', 'style', 
            'meta', 'link', 'title', 'base'
        ],
        FORBID_ATTR: [
            'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 
            'onblur', 'onchange', 'onsubmit', 'onkeydown', 'onkeyup',
            'onmousedown', 'onmouseup', 'onmousemove', 'style'
        ],
        ALLOW_DATA_ATTR: false,
        ALLOW_UNKNOWN_PROTOCOLS: false,
        SANITIZE_DOM: true,
        KEEP_CONTENT: true,
        FORBID_SCRIPT: true,
        USE_PROFILES: { html: true },
        // Дополнительная безопасность для ссылок
        ADD_ATTR: { 'target': '_blank', 'rel': 'noopener noreferrer' },
        FORCE_BODY: false,
        RETURN_DOM: false,
        RETURN_DOM_FRAGMENT: false
    }), []);

    // Безопасная санитизация контента
    const sanitizedContent = useMemo(() => {
        if (!content || typeof content !== 'string') {
            return '';
        }

        try {
            // Первичная санитизация
            let cleanContent = DOMPurify.sanitize(content, displayPurifyConfig);
            
            // Дополнительная проверка на опасные паттерны
            const dangerousPatterns = [
                /javascript:/gi,
                /data:(?!image\/(?:png|jpe?g|gif|svg\+xml|webp);base64,)/gi,
                /vbscript:/gi,
                /on\w+\s*=/gi,
                /<script/gi,
                /<iframe/gi,
                /<object/gi,
                /<embed/gi,
                /expression\s*\(/gi,
                /import\s*\(/gi,
                /eval\s*\(/gi
            ];

            const hasUnsafeContent = dangerousPatterns.some(pattern => pattern.test(cleanContent));
            
            if (hasUnsafeContent) {
                console.warn('⚠️ Обнаружен и удален потенциально опасный контент');
                // Повторная санитизация с более строгими правилами
                cleanContent = DOMPurify.sanitize(cleanContent, {
                    ...displayPurifyConfig,
                    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li'],
                    ALLOWED_ATTR: {}
                });
            }

            // Обрезка по длине если нужно
            if (maxLength && cleanContent.length > maxLength) {
                const truncated = cleanContent.substring(0, maxLength);
                const lastSpace = truncated.lastIndexOf(' ');
                const cutPoint = lastSpace > maxLength * 0.8 ? lastSpace : maxLength;
                cleanContent = truncated.substring(0, cutPoint) + '...';
            }

            return cleanContent;
        } catch (error) {
            console.error('❌ Ошибка санитизации контента для отображения:', error);
            return '<p>Ошибка загрузки контента</p>';
        }
    }, [content, displayPurifyConfig, maxLength]);

    // Проверка на пустой контент
    const isEmpty = useMemo(() => {
        if (!sanitizedContent) return true;
        
        // Убираем HTML теги и проверяем на пустоту
        const textContent = sanitizedContent.replace(/<[^>]*>/g, '').trim();
        return textContent.length === 0;
    }, [sanitizedContent]);

    // Если контент пустой
    if (isEmpty) {
        return (
            <div className={`safe-rich-display empty-content ${className}`}>
                <p className="no-content-message">Контент не добавлен</p>
            </div>
        );
    }

    return (
        <div className={`safe-rich-display ${className}`}>
            <div 
                className="rich-content"
                dangerouslySetInnerHTML={{ __html: sanitizedContent }}
            />
            
            {/* Кнопка "Читать далее" если контент обрезан */}
            {showReadMore && maxLength && content.length > maxLength && (
                <button 
                    className="read-more-btn"
                    onClick={onReadMoreClick}
                    type="button"
                >
                    Читать далее
                </button>
            )}
            
            {/* Индикатор безопасности (только в dev режиме) */}
            {process.env.NODE_ENV === 'development' && (
                <div className="security-indicator" title="Контент санитизирован DOMPurify">
                    🛡️
                </div>
            )}
        </div>
    );
};

export default SafeRichTextDisplay;