// Get system status
export const fetchStatus = async () => {
    const response = await fetch(`/api/status`);
    if (!response.ok) {
        throw new Error(`Status fetch failed: ${response.status}`);
    }
    return response.json();
};

// Get list of recorded videos
export const fetchVideos = async () => {
    const response = await fetch(`/api/videos`);
    if (!response.ok) {
        throw new Error(`Videos fetch failed: ${response.status}`);
    }
    return response.json();
};

// Toggle LED
export const setLedStatus = async (flag) => {
    const response = await fetch(`/api/led?on=${flag ? 1 : 0}`);
    if (!response.ok) {
        throw new Error(`LED control failed: ${response.status}`);
    }
    return response.json();
};

// Control camera movement
export const movePanTilt = async (panTilt) => {
    const response = await fetch(`/api/move?pan=${panTilt.pan}&tilt=${panTilt.tilt}`);
    if (!response.ok) {
        throw new Error(`Camera movement failed: ${response.status}`);
    }
    return response.json();
};

// Reset system
export const resetSystem = async () => {
    const response = await fetch(`/api/reset`);
    if (!response.ok) {
        throw new Error(`System reset failed: ${response.status}`);
    }
    return response.json();
};

// Get camera stream URL
export const getStreamUrl = () => `/stream`;

// Export default object for backward compatibility
export default {
    fetchStatus,
    fetchVideos,
    setLedStatus,
    movePanTilt,
    getStreamUrl
};