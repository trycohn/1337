import axios from 'axios';

const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000',
    // Убедимся, что REACT_APP_API_URL в продакшене будет 'https://1337community.com'
});

console.log('🔍 axios baseURL:', api.defaults.baseURL);

api.interceptors.request.use(request => {
    console.log('🔍 Sending request to:', request.url);
    return request;
});

export default api;