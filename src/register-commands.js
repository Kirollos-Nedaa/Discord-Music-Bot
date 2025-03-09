require('dotenv').config();
const { REST, Routes, ApplicationCommandOptionType, ButtonBuilder, ButtonStyle } = require('discord.js');

// Bot Commands Registration 
const commands = [
    {
        name: 'play',
        description: 'Play a Song',
        options: [
            {
                name: 'query',
                description: 'Name or URL of track to play',
                type: ApplicationCommandOptionType.String,
                required: true,
            },
        ],
    },
    { name: 'pause', description: 'Pause the Song' },
    { name: 'resume', description: 'Resume the Song' },
    { name: 'stop', description: 'Stop the Song' },
    { name: 'skip', description: 'Skips the current Song' },
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Registering Commands...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log('Commands Registered ✅');
    } catch (error) {
        console.error(`Error registering commands: ${error}`);
    }
})();

