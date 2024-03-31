require('dotenv').config();
const tmi = require('tmi.js');
const fs = require('fs');
const path = require('path');
const pool = require('./database');
const { readTokens, refreshToken, scheduledTokenRefresh } = require('./token');
const { startRewardHandler } = require('./rewardhandler');


let lastChatTimestamp = Date.now();
const globalCooldowns = new Map();
const userCooldowns = new Map();
global.lurkers = new Set();


async function startBot() {
    const client = new tmi.Client({
        options: { debug: true },
        connection: {
            secure: true,
            reconnect: true,
        },
        identity: {
            username: process.env.BOT_USERNAME,
            password: process.env.OAUTH_TOKEN,
        },
        channels: [ process.env.CHANNEL_NAME ],
    });

    let { accessToken, refreshToken: currentRefreshToken } = await readTokens();

    if (!accessToken || !currentRefreshToken) {
        accessToken = process.env.BAccessToken
        currentRefreshToken = process.env.BRefreshToken
        console.log('Initialised the tokens from env.');
        }

    const tokens = await refreshToken(currentRefreshToken);
    if (tokens) {
        accessToken = tokens.accessToken;
        currentRefreshToken = tokens.refreshToken;
    }

    startRewardHandler(process.env.CHANNEL_NAME)
    .then(() => console.log('Reward handler started successfully.'))
    .catch((error) => console.error('Failed to start the reward handler:', error));


    const refreshInterval = 3 * 60 * 60 * 1000 + 45 * 60 * 1000;
    setInterval(scheduledTokenRefresh, refreshInterval);

    client.connect();

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
            client.say(channel, `/me bellat62OwO Welcome back from lurking, ${tags.username}!`);
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
            command.execute(client, channel, tags, message, commands, pool);
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
            `Wow, @${userstate.username}, thanks for the ${userstate.bits} bits! 🌸 bellat62Happy`,
            `@${userstate.username}, you're amazing! Thanks for the ${userstate.bits} bits! bellat62HugChat`,
            `Cheers for the cheers, @${userstate.username}! ${userstate.bits} bits, that's so nice of you <3 bellat62Happy`,
            `You've brightened the den, @${userstate.username}! ${userstate.bits} bits are lighting up our day! bellat62OwO`,
            `Look at you go, @${userstate.username}! Dropping ${userstate.bits} bits like a true Kitsune legend! bellat62OwO`,
            `With every bit, you help the Kitsune Family grow stronger! Thank you, @${userstate.username}, for the ${userstate.bits} bits! bellat62HugChat`
        ];

        const randomMessage = thankYouMessages[Math.floor(Math.random() * thankYouMessages.length)];
        client.say(channel, randomMessage);
    });

    client.on('subscription', (channel, username) => {
        const thankYouMessages = [
            `Welcome to the Kitsune Family, @${username}! Thanks for putting on the mask! bellat62Happy`,
            `Hey @${username}, thanks for hitting that subscribe button! bellat62Comfy`,
            `Thank you to @${username} for subscribing! Welcome to the Kitsune Family! bellat62HugChat`,
            `@${username} has joined the pack! Let's welcome them with open paws! 🐾 bellat62OwO`,
            `A new Kitsune enters the den! @${username}, your mask awaits! bellat62Happy`,
            `Thanks for subscribing, @${username}! The Kitsune spirits are dancing tonight! 🦊 bellat62Comfy`
        ];

        const randomMessage = thankYouMessages[Math.floor(Math.random() * thankYouMessages.length)];
        client.say(channel, randomMessage);
    });

    client.on('subgift', (channel, username, recipient, userstate) => {
        let senderCount = userstate['msg-param-sender-count'];
        const thankYouMessages = [
            `@${username} just gifted a sub to @${recipient}! That's ${senderCount} Kitsune Masks in total! bellat62OwO`,
            `What a legend! @${username} gifted a sub to @${recipient}. Thank you for your generosity! bellat62HugChat`,
            `Woah! Thank you @${username} for gifting a Kitsune Mask to @${recipient}. You're the best! bellat62OwO`,
            `The spirit of giving shines bright! @${username} to @${recipient}, a gift of companionship! 🌟 bellat62Happy`,
            `A gift from one Kitsune to another, @${username} gifts a sub to @${recipient}. The family grows! 🎁 bellat62Comfy`,
            `Generosity flows through our den! @${username} gifts @${recipient} a mask. Welcome them! 🦊 bellat62HugChat`
        ];
        const randomMessage = thankYouMessages[Math.floor(Math.random() * thankYouMessages.length)];
        client.say(channel, randomMessage);
    });

    client.on('resub', (channel, username, months) => {
        const cumulativeMonths = months;
        const thankYouMessages = [
            `@${username}, you've been a Kitsune for ${cumulativeMonths} months! Incredible! Thanks for sticking around! bellat62HugChat`,
            `Woohoo! @${username} is rocking those Kitsune Masks for ${cumulativeMonths} months now! Thank you for your amazing support! bellat62OwO`,
            `Look at that! @${username} has been part of the Kitsune Family for ${cumulativeMonths} months! Thanks for your continued support! bellat62Happy`,
            `Another month, another mask! @${username}, your collection grows. ${cumulativeMonths} months of being amazing! 🎉 bellat62Comfy`,
            `The journey continues! @${username}, thanks for ${cumulativeMonths} months of adventures and tales! 🐾 bellat62OwO`,
            `Your loyalty lights up the den, @${username}! ${cumulativeMonths} months and still going strong! 🔥 bellat62Happy`
        ];

        const randomMessage = thankYouMessages[Math.floor(Math.random() * thankYouMessages.length)];
        client.say(channel, randomMessage);
    }); 


    const messages = [
        "Don't forget to follow the stream if you're enjoying the content! bellat62OwO", 
        "Want to change the Raid Rotations? > You can change them for just 1000 channel points at any point! > Do \"!change\" for a detailed guide bellat62Comfy",
        "Thanks for hanging out with us today! bellat62HugChat", 
        "Want to support the stream? > Turn off Ad-block, give the stream a follow or consider subscribing for the extra perks! bellat62OwO",
        "Want to change the Raid Rotations? > You can change them for just 1000 channel points at any point! > Do \"!change\" for a detailed guide bellat62Comfy",
        "Remember to hydrate bellat62Sip and take breaks bellat62Comfy",
        "Want to support the stream? > Turn off Ad-block, give the stream a follow or consider subscribing for the extra perks! ♥",
        "Tired of ads? Subscribe to watch ad-free and get access to the raids 10 seconds* earlier through Discord! bellat62Noted ",
        "Want to change the Raid Rotations? > You can change them for just 1000 channel points at any point! > Do \"!change\" for a detailed guide bellat62Comfy",
        "Hope you're enjoying your stay at the Cherry Blossoms bellat62HugChat"
        ];
    let currentMessageIndex = 0;

    function sendAutomatedMessage(channel) {
        const timeSinceLastChat = Date.now() - lastChatTimestamp;
        if (timeSinceLastChat < 60000 * 10) {
            client.say(channel, messages[currentMessageIndex]);
            currentMessageIndex = (currentMessageIndex + 1) % messages.length;
        }
    }

    setInterval(() => sendAutomatedMessage(process.env.CHANNEL_NAME), 60000 * 10);
}

 startBot().catch(console.error);