import React, { useState, useRef } from 'react';

function AttachmentMenu({ onSendAttachment }) {
    const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
    const fileInputRef = useRef(null);

    const handleAttachmentClick = () => {
        setShowAttachmentOptions(!showAttachmentOptions);
    };

    const handleAttachmentTypeSelect = (type) => {
        fileInputRef.current.setAttribute('data-type', type);
        fileInputRef.current.click();
        setShowAttachmentOptions(false);
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const type = fileInputRef.current.getAttribute('data-type');
        onSendAttachment(file, type);
        
        // Сбрасываем значение input, чтобы можно было выбрать тот же файл снова
        e.target.value = '';
    };

    return (
        <>
            <div className="attachment-button" onClick={handleAttachmentClick}>
                <i className="attachment-icon">📎</i>
                
                {showAttachmentOptions && (
                    <div className="attachment-options">
                        <div className="attachment-option" onClick={() => handleAttachmentTypeSelect('image')}>
                            <i>📷</i> Фото
                        </div>
                        <div className="attachment-option" onClick={() => handleAttachmentTypeSelect('document')}>
                            <i>📄</i> Документ
                        </div>
                        <div className="attachment-option" onClick={() => handleAttachmentTypeSelect('file')}>
                            <i>📁</i> Файл
                        </div>
                    </div>
                )}
            </div>
            
            <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileSelect}
            />
        </>
    );
}

export default AttachmentMenu; 