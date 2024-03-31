async function lurk(client, channel, username) {
    try {
        global.lurkers.add(username);
        client.say(channel, `/me lucyya2Peek ${username} is now lurking, come back soon! lucyya2Wave`);
    } catch (error) {
        console.error(error);
    }
}

module.exports = {
    name: 'lurk',
    description: 'Allows you to lurk',
    execute: async function (client, channel, tags) {
        await lurk(client, channel, tags.username);
    },
    globalCooldown: 0,
    userCooldown: 600,
    aliases: []
};
