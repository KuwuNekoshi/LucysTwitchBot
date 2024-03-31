const WebSocket = require('ws');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const pool = require('./database');
const { readTokens, getBroadcasterId, getToken } = require('./token'); // Ensure the path is correct

require('dotenv').config();

const clientId = process.env.BCLIENT_ID;
const volumePath = '/mnt/myvolume';
let reconnectAttempts = 0;
let pingInterval;

async function saveRewardToggleState(rewardName, isEnabled) {
    const filePath = path.join(volumePath, 'rewardToggleStates.json');
    let states = {};
    try {
        const data = await fs.readFile(filePath);
        states = JSON.parse(data);
    } catch (readError) {
        console.log('No existing reward toggle states, creating new.');
    }
    states[rewardName] = isEnabled;
    await fs.writeFile(filePath, JSON.stringify(states));
    console.log(`Toggle state for ${rewardName} saved successfully.`);
}

async function readRewardToggleState(rewardName) {
    const filePath = path.join(volumePath, 'rewardToggleStates.json');
    try {
        const data = await fs.readFile(filePath);
        const states = JSON.parse(data);
        return states[rewardName];
    } catch (error) {
        console.error('Error reading reward toggle state:', error);
        return null; // Or false, depending on how you want to handle this case
    }
}

async function fulfillRedemption(broadcasterId, rewardId, redemptionId) {
    const tokens = await readTokens();
    const url = `https://api.twitch.tv/helix/channel_points/custom_rewards/redemptions?broadcaster_id=${broadcasterId}&reward_id=${rewardId}&id=${redemptionId}`;
    try {
        const response = await axios.patch(url, { status: 'FULFILLED' }, {
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${tokens.accessToken}`,
                'Content-Type': 'application/json',
            },
        });
        console.log(`Successfully fulfilled redemption ${redemptionId} for reward ${rewardId}.`);
    } catch (error) {
        console.error('Error fulfilling redemption:', error);
    }
}

async function setupWebSocket(broadcasterId) {
    let token = await getToken();
    const socket = new WebSocket('wss://pubsub-edge.twitch.tv');

    socket.on('open', () => {
        console.log("Successfully started WebSocket Connection.");
        // Reset reconnect attempts on successful connection
        reconnectAttempts = 0;

        const message = {
            type: 'LISTEN',
            nonce: Math.random().toString(36).substring(2, 15),
            data: {
                topics: [`channel-points-channel-v1.${broadcasterId}`],
                auth_token: token,
            },
        };
        socket.send(JSON.stringify(message));

        // Setup PING interval
        clearInterval(pingInterval);
        pingInterval = setInterval(() => {
            console.log('Sending PING to Twitch PubSub');
            socket.send(JSON.stringify({ type: 'PING' }));
        }, 270000); // 4 minutes and 30 seconds
    });

    socket.on('message', async (data) => {
        console.log(`Received message: ${data}`);
        const messageData = JSON.parse(data);
        if (messageData.type === 'MESSAGE' && messageData.data) {
            const message = JSON.parse(messageData.data.message);

            if (message.type === 'reward-redeemed') {
                const rewardName = message.data.redemption.reward.title;
                const redemptionId = message.data.redemption.id;
                const rewardId = message.data.redemption.reward.id;
                const redeemer = message.data.redemption.user.display_name.toLowerCase();
            
                const autoRedeemEnabled = await readRewardToggleState(rewardName) || false;

                if (rewardName == "Raid Change Token") {
                    await addRaidTokenToUser(redeemer);
                    await fulfillRedemption(broadcasterId, rewardId, redemptionId);
                }

                if (autoRedeemEnabled) {
                    console.log(`Automatically fulfilling redemption for reward: ${rewardName}`);
                    await fulfillRedemption(broadcasterId, rewardId, redemptionId);
                }
            }
        } else if (messageData.type === 'PONG') {
            console.log('Received PONG from Twitch PubSub');
        } else if (messageData.type === 'RECONNECT') {
            console.log('Twitch PubSub requests RECONNECT');
            socket.close();
        }
    });


    socket.on('close', (code, reason) => {
        console.error(`WebSocket closed with code: ${code}, reason: ${reason}. Attempting to reconnect with exponential backoff...`);
        clearInterval(pingInterval);
        exponentialBackoffReconnect(broadcasterId);
    });

    socket.on('error', (error) => {
        console.error('WebSocket Error:', error);
        exponentialBackoffReconnect(broadcasterId);
    });
}

async function addRaidTokenToUser(username) {
    try {
        // Upsert query for MySQL
        const upsertQuery = `
            INSERT INTO twitch_links (twitch_username, raid_token)
            VALUES (LOWER(?), 1)
            ON DUPLICATE KEY UPDATE raid_token = raid_token + 1;
        `;
        await pool.query(upsertQuery, [username]);
        console.log(`User ${username} processed for raid token.`);
    } catch (error) {
        console.error(`Error processing raid token for ${username}:`, error);
    }
}

function exponentialBackoffReconnect(broadcasterId) {
    const delay = Math.min(30000, Math.pow(2, reconnectAttempts) * 1000 - 1000);
    setTimeout(() => setupWebSocket(broadcasterId), delay);
    reconnectAttempts++;
}

async function startRewardHandler(channelName) {
    const broadcasterId = await getBroadcasterId(channelName);
    if (!broadcasterId) {
        console.error('Broadcaster ID could not be fetched. Exiting...');
        return;
    }

    setupWebSocket(broadcasterId);
}

module.exports = { startRewardHandler, saveRewardToggleState, readRewardToggleState };
