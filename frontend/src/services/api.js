import axios from 'axios';



const API_URL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production'
  ? 'https://majorprojectcse-production.up.railway.app/api'
  : 'http://localhost:5000/api');

// const API_URL = process.env.NODE_ENV === 'production' 
//   ? 'https://major-project-cse-22.onrender.com/api'
//   : 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});


// Add token to requests
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['x-auth-token'] = token;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Handle response errors
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
      // Token is invalid or expired
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;