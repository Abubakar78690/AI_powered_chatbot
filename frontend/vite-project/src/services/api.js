import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export const chatAPI = {
  sendMessage: async (message) => {
    const res = await api.post('/api/chat', { message });
    return res.data;
  },
};

export default api;