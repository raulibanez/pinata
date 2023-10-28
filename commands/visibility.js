require('dotenv').config({path: '../.env'});
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuild, updateGuild } = require('../db.js');
const {
	visibilityModifiedMsg,
    currentVisibilityMsg
} = require('../messages.js');

const logger = require('../logger');

const { t } = require('../i18n');

async function visibility(interaction) {
	// Logging interaction
	const visibility = interaction.options.getString('visibility', false);

	logger.info(
		{
			guild_id: interaction.guildId,
			guild_name: interaction.guild.name,
			member_id: interaction.member.id,
			member_name: interaction.member.user.username,
			...(visibility) && { visibility: visibility }
		},
		'Visibility command'
	);

	const guild = await getGuild(interaction.guildId);

	if (interaction.options.getString('visibility')) {
		await updateGuild(interaction.guild.id, { visibility: visibility });
		await interaction.reply({ content: visibilityModifiedMsg(guild.language), ephemeral: true })
	} else {
        console.log('here');
		await interaction.reply({ embeds: [currentVisibilityMsg(guild.visibility, guild.language)], ephemeral: true })
	}
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('visibility')
		.setDescription('Change visibility of bot messages')
        .addStringOption(option =>
            option.setName('visibility')
                .setDescription('Choose public or private messages (Default)')
                .setRequired(false)
                .addChoices(
                    { name: 'Private', value: 'private' },
                    { name: 'Public', value: 'public' }
                ))
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	async execute(interaction) {
		// Manage interaction
		try {
			// Check if the user is authorized (aka admin)
			if (interaction.member.permissions.has('ADMINISTRATOR')) {
				await visibility(interaction);
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
      logger.error(error, 'Error');
		}
	}
};