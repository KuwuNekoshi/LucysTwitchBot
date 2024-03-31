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
        await fs.access(tokenFilePath);
        const data = await fs.readFile(tokenFilePath);
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('tokens.json not found, creating file with default content.');
            const defaultTokens = { accessToken: process.env.OAUTH_TOKEN, refreshToken: process.env.BOT_REFRSHTOKEN };
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
    params.append('client_id', process.env.BOT_CLIENT_ID);
    params.append('client_secret', process.env.BOT_SECRET);

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

async function isStreamLive(channelName) {
    const broadcasterId = await getBroadcasterId(channelName);
    if (!broadcasterId) {
        console.log(`Could not find broadcaster ID for ${channelName}`);
        return false;
    }

    const oAuthToken = await getToken();
    const url = `https://api.twitch.tv/helix/streams?user_id=${broadcasterId}`;
    const headers = {
        'Client-ID': clientId,
        'Authorization': `Bearer ${oAuthToken}`,
    };

    try {
        const response = await fetch(url, { headers });
        const data = await response.json();
        return data.data && data.data.length > 0 && data.data[0].type === 'live';
    } catch (error) {
        console.error(`Error checking stream status for ${channelName}:`, error);
        return false;
    }
}

async function startStreamCheck(channelName) {
    let streamWasLive = false; // Track the previous state

    setInterval(async () => {
        const isLive = await isStreamLive(channelName);

        if (isLive && !streamWasLive) {
            // Stream has just gone live
            streamStartMessages.forEach(async (msg) => {
                // Assuming 'client' is your initialized tmi.js client
                client.say(channelName, msg);
            });
            streamWasLive = true;
        } else if (!isLive && streamWasLive) {
            // Stream has ended
            streamWasLive = false;
        }
    }, 60000);
}

module.exports = { saveTokens, readTokens, refreshToken, getBroadcasterId, getToken, startStreamCheck };
