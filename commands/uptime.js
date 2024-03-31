const fetch = require('node-fetch');
const { getBroadcasterId, getToken } = require('../token');
require('dotenv').config();

async function uptimeCommand(client, channel, tags, message) {
    const clientId = process.env.BCLIENT_ID;
    const accessToken = await getToken();
    const broadcasterId = await getBroadcasterId(process.env.CHANNEL_NAME);

    const url = `https://api.twitch.tv/helix/streams?user_id=${broadcasterId}`;
    const headers = {
        'Client-ID': clientId,
        'Authorization': `Bearer ${accessToken}`
    };

    try {
        const response = await fetch(url, { headers });
        const data = await response.json();

        if (data.data.length > 0) {
            const stream = data.data[0];
            const startTime = new Date(stream.started_at);
            const currentTime = new Date();
            const uptime = currentTime - startTime;

            const minutes = Math.floor(uptime / (1000 * 60));
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            const formattedUptime = `${days > 0 ? `${days} day(s), ` : ""}${hours % 24} hour(s), and ${minutes % 60} minute(s)`;

            client.say(channel, `The stream has been live for ${formattedUptime}.`);
        } else {
            client.say(channel, `The stream is currently offline.`);
        }
    } catch (error) {
        console.error(error);
        client.say(channel, `@${tags.username}, an error occurred while trying to retrieve stream uptime.`);
    }
}

module.exports = {
    name: 'uptime',
    execute: async function (client, channel, tags, message) {
        await uptimeCommand(client, channel, tags, message);
    },
    globalCooldown: 60,
    userCooldown: 0,
    aliases: []
}