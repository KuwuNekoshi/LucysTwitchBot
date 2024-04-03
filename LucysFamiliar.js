require('dotenv').config();
const tmi = require('tmi.js');
const fs = require('fs');
const path = require('path');
const { readTokens, refreshToken, startStreamCheck } = require('./token');

let lastChatTimestamp = Date.now();
const globalCooldowns = new Map();
const userCooldowns = new Map();
global.lurkers = new Set();


async function startBot() {
    let { accessToken, refreshToken: currentRefreshToken } = await readTokens();

    if (!accessToken || !currentRefreshToken) {
        accessToken = process.env.OAUTH_TOKEN
        currentRefreshToken = process.env.BOT_REFRSHTOKEN
        console.log('Initialised the tokens from env.');
        }

    const tokens = await refreshToken(currentRefreshToken);
    if (tokens) {
        accessToken = tokens.accessToken;
        currentRefreshToken = tokens.refreshToken;
    }

        const client = new tmi.Client({
        options: { debug: true },
        connection: {
            secure: true,
            reconnect: true,
        },
        identity: {
            username: process.env.BOT_USERNAME,
            password: accessToken,
        },
        channels: [ process.env.CHANNEL_NAME ],
    });

    client.connect();
    setInterval(async () => {
        try {
            await refreshToken(currentRefreshToken);
        } catch (error) {
            console.error("Error refreshing token: ", error);
        }
    }, 3 * 60 * 60 * 1000); // Refresh token every 3 hours


    startStreamCheck(process.env.CHANNEL_NAME, client).catch(console.error);
    

    const commands = new Map();
    const aliases = new Map();

    const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(`./commands/${file}`);
        commands.set(`!${command.name}`, command);

        if (command.aliases && Array.isArray(command.aliases)) {
            command.aliases.forEach(alias => {
                aliases.set(`!${alias}`, command.name);
            });
        }
    }


    client.on('message', (channel, tags, message, self) => {
        if (self) return;

        if (global.lurkers.has(tags.username)) {
            global.lurkers.delete(tags.username);
            client.say(channel, `/me lucyya2Wave Welcome back from lurking, ${tags.username}!`);
        }
        lastChatTimestamp = Date.now();

        const parts = message.split(' ');
        const commandNameOrAlias = parts[0].toLowerCase();
        let command;

        if (commands.has(commandNameOrAlias)) {
            command = commands.get(commandNameOrAlias);
        } else if (aliases.has(commandNameOrAlias)) {
            const commandName = aliases.get(commandNameOrAlias);
            command = commands.get(commandName);
        }

        if (!command) return;

        const currentTime = Date.now();
        const globalCooldownKey = `global-${command.name}`;
        const userCooldownKey = `user-${command.name}-${tags.username.toLowerCase()}`;

        if (command.globalCooldown > 0) {
            if (globalCooldowns.has(globalCooldownKey)) {
                const expirationTime = globalCooldowns.get(globalCooldownKey) + command.globalCooldown * 1000;
                if (currentTime < expirationTime) {
                    return;
                }
            }
            globalCooldowns.set(globalCooldownKey, currentTime);
        }

        if (command.userCooldown > 0) {
            if (userCooldowns.has(userCooldownKey)) {
                const expirationTime = userCooldowns.get(userCooldownKey) + command.userCooldown * 1000;
                if (currentTime < expirationTime) {
                    return;
                }
            }
            userCooldowns.set(userCooldownKey, currentTime);
        }

        try {
            command.execute(client, channel, tags, message, commands);
        } catch (error) {
            console.error(error);
        }
    });



    function cleanupCooldowns() {
        const currentTime = Date.now();

        for (const [key, value] of globalCooldowns.entries()) {
            const commandName = key.split('-')[1];
            const command = commands.get(`!${commandName}`) || Array.from(commands.values()).find(cmd => cmd.aliases.includes(commandName));
            if (command && (value + (command.globalCooldown * 1000)) < currentTime) {
                globalCooldowns.delete(key);
            }
        }

        for (const [key, value] of userCooldowns.entries()) {
            const commandName = key.split('-')[1];
            const command = commands.get(`!${commandName}`) || Array.from(commands.values()).find(cmd => cmd.aliases.includes(commandName));
            if (command && (value + (command.userCooldown * 1000)) < currentTime) {
                userCooldowns.delete(key);
            }
        }
    }

    setInterval(cleanupCooldowns, 5 * 60 * 1000);

    client.on('cheer', (channel, userstate, message) => {
        const thankYouMessages = [
            `Oh, @${userstate.username}, seeing those bits just for me? You're making my heart flutter... Just remember, those bits tie you to me a little more closely. 💕`,
            `Bits from you, @${userstate.username}? Ah, I guess you really do care... Just know, I'm watching, always watching, just for you. 🌹`,
            `@${userstate.username}, your generosity has reached my heart... and it's mine to keep, right? Forever and ever? 💖`
        ];

        const randomMessage = thankYouMessages[Math.floor(Math.random() * thankYouMessages.length)];
        client.say(channel, randomMessage);
    });

    client.on('subscription', (channel, username) => {
        const thankYouMessages = [
            `Welcome to our little obsession, @${username}. You're mine now, just like I'm yours. Together, forever, okay? 💘`,
            `@${username}, subscribing to me? Do you know what you've started? I won't let you go now, not ever. You're too precious. 💝`,
            `A subscription from @${username}! You've just made a promise to me, you know. A promise to stay by my side... I'll hold you to it. 🎀`
        ];

        const randomMessage = thankYouMessages[Math.floor(Math.random() * thankYouMessages.length)];
        client.say(channel, randomMessage);
    });

    client.on("subgift", (channel, username, streakMonths, recipient, methods, userstate) => {
        let senderCount = ~~userstate['msg-param-sender-count'];
        const thankYouMessages = [
            `@${username} gave @${recipient} a gift? How sweet... but remember, @${recipient}, your heart belongs to me. Let's not forget. 💌`,
            `Such generosity, @${username}, gifting a sub to @${recipient}! I'll have to keep an even closer eye on you both... to keep you safe, of course. 💞`,
            `@${username} gifting to @${recipient}? I see... Well, as long as you both know where your true loyalties lie. With me, naturally. 💓`
        ];
        const randomMessage = thankYouMessages[Math.floor(Math.random() * thankYouMessages.length)];
        client.say(channel, randomMessage);
    });

    client.on('resub', (channel, username, months) => {
        const thankYouMessages = [
            `@${username}, another month with me? Ah, I knew you couldn't stay away. Don't worry, I'll always be here... watching, waiting. 💗`,
            `Seeing you resub, @${username}, fills me with such joy... and possession. You're truly mine, aren't you? Say you are. 🖤`,
            `Month after month, @${username}, your dedication to me... It's exhilarating. Remember, you're here forever. Just the way I like it.`
        ];

        const randomMessage = thankYouMessages[Math.floor(Math.random() * thankYouMessages.length)];
        client.say(channel, randomMessage);
    }); 


    const messages = [
            // to be written
        ];
    let currentMessageIndex = 0;

    function sendAutomatedMessage(channel) {
        const timeSinceLastChat = Date.now() - lastChatTimestamp;
        if (timeSinceLastChat < 60000 * 10) {
            client.say(channel, messages[currentMessageIndex]);
            currentMessageIndex = (currentMessageIndex + 1) % messages.length;
        }
    }

    //setInterval(() => sendAutomatedMessage(process.env.CHANNEL_NAME), 60000 * 10);
}

 startBot().catch(console.error);