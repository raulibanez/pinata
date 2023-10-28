require('dotenv').config({path: '../.env'});
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuild, resetHistory } = require('../db.js');

const logger = require('../logger');

const { t } = require('../i18n');

async function reset(interaction) {
	logger.info({
			guild_id: interaction.guild.id,
			guild_name: interaction.guild.name,
			member_id: interaction.member.id,
			member_name: interaction.member.user.username,
			channel_id: interaction.channelId,
		},'Reset command executed'
	);

	// Get guild
	const guild = await getGuild(interaction.guild.id);

	await resetHistory(interaction);

	interaction.reply({ content: t('User pairing history has been removed', guild.language), ephemeral: true });
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('reset')
		.setDescription('Remove history')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	async execute(interaction) {
		// Manage interaction
		try {
			// Check if the user is authorized (aka admin)
			if (interaction.member.permissions.has('ADMINISTRATOR')) {
				await reset(interaction);
			} else {
				// Logging unauthorized command attempt
				logger.info(
					{
						guild_id: interaction.guildId,
						guild_name: interaction.guild.name,
						member_id: interaction.member.id,
						member_name: interaction.member.user.username,
					},
					'Unauthorized user'
				);

				interaction.reply({ content: t('Permission required to execute this command'), ephemeral: true });
			}
		} catch (error) {
      logger(error, 'Error');
		}
	}
};