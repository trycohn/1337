/**
 * 🛠️ ПОЛИФИЛЛ ДЛЯ СОВМЕСТИМОСТИ REACT 19 С REACT QUILL
 * Восстанавливает функцию findDOMNode для библиотек, которые ее используют
 */

export function installReact19Polyfill() {
    // Проверяем, что мы в браузере
    if (typeof window === 'undefined') {
        return;
    }

    try {
        const ReactDOM = require('react-dom');
        
        // Если findDOMNode уже существует, ничего не делаем
        if (ReactDOM.findDOMNode) {
            console.log('✅ [React19Polyfill] findDOMNode уже существует');
            return;
        }

        console.warn('⚠️ [React19Polyfill] findDOMNode не найден, устанавливаем полифилл для совместимости с React Quill');

        /**
         * Полифилл findDOMNode для React 19
         * @param {*} component - React компонент или DOM элемент
         * @returns {Element|null} DOM элемент или null
         */
        ReactDOM.findDOMNode = function(component) {
            // Если передан null или undefined
            if (!component) {
                return null;
            }

            // Если это уже DOM элемент
            if (component.nodeType) {
                return component;
            }

            // Если это React ref с current
            if (component.current) {
                if (component.current.nodeType) {
                    return component.current;
                }
                // Рекурсивно проверяем current
                return ReactDOM.findDOMNode(component.current);
            }

            // Если это React компонент с _reactInternalFiber (React 16-17)
            if (component._reactInternalFiber) {
                return findDOMNodeFromFiber(component._reactInternalFiber);
            }

            // Если это React компонент с _reactInternals (React 18+)
            if (component._reactInternals) {
                return findDOMNodeFromFiber(component._reactInternals);
            }

            // Если это функциональный компонент или другой объект
            if (typeof component === 'object') {
                // Ищем в различных возможных местах
                const possiblePaths = [
                    'stateNode',
                    'child.stateNode', 
                    'return.stateNode',
                    'elementType.stateNode'
                ];

                for (const path of possiblePaths) {
                    const node = getNestedProperty(component, path);
                    if (node && node.nodeType) {
                        return node;
                    }
                }
            }

            // Последняя попытка - если это элемент с querySelector
            if (typeof component === 'string') {
                return document.querySelector(component);
            }

            console.warn('⚠️ [React19Polyfill] Не удалось найти DOM узел для:', component);
            return null;
        };

        /**
         * Поиск DOM узла в React Fiber дереве
         * @param {Object} fiber - React Fiber узел
         * @returns {Element|null}
         */
        function findDOMNodeFromFiber(fiber) {
            if (!fiber) return null;

            // Если у fiber есть stateNode и это DOM элемент
            if (fiber.stateNode && fiber.stateNode.nodeType) {
                return fiber.stateNode;
            }

            // Рекурсивно ищем в дочерних узлах
            let node = fiber.child;
            while (node) {
                const domNode = findDOMNodeFromFiber(node);
                if (domNode) return domNode;
                node = node.sibling;
            }

            return null;
        }

        /**
         * Получение вложенного свойства по пути
         * @param {Object} obj - Объект
         * @param {string} path - Путь к свойству (например, 'a.b.c')
         * @returns {*}
         */
        function getNestedProperty(obj, path) {
            return path.split('.').reduce((current, key) => {
                return current && current[key];
            }, obj);
        }

        console.log('✅ [React19Polyfill] Полифилл findDOMNode успешно установлен');

    } catch (error) {
        console.error('❌ [React19Polyfill] Ошибка установки полифилла:', error);
        
        // Создаем минимальный fallback
        try {
            const ReactDOM = require('react-dom');
            if (!ReactDOM.findDOMNode) {
                ReactDOM.findDOMNode = () => {
                    console.warn('⚠️ [React19Polyfill] Используется fallback findDOMNode');
                    return document.body; // Возвращаем body как последний вариант
                };
            }
        } catch (fallbackError) {
            console.error('❌ [React19Polyfill] Критическая ошибка:', fallbackError);
        }
    }
}

/**
 * Автоматическая установка полифилла при импорте
 */
if (typeof window !== 'undefined') {
    // Устанавливаем полифилл после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installReact19Polyfill);
    } else {
        installReact19Polyfill();
    }
}