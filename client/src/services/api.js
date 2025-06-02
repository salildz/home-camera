const API_URL = '/backend';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const loginUser = async (username, password) => {
    const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    return response.json();
};

export const getStreamUrl = () => {
    const token = localStorage.getItem('token');
    return `${API_URL}/stream?token=${token || ''}`;
};

export const fetchStatus = async () => {
    const response = await fetch(`${API_URL}/status`, { headers: getAuthHeaders() });
    if (!response.ok) {
        if (response.status === 401) {
            localStorage.removeItem('token');
            window.location.reload();
        }
        throw new Error(`Status fetch failed: ${response.status}`);
    }
    const data = await response.json();
    return data;
};

export const setLedStatus = async (flag) => {
    const response = await fetch(`${API_URL}/led?on=${flag ? 1 : 0}`, {
        headers: getAuthHeaders()
    });

    if (!response.ok) {
        throw new Error(`LED control failed: ${response.status}`);
    }

    return response.json();
};

export const movePanTilt = async (panTilt) => {
    const response = await fetch(`${API_URL}/move?pan=${panTilt.pan}&tilt=${panTilt.tilt}`, {
        headers: getAuthHeaders()
    });

    if (!response.ok) {
        throw new Error(`Camera movement failed: ${response.status}`);
    }

    return response.json();
};

export const resetSystem = async () => {
    const response = await fetch(`${API_URL}/reset`, {
        headers: getAuthHeaders()
    });

    if (!response.ok) {
        throw new Error(`System reset failed: ${response.status}`);
    }

    return response.json();
};

export default {
    fetchStatus,
    setLedStatus,
    movePanTilt,
    resetSystem,
    loginUser,
    getStreamUrl
};