const fs = require('fs');
const path = require('path');
require('dotenv').config({path: '.env'});
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { BOT_TOKEN, CLIENT_ID } = process.env;

const commands = [];
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(path.join(__dirname, '../commands', file));
	commands.push(command.data.toJSON());
}

const rest = new REST({ version: '9' }).setToken(BOT_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();