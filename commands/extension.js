async function extension(client, channel) {
    try {
        client.say(channel, `If you're using a chromium based browser, you can install this extension. It'll automatically collect points, and support the stream by keeping your viewing AD viable. It helps us maintain and upgrade as we go! So it really means a lot <3`);
        client.say(channel, `https://chromewebstore.google.com/detail/automatic-twitch-drops-mo/kfhgpagdjjoieckminnmigmpeclkdmjm`);
    } catch (error) {
        console.error(error);
    }
}

module.exports = {
    name: 'extension',
    description: 'Informs you about the browser extension that automatically collects points.',
    execute: async function (client, channel) {
        await extension(client, channel);
    },
    globalCooldown: 60,
    userCooldown: 0,
    aliases: ["auto", "farm"]
}