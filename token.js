const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();

const volumePath = '/mnt/myvolume';
const clientId = process.env.BCLIENT_ID;

async function getToken() {
    const tokens = await readTokens();
    return tokens.accessToken;
}

async function getBroadcasterId(channelName) {
    const oAuthToken = await getToken();
    const url = `https://api.twitch.tv/helix/users?login=${channelName}`;
    const headers = {
        'Client-ID': clientId,
        'Authorization': `Bearer ${oAuthToken}`,
    };

    try {
        const response = await fetch(url, { headers });
        const data = await response.json();
        if (data.data && data.data.length > 0) {
            return data.data[0].id;
        } else {
            console.log('User not found');
            return null;
        }
    } catch (error) {
        console.error('Error fetching broadcaster ID:', error);
        return null;
    }
}

async function saveTokens(accessToken, refreshToken) {
    const filePath = path.join(volumePath, 'tokens.json');
    const tokens = { accessToken, refreshToken };
    try {
        await fs.writeFile(filePath, JSON.stringify(tokens));
        console.log('Tokens saved successfully.');
    } catch (error) {
        console.error('Error saving tokens:', error);
    }
}

const tokenFilePath = path.join(volumePath, 'tokens.json');

async function readTokens() {
    try {
        await fs.access(tokenFilePath); // Check if the file exists
        const data = await fs.readFile(tokenFilePath);
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // If the file does not exist, return a default value or create the file
            console.log('tokens.json not found, creating file with default content.');
            const defaultTokens = { accessToken: process.env.BAccessToken, refreshToken: process.env.BRefreshToken };
            await fs.writeFile(tokenFilePath, JSON.stringify(defaultTokens));
            return defaultTokens;
        } else {
            console.error('Error reading tokens:', error);
            return null;
        }
    }
}


async function refreshToken(refreshToken) {
    const url = 'https://id.twitch.tv/oauth2/token';
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    params.append('client_id', process.env.BCLIENT_ID);
    params.append('client_secret', process.env.BCLIENT_SECRET);

    try {
        const response = await fetch(url, { method: 'POST', body: params });
        const data = await response.json();
        if (data.access_token) {
            await saveTokens(data.access_token, data.refresh_token);
            console.log('Access token refreshed.');
            return { accessToken: data.access_token, refreshToken: data.refresh_token };
        } else {
            console.error('Failed to refresh token:', data);
            return null;
        }
    } catch (error) {
        console.error('Error refreshing token:', error);
        return null;
    }
}

async function scheduledTokenRefresh() {
    try {
        const tokens = await readTokens();
        if (!tokens || !tokens.refreshToken) {
            console.error('No refresh token available.');
            return;
        }
        
        const refreshedTokens = await refreshToken(tokens.refreshToken);
        if (refreshedTokens) {
            console.log('Token refreshed successfully.');
        } else {
            console.error('Failed to refresh token.');
        }
    } catch (error) {
        console.error('Error in scheduled token refresh:', error);
    }
}

module.exports = { saveTokens, readTokens, refreshToken, scheduledTokenRefresh, getBroadcasterId, getToken };
