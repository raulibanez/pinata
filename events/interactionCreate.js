const { InteractionType } = require('discord.js');
const { getGuild, getMatch } = require('../db.js');
const { matchMsg } = require('../messages.js');
const logger = require('../logger');
const { t } = require('../i18n');

module.exports = {
	name: 'interactionCreate',
	once: false,
	async execute(interaction) {
        // Button pressed
        if (interaction.isButton()) {
            const button = interaction.client.buttons.get(interaction.customId);

            if (!button) return;

            await button.execute(interaction); 
        }

        // Ignore non-message interactions
        if (interaction.type != InteractionType.ApplicationCommand) return;

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) return;

        await command.execute(interaction);
	},
};