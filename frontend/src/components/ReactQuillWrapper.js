import React, { useRef, useEffect, forwardRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import Quill from 'quill';

/**
 * Wrapper для React Quill совместимый с React 19
 * Обходит проблему с findDOMNode
 */
const ReactQuillWrapper = forwardRef(({ 
    value, 
    onChange, 
    modules, 
    formats, 
    placeholder, 
    readOnly, 
    className,
    id,
    bounds,
    preserveWhitespace,
    theme = 'snow'
}, ref) => {
    // Регистрация кастомного атрибута line-height как style-атрибута (формат)
    useEffect(() => {
        try {
            const Parchment = Quill.import('parchment');
            // Проверяем, не зарегистрирован ли уже формат с именем 'lineheight'
            const already = Quill.imports && (Quill.imports['formats/lineheight'] || Quill.imports['attributors/style/lineheight']);
            if (!already) {
                const LineHeightStyle = new Parchment.Attributor.Style('lineheight', 'line-height', {
                    scope: Parchment.Scope.BLOCK,
                    whitelist: ['0.5', '1', '1.5', '2']
                });
                Quill.register(LineHeightStyle, true);
            }
        } catch (e) {
            console.warn('⚠️ [ReactQuillWrapper] Не удалось зарегистрировать line-height формат:', e);
        }
    }, []);
    const quillRef = useRef(null);
    const containerRef = useRef(null);

    // Полифилл для findDOMNode (временное решение для React 19)
    useEffect(() => {
        if (typeof window !== 'undefined' && window.React) {
            const ReactDOM = require('react-dom');
            
            // Создаем полифилл findDOMNode только если его нет
            if (!ReactDOM.findDOMNode) {
                ReactDOM.findDOMNode = (component) => {
                    // Если это ref на DOM элемент
                    if (component && component.current) {
                        return component.current;
                    }
                    
                    // Если это DOM элемент
                    if (component && component.nodeType) {
                        return component;
                    }
                    
                    // Если это React компонент с _reactInternalFiber
                    if (component && component._reactInternalFiber) {
                        const fiber = component._reactInternalFiber;
                        let node = fiber;
                        
                        // Поиск DOM узла в fiber дереве
                        while (node) {
                            if (node.stateNode && node.stateNode.nodeType) {
                                return node.stateNode;
                            }
                            node = node.child;
                        }
                    }
                    
                    // Fallback - возвращаем контейнер
                    return containerRef.current;
                };
                
                console.warn('⚠️ [ReactQuillWrapper] Применен полифилл findDOMNode для совместимости с React 19');
            }
        }
    }, []);

    // Проброс ref наружу
    useEffect(() => {
        if (ref) {
            if (typeof ref === 'function') {
                ref(quillRef.current);
            } else {
                ref.current = quillRef.current;
            }
        }
    }, [ref]);

    const handleChange = (content, delta, source, editor) => {
        if (onChange) {
            onChange(content, delta, source, editor);
        }
    };

    return (
        <div ref={containerRef} className={className}>
            <ReactQuill
                ref={quillRef}
                theme={theme}
                value={value || ''}
                onChange={handleChange}
                modules={modules}
                formats={formats}
                placeholder={placeholder}
                readOnly={readOnly}
                id={id}
                bounds={bounds}
                preserveWhitespace={preserveWhitespace}
            />
        </div>
    );
});

ReactQuillWrapper.displayName = 'ReactQuillWrapper';

export default ReactQuillWrapper;