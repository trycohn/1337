import React, { useEffect } from 'react';

const FaceitSDK = ({ onInit }) => {
    useEffect(() => {
        // Динамически загружаем FACEIT SDK
        const script = document.createElement('script');
        script.src = 'https://cdn.faceit.com/oauth/faceit-oauth-sdk-1.3.0.min.js';
        script.type = 'text/javascript';
        script.async = true;
        
        script.onload = () => {
            // Инициализируем SDK после загрузки
            const initParams = {
                client_id: process.env.REACT_APP_FACEIT_CLIENT_ID,
                response_type: 'code',
                state: 'faceit_auth',
                redirect_popup: true,
                debug: process.env.NODE_ENV === 'development'
            };
            
            if (window.FACEIT) {
                window.FACEIT.init(initParams);
                if (onInit) {
                    onInit(window.FACEIT);
                }
            }
        };

        document.body.appendChild(script);

        return () => {
            // Очищаем скрипт при размонтировании компонента
            document.body.removeChild(script);
        };
    }, [onInit]);

    return null;
};

export default FaceitSDK; 