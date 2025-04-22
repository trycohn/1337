import axios from 'axios';

// Setup axios: in development use relative paths (proxy), in production use REACT_APP_API_URL
const api = axios.create({
    baseURL: process.env.NODE_ENV === 'production'
        ? process.env.REACT_APP_API_URL
        : ''
});

console.log('🔍 axios baseURL:', api.defaults.baseURL);

api.interceptors.request.use(request => {
    console.log('🔍 Sending request to:', request.url);
    return request;
});

export default api;