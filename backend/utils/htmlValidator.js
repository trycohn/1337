/**
 * 🛡️ УТИЛИТА ДЛЯ ВАЛИДАЦИИ HTML КОНТЕНТА
 * Обеспечивает безопасность от XSS атак на стороне backend
 */

/**
 * Валидация HTML контента на предмет безопасности
 * @param {string} html - HTML контент для проверки
 * @param {Object} options - Опции валидации
 * @returns {Object} - Результат валидации { isValid, errors, sanitizedContent }
 */
function validateHtmlContent(html, options = {}) {
    const {
        maxLength = 10000,
        allowedTags = [
            'p', 'br', 'strong', 'em', 'u', 's', 'sub', 'sup',
            'ul', 'ol', 'li', 'blockquote', 'a', 'h3', 'h4', 'h5', 'h6'
        ],
        fieldName = 'контент'
    } = options;

    const errors = [];
    let isValid = true;

    // 1. Проверка на пустоту
    if (!html || typeof html !== 'string') {
        return {
            isValid: true,
            errors: [],
            sanitizedContent: ''
        };
    }

    // 2. Проверка длины
    if (html.length > maxLength) {
        errors.push(`${fieldName} превышает максимальную длину (${maxLength} символов)`);
        isValid = false;
    }

    // 3. Проверка на опасные паттерны
    const dangerousPatterns = [
        {
            pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            message: 'Обнаружен запрещенный тег <script>'
        },
        {
            pattern: /javascript:/gi,
            message: 'Обнаружена попытка использования javascript: протокола'
        },
        {
            pattern: /vbscript:/gi,
            message: 'Обнаружена попытка использования vbscript: протокола'
        },
        {
            pattern: /data:(?!image\/(?:png|jpe?g|gif|svg\+xml|webp);base64,)/gi,
            message: 'Обнаружена попытка использования data: протокола с небезопасным содержимым'
        },
        {
            pattern: /on\w+\s*=/gi,
            message: 'Обнаружены JavaScript обработчики событий (onclick, onload и т.д.)'
        },
        {
            pattern: /<iframe\b[^>]*>/gi,
            message: 'Обнаружен запрещенный тег <iframe>'
        },
        {
            pattern: /<object\b[^>]*>/gi,
            message: 'Обнаружен запрещенный тег <object>'
        },
        {
            pattern: /<embed\b[^>]*>/gi,
            message: 'Обнаружен запрещенный тег <embed>'
        },
        {
            pattern: /<form\b[^>]*>/gi,
            message: 'Обнаружен запрещенный тег <form>'
        },
        {
            pattern: /<input\b[^>]*>/gi,
            message: 'Обнаружен запрещенный тег <input>'
        },
        {
            pattern: /<textarea\b[^>]*>/gi,
            message: 'Обнаружен запрещенный тег <textarea>'
        },
        {
            pattern: /<select\b[^>]*>/gi,
            message: 'Обнаружен запрещенный тег <select>'
        },
        {
            pattern: /<button\b[^>]*>/gi,
            message: 'Обнаружен запрещенный тег <button>'
        },
        {
            pattern: /<style\b[^>]*>/gi,
            message: 'Обнаружен запрещенный тег <style>'
        },
        {
            pattern: /<link\b[^>]*>/gi,
            message: 'Обнаружен запрещенный тег <link>'
        },
        {
            pattern: /<meta\b[^>]*>/gi,
            message: 'Обнаружен запрещенный тег <meta>'
        },
        {
            pattern: /expression\s*\(/gi,
            message: 'Обнаружена попытка использования CSS expression'
        },
        {
            pattern: /import\s*\(/gi,
            message: 'Обнаружена попытка использования import()'
        },
        {
            pattern: /eval\s*\(/gi,
            message: 'Обнаружена попытка использования eval()'
        }
    ];

    // Проверяем каждый опасный паттерн
    for (const { pattern, message } of dangerousPatterns) {
        if (pattern.test(html)) {
            errors.push(`⚠️ Безопасность: ${message}`);
            isValid = false;
        }
    }

    // 4. Проверка разрешенных тегов (базовая)
    const tagPattern = /<(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/gi;
    let tagMatch;
    const foundTags = new Set();

    while ((tagMatch = tagPattern.exec(html)) !== null) {
        const tagName = tagMatch[2].toLowerCase();
        foundTags.add(tagName);
        
        if (!allowedTags.includes(tagName)) {
            errors.push(`Обнаружен неразрешенный HTML тег: <${tagName}>`);
            isValid = false;
        }
    }

    // 5. Проверка структуры HTML (базовая)
    const openTags = [];
    const tagStructurePattern = /<(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/gi;
    let structureMatch;

    while ((structureMatch = tagStructurePattern.exec(html)) !== null) {
        const isClosing = structureMatch[1] === '/';
        const tagName = structureMatch[2].toLowerCase();
        const isSelfClosing = structureMatch[0].endsWith('/>') || ['br', 'img', 'hr'].includes(tagName);

        if (isClosing) {
            if (openTags.length === 0 || openTags[openTags.length - 1] !== tagName) {
                // Предупреждение, но не критическая ошибка
                console.warn(`⚠️ Возможная проблема структуры HTML: неожиданный закрывающий тег </${tagName}>`);
            } else {
                openTags.pop();
            }
        } else if (!isSelfClosing) {
            openTags.push(tagName);
        }
    }

    // 6. Базовая санитизация (удаление наиболее опасных элементов)
    let sanitizedContent = html;
    
    if (!isValid) {
        // Если контент небезопасен, применяем агрессивную санитизацию
        sanitizedContent = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/vbscript:/gi, '')
            .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
            .replace(/<(iframe|object|embed|form|input|textarea|select|button|style|link|meta)\b[^>]*>/gi, '')
            .replace(/expression\s*\([^)]*\)/gi, '')
            .replace(/import\s*\([^)]*\)/gi, '')
            .replace(/eval\s*\([^)]*\)/gi, '');
    }

    return {
        isValid,
        errors,
        sanitizedContent,
        foundTags: Array.from(foundTags),
        warnings: openTags.length > 0 ? [`Незакрытые теги: ${openTags.join(', ')}`] : []
    };
}

/**
 * Валидация описания турнира
 * @param {string} description - Описание турнира
 * @returns {Object} - Результат валидации
 */
function validateTournamentDescription(description) {
    return validateHtmlContent(description, {
        maxLength: 3000,
        fieldName: 'Описание турнира'
    });
}

/**
 * Валидация регламента турнира
 * @param {string} rules - Регламент турнира
 * @returns {Object} - Результат валидации
 */
function validateTournamentRules(rules) {
    return validateHtmlContent(rules, {
        maxLength: 5000,
        fieldName: 'Регламент турнира'
    });
}

/**
 * Middleware для валидации HTML контента в запросах
 * @param {string} field - Поле для валидации
 * @param {Object} options - Опции валидации
 */
function validateHtmlMiddleware(field, options = {}) {
    return (req, res, next) => {
        const content = req.body[field];
        
        if (!content) {
            return next(); // Пропускаем пустое содержимое
        }

        const validation = validateHtmlContent(content, options);
        
        if (!validation.isValid) {
            return res.status(400).json({
                error: 'Содержимое не прошло проверку безопасности',
                details: validation.errors,
                field: field
            });
        }

        // Логируем предупреждения
        if (validation.warnings && validation.warnings.length > 0) {
            console.warn(`⚠️ HTML валидация - предупреждения для поля ${field}:`, validation.warnings);
        }

        // Заменяем контент на санитизированную версию
        req.body[field] = validation.sanitizedContent;
        
        next();
    };
}

module.exports = {
    validateHtmlContent,
    validateTournamentDescription,
    validateTournamentRules,
    validateHtmlMiddleware
};