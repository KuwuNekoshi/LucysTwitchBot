async function discord(client, channel) {
    try {
        client.say(channel, `Come join our Discord for a huge community around Pokémon and Gaming in general.. And Lucy!⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀ ➥⠀https://discord.gg/lucysimps`);
    } catch (error) {
        console.error(error);
    }
}

module.exports = {
    name: 'discord',
    description: 'Gives you the link to our Discord.',
    execute: async function (client, channel) {
        await discord(client, channel);
    },
    globalCooldown: 60,
    userCooldown: 0,
    aliases: []
}