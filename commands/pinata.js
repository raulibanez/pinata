require('dotenv').config({path: '../.env'});
const { matchMsg, publicMatchMsg } = require('../messages.js');
const { SlashCommandBuilder } = require('discord.js');
const { getGuild, getMatch, getUsers, getHistoryRows, getIgnores, getLatestMatchTimestamp, getMatchedUsersInRound, recordLateMatch } = require('../db.js');

const logger = require('../logger');

const { t } = require('../i18n');

function findLateCandidate(memberId, unmatchedUsers, rows) {
    if (unmatchedUsers.length === 0) return null;

    // Last time this member was paired with each user (if ever)
    const lastPaired = {};
    for (const row of rows) {
        if (row.discord_id1 === memberId) lastPaired[row.discord_id2] = row.created;
        if (row.discord_id2 === memberId) lastPaired[row.discord_id1] = row.created;
    }

    // Prefer users this member has never been paired with
    const fresh = unmatchedUsers.filter((id) => !lastPaired[id]);
    if (fresh.length > 0) {
        return fresh[Math.floor(Math.random() * fresh.length)];
    }

    // Everyone available is a repeat: pick the least recently paired one
    return unmatchedUsers.reduce((oldest, id) => (lastPaired[id] < lastPaired[oldest] ? id : oldest));
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

    const rows = await getHistoryRows(guild_id);
    const candidate = findLateCandidate(member_id, unmatchedUsers, rows);

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
    // Enabled by default unless the guild explicitly disabled it
    if (match.length === 0 && guild.late_matching !== 'disabled') {
        const lateCandidate = await tryLateMatch(interaction);
        if (lateCandidate) {
            match = [lateCandidate];
        }
    }

    let avatarURL;
    switch (match.length) {
        case 0:
            // No match found
            const noMatchKey = guild.late_matching !== 'disabled' ? 'No late match available' : 'No match found';
            await interaction.reply({ content: t(noMatchKey, guild.language), ephemeral: (guild.visibility !== 'public') });
            return;
        case 1:
            // Match found
            try {
                const member = await interaction.guild.members.fetch(match[0]);
                avatarURL = member.displayAvatarURL();
            } catch (error) {
                // The matched member left the server
                await interaction.reply({ content: t('La persona que te había tocado ya no se encuentra en el servidor 😔', guild.language), ephemeral: (guild.visibility !== 'public') });
                return;
            }
            break;
        case 2:
            // Group of 3 found
            avatarURL = 'https://pinatabot.s3.eu-west-1.amazonaws.com/three1.jpg';
            break;
    }

    // Get display names, skipping members who left the server
    let matchNames = [];
    for (const id of match) {
        try {
            const member = await interaction.guild.members.fetch(id);
            matchNames.push(member.displayName);
        } catch (error) {
            // Member left the server since the round was created
        }
    }

    if (matchNames.length === 0) {
        // Everyone in the group left the server
        await interaction.reply({ content: t('La persona que te había tocado ya no se encuentra en el servidor 😔', guild.language), ephemeral: (guild.visibility !== 'public') });
        return;
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
		.setDescription('Find out who you are paired with')
		.setDMPermission(false),
	async execute(interaction) {
		// Manage interaction
		try {
			await pinata(interaction);
		} catch (error) {
			logger.error(error, 'Error');

			// Inform the user instead of leaving the interaction unanswered
			try {
				const content = t('Algo ha ido mal 😵 Inténtalo de nuevo en unos minutos');
				if (interaction.deferred || interaction.replied) {
					await interaction.editReply({ content });
				} else {
					await interaction.reply({ content, ephemeral: true });
				}
			} catch (replyError) {
				// Interaction expired or channel unavailable
			}
		}
	}
};