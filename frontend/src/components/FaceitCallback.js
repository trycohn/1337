import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../axios';

const FaceitCallback = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const handleCallback = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            const state = urlParams.get('state');

            if (!code) {
                navigate('/profile?error=no_code');
                return;
            }

            if (state !== 'faceit_auth') {
                navigate('/profile?error=invalid_state');
                return;
            }

            try {
                const token = localStorage.getItem('token');
                const response = await api.post('/api/users/faceit-callback', { code }, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (response.data.success) {
                    navigate('/profile?faceit=success');
                } else {
                    navigate('/profile?error=faceit_error');
                }
            } catch (error) {
                console.error('FACEIT callback error:', error);
                navigate('/profile?error=faceit_error');
            }
        };

        handleCallback();
    }, [navigate]);

    return <div>Обработка авторизации FACEIT...</div>;
};

export default FaceitCallback; 