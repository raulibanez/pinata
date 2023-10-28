require('dotenv').config({path: '../.env'});
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuild, updateGuild } = require('../db.js');
const { languageModifiedMsg, currentLanguageMsg } = require('../messages.js');

const logger = require('../logger');

const { t } = require('../i18n');

async function language(interaction) {
	// Logging interaction
	const language = interaction.options.getString('language', false);

	logger.info(
		{
			guild_id: interaction.guildId,
			guild_name: interaction.guild.name,
			member_id: interaction.member.id,
			member_name: interaction.member.user.username,
			...(language) && { language: language }
		},
		'Language command'
	);

	if (interaction.options.getString('language')) {
		await updateGuild(interaction.guild.id, { language: interaction.options.getString('language', true) });
		await interaction.reply({ content: languageModifiedMsg(interaction.options.getString('language', true)), ephemeral: true })
	} else {
		const guild = await getGuild(interaction.guildId);
		await interaction.reply({ embeds: [currentLanguageMsg(guild.language)], ephemeral: true })
	}
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('language')
		.setDescription('To change the language')
        .addStringOption(option =>
            option.setName('language')
                .setDescription('Choose language')
                .setRequired(false)
                .addChoices(
                    { name: 'English', value: 'en' },
					{ name: 'Italian', value: 'it' },
                    { name: 'Spanish', value: 'es' },
					{ name: 'French', value: 'fr' }
                ))
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	async execute(interaction) {
		// Manage interaction
		try {
			// Check if the user is authorized (aka admin)
			if (interaction.member.permissions.has('ADMINISTRATOR')) {
				await language(interaction);
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