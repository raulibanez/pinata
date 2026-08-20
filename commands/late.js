require('dotenv').config({path: '../.env'});
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuild, updateGuild } = require('../db.js');
const { lateMatchingModifiedMsg, currentLateMatchingMsg } = require('../messages.js');

const logger = require('../logger');

const { t } = require('../i18n');

async function late(interaction) {
	const lateMatching = interaction.options.getString('mode', false);

	logger.info(
		{
			guild_id: interaction.guildId,
			guild_name: interaction.guild.name,
			member_id: interaction.member.id,
			member_name: interaction.member.user.username,
			...(lateMatching) && { late_matching: lateMatching }
		},
		'Late matching command'
	);

	const guild = await getGuild(interaction.guildId);

	if (lateMatching) {
		await updateGuild(interaction.guild.id, { late_matching: lateMatching });
		await interaction.reply({ content: lateMatchingModifiedMsg(guild.language), ephemeral: true });
	} else {
		await interaction.reply({ embeds: [currentLateMatchingMsg(guild.late_matching, guild.language)], ephemeral: true });
	}
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('late')
		.setDescription('Enable or disable late matching for users who join after the piñata')
		.addStringOption(option =>
			option.setName('mode')
				.setDescription('Enable or disable late matching (Default: enabled)')
				.setRequired(false)
				.addChoices(
					{ name: 'Enabled', value: 'enabled' },
					{ name: 'Disabled', value: 'disabled' }
				))
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	async execute(interaction) {
		try {
			if (interaction.member.permissions.has('ADMINISTRATOR')) {
				await late(interaction);
			} else {
				logger.info(
					{
						guild_id: interaction.guildId,
						guild_name: interaction.guild.name,
						member_id: interaction.member.id,
						member_name: interaction.member.user.username,
					},
					'Unauthorized user'
				);

				await interaction.reply({ content: t('Permission required to execute this command'), ephemeral: true });
			}
		} catch (error) {
			logger.error(error, 'Error');
		}
	}
};
