async function pingCommand(client, channel, tags) {
    if (tags.mod || tags['user-type'] === 'mod' || tags.badges?.broadcaster === '1') {
        client.say(channel, `@${tags.username}, Pong!`);
    }
}

module.exports = {
    name: 'ping',
    description: 'Pong?',
    execute: async function (client, channel, tags) {
        await pingCommand(client, channel, tags);
    },
    globalCooldown: 60,
    userCooldown: 0,
    aliases: []
};