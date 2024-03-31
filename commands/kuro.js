async function kuro(client, channel) {
    try {
        client.say(channel, `Who? lucyya2Love`);
    } catch (error) {
        console.error(error);
    }
}

module.exports = {
    name: 'kuro',
    description: 'Personal Command.',
    execute: async function (client, channel) {
        await kuro(client, channel);
    },
    globalCooldown: 60,
    userCooldown: 0,
    aliases: []
}