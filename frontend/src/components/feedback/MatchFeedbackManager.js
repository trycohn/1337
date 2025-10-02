/**
 * 🎮 MATCH FEEDBACK MANAGER
 * Управление показом модалок feedback после завершения матча
 * 
 * @version 1.0.0
 * @date 2025-10-02
 */

import React, { useState, useEffect } from 'react';
import FeedbackPromptModal from './FeedbackPromptModal';
import PostMatchFeedbackModal from './PostMatchFeedbackModal';

function MatchFeedbackManager({ matchId, matchInfo, triggerShow, onComplete }) {
    const [showPrompt, setShowPrompt] = useState(false);
    const [showFullForm, setShowFullForm] = useState(false);
    
    useEffect(() => {
        if (triggerShow && matchId) {
            // Показать первую модалку с задержкой (чтобы пользователь увидел результат матча)
            setTimeout(() => {
                setShowPrompt(true);
            }, 1500);
        }
    }, [triggerShow, matchId]);
    
    const handleAcceptFeedback = () => {
        setShowPrompt(false);
        // Небольшая задержка перед открытием полной формы
        setTimeout(() => {
            setShowFullForm(true);
        }, 200);
    };
    
    const handleClosePrompt = () => {
        setShowPrompt(false);
        if (onComplete) onComplete();
    };
    
    const handleCloseFullForm = () => {
        setShowFullForm(false);
        if (onComplete) onComplete();
    };
    
    return (
        <>
            <FeedbackPromptModal
                isOpen={showPrompt}
                onClose={handleClosePrompt}
                onAccept={handleAcceptFeedback}
                matchInfo={matchInfo}
            />
            
            <PostMatchFeedbackModal
                isOpen={showFullForm}
                onClose={handleCloseFullForm}
                matchId={matchId}
                matchInfo={matchInfo}
            />
        </>
    );
}

export default MatchFeedbackManager;

