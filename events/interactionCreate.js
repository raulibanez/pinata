const { InteractionType } = require('discord.js');
const { getOrAddGuild } = require('../db.js');
const { matchMsg } = require('../messages.js');
const logger = require('../logger');
const { t } = require('../i18n');

module.exports = {
	name: 'interactionCreate',
	once: false,
	async execute(interaction) {
        // Every command and button needs the guild registered: it may have added
        // the bot while it was offline or during startup
        if (interaction.guild) {
            try {
                await getOrAddGuild(interaction.guild);
            } catch (error) {
                logger.error(error, 'Error');
            }
        }

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