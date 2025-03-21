require('dotenv').config();
const { REST, Routes } = require('discord.js');

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Fetching guild commands...');

        // Read the guild IDs from the environment variable (comma-separated)
        const guildIds = process.env.GUILD_IDS.split(',');

        for (const guildId of guildIds) {
            console.log(`Fetching commands from guild: ${guildId}`);
            const commands = await rest.get(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId.trim()),
            );

            if (commands.length === 0) {
                console.log(`No commands found in guild: ${guildId}`);
                continue;
            }

            console.log(`Found ${commands.length} commands in guild ${guildId}. Deleting...`);
            for (const command of commands) {
                await rest.delete(
                    Routes.applicationGuildCommand(process.env.CLIENT_ID, guildId.trim(), command.id),
                );
                console.log(`Deleted command: ${command.name} from guild: ${guildId}`);
            }
        }

        console.log('All guild commands have been unregistered ✅');
    } catch (error) {
        console.error(`Error unregistering guild commands: ${error}`);
    }
})();
