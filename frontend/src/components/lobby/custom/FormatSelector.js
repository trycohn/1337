// 📊 FormatSelector - Выбор формата матча (BO1, BO3, BO5)
import React, { useState } from 'react';
import './FormatSelector.css';

const FORMAT_OPTIONS = [
    { value: 'bo1', label: 'Best of 1', description: '1 карта' },
    { value: 'bo3', label: 'Best of 3', description: '3 карты' },
    { value: 'bo5', label: 'Best of 5', description: '5 карт' }
];

function FormatSelector({ currentFormat, onFormatChange, disabled = false }) {
    const [isChanging, setIsChanging] = useState(false);

    const handleChange = async (format) => {
        if (disabled || isChanging || format === currentFormat) return;
        
        setIsChanging(true);
        try {
            await onFormatChange(format);
        } finally {
            setIsChanging(false);
        }
    };

    return (
        <div className="format-selector">
            <div className="format-selector-header">
                <h3>📊 Формат матча</h3>
                {currentFormat && (
                    <span className="current-format-badge">
                        {FORMAT_OPTIONS.find(f => f.value === currentFormat)?.label}
                    </span>
                )}
            </div>
            
            <div className="format-options">
                {FORMAT_OPTIONS.map(option => (
                    <button
                        key={option.value}
                        className={`format-option ${currentFormat === option.value ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                        onClick={() => handleChange(option.value)}
                        disabled={disabled || isChanging}
                    >
                        <span className="format-label">{option.label}</span>
                        <span className="format-description">{option.description}</span>
                    </button>
                ))}
            </div>
            
            {!currentFormat && !disabled && (
                <p className="format-hint">
                    💡 Выберите формат матча перед началом игры
                </p>
            )}
        </div>
    );
}

export default FormatSelector;

