import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 🎯 УНИВЕРСАЛЬНЫЙ ХУК МОДАЛЬНОЙ СИСТЕМЫ
 * Создано опытным UI/UX разработчиком
 * Обеспечивает единообразное поведение всех модальных окон
 */

export const useModalSystem = (initialState = false, options = {}) => {
    const {
        closeOnEscape = true,
        closeOnOverlayClick = true,
        preventBodyScroll = true,
        focusTrap = true,
        onOpen = null,
        onClose = null,
        autoFocus = true
    } = options;

    const [isOpen, setIsOpen] = useState(initialState);
    const [isAnimating, setIsAnimating] = useState(false);
    const modalRef = useRef(null);
    const previousActiveElement = useRef(null);

    // Открытие модального окна
    const openModal = useCallback(() => {
        if (!isOpen) {
            if (autoFocus) {
                previousActiveElement.current = document.activeElement;
            }
            setIsOpen(true);
            setIsAnimating(true);
            
            if (preventBodyScroll) {
                document.body.style.overflow = 'hidden';
            }
            
            if (onOpen) {
                onOpen();
            }

            // Завершение анимации открытия
            setTimeout(() => {
                setIsAnimating(false);
                if (autoFocus && modalRef.current) {
                    const firstFocusable = modalRef.current.querySelector(
                        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                    );
                    if (firstFocusable) {
                        firstFocusable.focus();
                    }
                }
            }, 200);
        }
    }, [isOpen, preventBodyScroll, onOpen, autoFocus]);

    // Закрытие модального окна
    const closeModal = useCallback(() => {
        if (isOpen) {
            setIsAnimating(true);
            
            setTimeout(() => {
                setIsOpen(false);
                setIsAnimating(false);
                
                if (preventBodyScroll) {
                    document.body.style.overflow = '';
                }
                
                if (autoFocus && previousActiveElement.current) {
                    previousActiveElement.current.focus();
                }
                
                if (onClose) {
                    onClose();
                }
            }, 200);
        }
    }, [isOpen, preventBodyScroll, onClose, autoFocus]);

    // Переключение состояния модального окна
    const toggleModal = useCallback(() => {
        if (isOpen) {
            closeModal();
        } else {
            openModal();
        }
    }, [isOpen, openModal, closeModal]);

    // Обработка нажатия Escape
    useEffect(() => {
        const handleEscape = (event) => {
            if (closeOnEscape && event.key === 'Escape' && isOpen) {
                closeModal();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen, closeOnEscape, closeModal]);

    // Обработка клика по overlay
    const handleOverlayClick = useCallback((event) => {
        if (closeOnOverlayClick && event.target === event.currentTarget) {
            closeModal();
        }
    }, [closeOnOverlayClick, closeModal]);

    // Focus trap
    useEffect(() => {
        if (!focusTrap || !isOpen || !modalRef.current) return;

        const modal = modalRef.current;
        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length === 0) return;

        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        const handleTabKey = (e) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    lastFocusable.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === lastFocusable) {
                    firstFocusable.focus();
                    e.preventDefault();
                }
            }
        };

        modal.addEventListener('keydown', handleTabKey);
        return () => modal.removeEventListener('keydown', handleTabKey);
    }, [isOpen, focusTrap]);

    // Cleanup при размонтировании
    useEffect(() => {
        return () => {
            if (preventBodyScroll) {
                document.body.style.overflow = '';
            }
            if (autoFocus && previousActiveElement.current) {
                previousActiveElement.current.focus();
            }
        };
    }, [preventBodyScroll, autoFocus]);

    // Генерация классов для модального окна
    const getModalClasses = useCallback((size = 'medium') => {
        const baseClasses = ['modal-system-container'];
        
        if (size && size !== 'medium') {
            baseClasses.push(`modal-system-${size}`);
        }
        
        return baseClasses.join(' ');
    }, []);

    // Генерация классов для overlay
    const getOverlayClasses = useCallback(() => {
        const baseClasses = ['modal-system-overlay'];
        
        if (!isOpen || isAnimating) {
            baseClasses.push('modal-system-hidden');
        }
        
        return baseClasses.join(' ');
    }, [isOpen, isAnimating]);

    // Props для overlay
    const overlayProps = {
        className: getOverlayClasses(),
        onClick: handleOverlayClick,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-hidden': !isOpen,
        style: { display: isOpen ? 'flex' : 'none' }
    };

    // Props для контейнера
    const containerProps = {
        ref: modalRef,
        className: getModalClasses,
        tabIndex: -1,
        role: 'document'
    };

    return {
        // Состояние
        isOpen,
        isAnimating,
        
        // Методы управления
        openModal,
        closeModal,
        toggleModal,
        
        // Props для элементов
        overlayProps,
        containerProps,
        
        // Утилиты
        getModalClasses,
        getOverlayClasses,
        
        // Рефы
        modalRef
    };
};

/**
 * Хук для создания модального окна с предустановленными настройками
 */
export const useStandardModal = (options = {}) => {
    return useModalSystem(false, {
        closeOnEscape: true,
        closeOnOverlayClick: true,
        preventBodyScroll: true,
        focusTrap: true,
        autoFocus: true,
        ...options
    });
};

/**
 * Хук для создания модального окна деталей матча
 */
export const useMatchDetailsModal = (options = {}) => {
    return useModalSystem(false, {
        closeOnEscape: true,
        closeOnOverlayClick: false, // Не закрывать по клику вне модального окна
        preventBodyScroll: true,
        focusTrap: true,
        autoFocus: true,
        ...options
    });
};

/**
 * Хук для создания модального окна результата матча
 */
export const useMatchResultModal = (options = {}) => {
    return useModalSystem(false, {
        closeOnEscape: false, // Не закрывать по Escape для предотвращения потери данных
        closeOnOverlayClick: false,
        preventBodyScroll: true,
        focusTrap: true,
        autoFocus: true,
        ...options
    });
};

/**
 * Компонент обертка для модальных окон
 */
export const ModalSystemWrapper = ({ 
    children, 
    isOpen, 
    onClose, 
    size = 'medium',
    title,
    subtitle,
    className = '',
    ...props 
}) => {
    const modalSystem = useModalSystem(isOpen, {
        onClose,
        ...props
    });

    if (!isOpen) return null;

    return (
        <div {...modalSystem.overlayProps}>
            <div className={`${modalSystem.getModalClasses(size)} ${className}`}>
                {title && (
                    <div className="modal-system-header">
                        <div>
                            <h2 className="modal-system-title">{title}</h2>
                            {subtitle && <p className="modal-system-subtitle">{subtitle}</p>}
                        </div>
                        <button 
                            className="modal-system-close"
                            onClick={onClose}
                            aria-label="Закрыть модальное окно"
                        >
                            ✕
                        </button>
                    </div>
                )}
                <div className="modal-system-body">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default useModalSystem; 