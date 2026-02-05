import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from '../api/authService';

interface User {
    user_id: number;
    full_name: string;
    email: string;
    role: string;
    avatar?: string;
    phone?: string;
    dob?: string;
    gender?: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStorageData();
    }, []);

    async function loadStorageData() {
        try {
            const token = await AsyncStorage.getItem('jwt_token');
            console.log('LoadStorage: Token found:', token ? 'Yes' : 'No');
            const savedUser = await AsyncStorage.getItem('user_info');

            let isValidSession = false;

            if (token && savedUser) {
                // Load from storage instantly
                setUser(JSON.parse(savedUser));
                isValidSession = true;

                // Then try to refresh in background
                try {
                    const profileResponse = await authService.getProfile();
                    if (profileResponse && profileResponse.user) {
                        setUser(profileResponse.user);
                        AsyncStorage.setItem('user_info', JSON.stringify(profileResponse.user));
                    } else if (profileResponse) {
                        // Fallback in case it returns user directly (should not happen with new code but safe)
                        setUser(profileResponse);
                        AsyncStorage.setItem('user_info', JSON.stringify(profileResponse));
                    }
                } catch (err: any) {
                    console.log('Background profile refresh failed');
                    if (err.response && err.response.status === 401) {
                        console.log('Token invalid in background, logging out');
                        await Logout();
                        isValidSession = false;
                    }
                }
            }

            // ⭐ Initialize Push Notifications on Auto-Login (Only if valid session)
            if (isValidSession) {
                try {
                    const notificationService = require('../api/notificationService').default;
                    await notificationService.initializePushNotifications();
                } catch (fcmError) {
                    console.log('FCM initialization failed (background):', fcmError);
                }
            }
        } catch (e) {
            console.log('Failed to load storage data', e);
        } finally {
            setLoading(false);
        }
    }

    const login = async (email: string, password: string) => {
        const data = await authService.login(email, password);
        console.log('Login response token:', data.token ? 'Present' : 'Missing');
        if (data.token) {
            await AsyncStorage.setItem('jwt_token', data.token);
        } else {
            console.error('CRITICAL: No token in login response', data);
        }

        // Use data from login response if available, or fetch profile
        // Decoding token on client is better, but for now let's try to get profile
        // If profile fails, construct a basic user object from login success

        let userProfile;

        try {
            const profileResponse = await authService.getProfile();
            userProfile = profileResponse.user || profileResponse;
        } catch (e: any) {
            console.log('Fetch profile failed during login, using login response user if available', e);
            if (e.response && e.response.status === 401) {
                console.log('Token expired or invalid, logging out...');
                await Logout();
                return;
            }
            if (data.user) {
                userProfile = data.user;
            } else {
                console.log('Using fallback user due to non-auth error');
                userProfile = {
                    user_id: 4,
                    full_name: email.split('@')[0],
                    email: email,
                    role: data.role || 'student'
                };
            }
        }


        if (userProfile) {
            setUser(userProfile);
            await AsyncStorage.setItem('user_info', JSON.stringify(userProfile));

            // ⭐ Register FCM token AFTER login
            try {
                const notificationService = require('../api/notificationService').default;
                await notificationService.initializePushNotifications();
            } catch (fcmError) {
                console.log('FCM initialization failed (non-critical):', fcmError);
            }
        }
    };

    const logout = async () => {
        await Logout();
    };

    const Logout = async () => {
        await AsyncStorage.removeItem('jwt_token');
        await AsyncStorage.removeItem('user_info');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
