function listCommands(client, channel, commands, message) {
    const parts = message.split(' ').map(part => part.trim()).filter(part => part);
    const commandRequested = parts.length > 1 ? parts[1].toLowerCase() : '';

    if (commandRequested) {
        let command = commands.get(`!${commandRequested}`) || Array.from(commands.values()).find(cmd => cmd.aliases && cmd.aliases.includes(commandRequested));
        if (!command) {
            command = commands.get(commandRequested);
        }
        if (command) {
            const response = command.description ? `!${command.name}: ${command.description}` : `!${command.name} does not have a description.`;
            client.say(channel, response);
        } else {
            client.say(channel, `The command "${commandRequested}" does not exist.`);
        }
    } else {
        const commandList = Array.from(commands.keys()).join(', ');
        client.say(channel, `Available commands: ${commandList}`);
    }
}


module.exports = {
    name: 'commands',
    description: 'Lists all available commands or details of a specific command.',
    execute(client, channel, tags, message, commands) {
        listCommands(client, channel, commands, message);
    },
    globalCooldown: 60,
    userCooldown: 0,
    aliases: ['help', 'cmds']
};
