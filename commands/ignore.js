require('dotenv').config({path: '../.env'});
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { ignoreUser, unignoreUser } = require('../db.js');

const logger = require('../logger');

const { t } = require('../i18n');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ignore')
		.setDescription('Adds or removes user from being matched')
		.addSubcommand(subcommand =>
			subcommand
				.setName('add')
				.setDescription('Add user to the ignore list')
				.addUserOption(option => option.setName('user').setDescription('Choose user').setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('remove')
				.setDescription('Remove user from the ignore list')
				.addUserOption(option => option.setName('user').setDescription('Choose user').setRequired(true)))
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	async execute(interaction) {
		// Log interaction
		logger.info({
				guild_id: interaction.guild.id,
				guild_name: interaction.guild.name,
				member_id: interaction.member.id,
				member_name: interaction.member.user.username,
				subcommand: interaction.options.getSubcommand(),
				ignore_id: interaction.options.getUser('user', true).id,
				ignore_name: interaction.options.getUser('user', true).username,
			},'Ignore command executed'
		); 

		// Manage interaction
		try {
			// Check if the user is authorized (aka admin)
			if (interaction.member.permissions.has('ADMINISTRATOR')) {
				switch (interaction.options.getSubcommand()) {
					case 'add':
						await ignoreUser(interaction);
						interaction.reply({ content: `User <@${interaction.options.getUser('user', true).id}> has been added to the ignore list`, ephemeral: true });
						break;
					case 'remove':
						await unignoreUser(interaction);
						interaction.reply({ content: `User <@${interaction.options.getUser('user', true).id}> has been removed from the ignore list`, ephemeral: true });
						break;
					default:
						interaction.reply({ content: 'Subcommand not recognised', ephemeral: true });
						break;
				}
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