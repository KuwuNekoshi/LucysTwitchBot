const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();

const volumePath = '/mnt/myvolume';
const clientId = process.env.BOT_CLIENT_ID;

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
            console.log('Access token refreshed. \nNew Tokens: ' + data.access_token + `\n` + data.refresh_token);
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

async function isStreamLive() {
    const broadcasterId = 217731363;

    const oAuthToken = await getToken();
    const url = `https://api.twitch.tv/helix/streams?user_id=${broadcasterId}`;
    const headers = {
        'Client-ID': process.env.BOT_CLIENT_ID,
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

async function startStreamCheck(channelName, client) {
    let streamWasLive = false;

    setInterval(async () => {
        const isLive = await isStreamLive(channelName);

        if (isLive && !streamWasLive) {
            const startUpMessages = [
                "Hey @Lucy_Yatogami! I'm all booted up and ready to assist in today's streaming adventures. Looking forward to seeing what we'll accomplish together today! ❤️",
                "Good day, @Lucy_Yatogami! Your trusty digital companion is here and eager to help make this stream the best one yet. Let's create some unforgettable moments! ✨",
                "Hello @Lucy_Yatogami! I'm online and at your service for today's stream. Excited to be a part of the journey and see where today takes us. Let's get started! 🚀",
                "@Lucy_Yatogami, reporting for duty! Ready to assist with all your streaming needs. I can't wait to see what today's stream brings. Together, we're unstoppable! 💪",
                "Welcome back, @Lucy_Yatogami! Your dedicated assistant is here and ready to support you through today's streaming endeavors. Let's make today's stream a memorable one! 🌟",
                "Streaming time is here, @Lucy_Yatogami! Let's dive into today's adventures with enthusiasm. The community awaits! 🌌",
                "It's showtime, @Lucy_Yatogami! Gear up for another epic day of streaming. Your co-pilot is ready for takeoff! 🚀",
                "Rise and shine, @Lucy_Yatogami! It's time to light up the digital world with your stream. Your faithful sidekick is here to ensure everything runs smoothly. Let's capture hearts! 💖",
                "Greetings, @Lucy_Yatogami! Fully charged and ready to navigate through today's streaming journey. Together, there's no challenge we can't overcome. Onwards to victory! 🏆",
                "Morning, @Lucy_Yatogami! It's another beautiful day to connect and entertain. I'm here to back you up every step of the way. Let's make waves! 🌊",
                "Hello, @Lucy_Yatogami! The stage is set, and the lights are on. It's your time to shine, and I'm here to spotlight your talents. Let the magic begin! ✨",
                "@Lucy_Yatogami, it's time to start the engines and launch into the streaming stratosphere. Your navigator is ready. Let's soar to new heights! 🌠",
                "Ahoy, @Lucy_Yatogami! Ready to set sail on today's streaming voyage? With your charisma and our teamwork, there's no storm we can't weather. Anchors aweigh! ⚓"
            ];

            const randomMessage = startUpMessages[Math.floor(Math.random() * startUpMessages.length)];
            client.say(channelName, randomMessage);

            streamWasLive = true;
        } else if (!isLive && streamWasLive) {
            streamWasLive = false;
        }
    }, 60000);
}


module.exports = { saveTokens, readTokens, refreshToken, getBroadcasterId, getToken, startStreamCheck };
