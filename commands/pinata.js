require('dotenv').config({path: '../.env'});
const { matchMsg, publicMatchMsg, userLeftMsg } = require('../messages.js');
const { SlashCommandBuilder } = require('discord.js');
const { getGuild, getMatch } = require('../db.js');

const logger = require('../logger');

const { t } = require('../i18n');

async function pinata(interaction) {
	logger.info({
			guild_id: interaction.guild.id,
			guild_name: interaction.guild.name,
			member_id: interaction.member.id,
			member_name: interaction.member.user.username,
			channel_id: interaction.channelId,
		},'Pinata command executed'
	);

    // Get guild
    const guild = await getGuild(interaction.guild.id);

    // Get match
    const match = await getMatch(interaction);

    let avatarURL;
    switch (match.length) {
        case 0:
            // No match found
            await interaction.reply({ content: t('No match found', guild.language), ephemeral: (guild.visibility !== 'public') });
            return;
        case 1:
            // Match found
            const member = await interaction.guild.members.fetch(match[0]);
            avatarURL = member.displayAvatarURL();
            break;
        case 2:
            // Group of 3 found
            avatarURL = 'https://pinatabot.s3.eu-west-1.amazonaws.com/three1.jpg';
            break;
    }

    // Get display names
    let matchNames = [];
    for (id of match) {
        try {
            const member = await interaction.guild.members.fetch(id);
            matchNames.push(member.displayName);
        } catch (error) {
            await interaction.reply({ content: t('La persona que te había tocado ya no se encuentra en el servidor 😔', guild.language), ephemeral: (guild.visibility !== 'public') });
        }
    }

    if (guild.visibility === 'public') {
        await interaction.reply({ embeds: [publicMatchMsg(interaction.member.id, matchNames, avatarURL, guild.language)], ephemeral: false });
    } else {
        await interaction.reply({ embeds: [matchMsg(interaction.member.id, matchNames, avatarURL, guild.language)], ephemeral: true });
    }
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('pinata')
		.setDescription('Find out who you are paired with'),
	async execute(interaction) {
		// Manage interaction
		try {
			await pinata(interaction);
		} catch (error) {
            logger.error(error, 'Error');
		}
	}
};