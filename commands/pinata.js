require('dotenv').config({path: '../.env'});
const { matchMsg, publicMatchMsg, userLeftMsg } = require('../messages.js');
const { SlashCommandBuilder } = require('discord.js');
const { getGuild, getMatch, getUsers, getHistory, getIgnores, getLatestMatchTimestamp, getMatchedUsersInRound, recordLateMatch } = require('../db.js');

const logger = require('../logger');

const { t } = require('../i18n');

function findLateCandidate(memberId, unmatchedUsers, history) {
    const shuffled = [...unmatchedUsers].sort(() => Math.random() - 0.5);

    for (const id of shuffled) {
        const [first, second] = [memberId, id].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        if (!history[first] || !history[first].includes(second)) {
            return id;
        }
    }

    return null;
}

async function tryLateMatch(interaction) {
    const guild_id = interaction.guild.id;
    const member_id = interaction.user.id;

    const latestTimestamp = await getLatestMatchTimestamp(guild_id);
    if (!latestTimestamp) return null;

    const matchedUsers = await getMatchedUsersInRound(guild_id, latestTimestamp);

    const channelUsers = await getUsers(interaction);
    const ignores = await getIgnores(guild_id);

    const unmatchedUsers = Object.keys(channelUsers)
        .filter(id => !matchedUsers.includes(id))
        .filter(id => !ignores.includes(id))
        .filter(id => id !== member_id);

    if (unmatchedUsers.length === 0) return null;

    const history = await getHistory(interaction);
    const candidate = findLateCandidate(member_id, unmatchedUsers, history);

    if (candidate) {
        await recordLateMatch(guild_id, member_id, candidate, latestTimestamp);
        logger.info({ guild_id, member_id, matched_with: candidate, timestamp: latestTimestamp }, 'Late match created');
    }

    return candidate;
}

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
    let match = await getMatch(interaction);

    // Late matching: try to pair with another unmatched user
    if (match.length === 0 && guild.late_matching === 'enabled') {
        const lateCandidate = await tryLateMatch(interaction);
        if (lateCandidate) {
            match = [lateCandidate];
        }
    }

    let avatarURL;
    switch (match.length) {
        case 0:
            // No match found
            const noMatchKey = guild.late_matching === 'enabled' ? 'No late match available' : 'No match found';
            await interaction.reply({ content: t(noMatchKey, guild.language), ephemeral: (guild.visibility !== 'public') });
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
	findLateCandidate,
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