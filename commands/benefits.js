async function benefits(client, channel) {
    try {
        client.say(channel, `By subbing you get AD-Free viewing, You earn points faster to make sure I stay hydrated lucyya2Sip`);
    } catch (error) {
        console.error(error);
    }
}

module.exports = {
    name: 'benefits',
    description: 'Gives you a breif description of benefits of subscribing',
    execute: async function (client, channel) {
        await benefits(client, channel);
    },
    globalCooldown: 60,
    userCooldown: 0,
    aliases: ["benefit", "advantages", "subbenefits"]
}