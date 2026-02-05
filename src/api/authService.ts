import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from '../config/api';

// Hardcode base URL to be absolutely sure
const BASE_URL = 'http://192.168.43.25:3000/api';

console.log('AuthService: Creating LOCAL axios instance');

const localClient = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

const authService = {
    login: async (email: string, password: string) => {
        try {
            console.log('Login attempt LOCAL:', { email, url: API_ENDPOINTS.LOGIN });
            // Direct call using local instance
            const response = await localClient.post(API_ENDPOINTS.LOGIN, { email, password });
            console.log('Login success data:', response.data);
            return response.data;
        } catch (error: any) {
            console.error('Login error detail:', error.message || error);
            if (error.response) {
                console.error('Server response:', error.response.status, error.response.data);
            }
            throw error;
        }
    },

    register: async (userData: any) => {
        const response = await localClient.post(API_ENDPOINTS.REGISTER, userData);
        return response.data;
    },

    getProfile: async () => {
        const token = await AsyncStorage.getItem('jwt_token');
        console.log('API Request: GET /user/profile');
        console.log('Auth Header:', token ? `Bearer ${token.substring(0, 10)}...` : 'None');
        const response = await localClient.get(API_ENDPOINTS.PROFILE, {
            headers: {
                Authorization: token ? `Bearer ${token}` : ''
            }
        });
        return response.data;
    },

    updateProfile: async (userData: { fullName?: string; phone?: string; dob?: string; gender?: string }) => {
        const token = await AsyncStorage.getItem('jwt_token');
        const response = await localClient.post('/user/profile/update', userData, {
            headers: {
                Authorization: token ? `Bearer ${token}` : ''
            }
        });
        return response.data;
    },

    uploadAvatar: async (imageUri: string) => {
        const token = await AsyncStorage.getItem('jwt_token');

        // Create FormData for image upload
        const formData = new FormData();
        formData.append('avatar', {
            uri: imageUri,
            type: 'image/jpeg',
            name: 'avatar.jpg',
        } as any);

        const response = await localClient.post('/user/profile/avatar', formData, {
            headers: {
                Authorization: token ? `Bearer ${token}` : '',
                'Content-Type': 'multipart/form-data',
            }
        });
        return response.data;
    }
};

export default authService;
