require('dotenv').config({ path: '../.env' });
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuild, getUsers, getHistoryRows, recordGroups, getIgnores } = require('../db.js');
const { pinataMsg } = require('../messages.js');

const logger = require('../logger');

const { t } = require('../i18n');

const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

// Pairing algorithm
// Some ideas from https://lifeat.tails.com/how-we-made-bagelbot/
function getGroups(users, history) {
  let groups = [];
  let users_copy = [...users];
  let tries = 0;
  const maxTries = Number(process.env.MAX_TRIES) || 5000;

  while (users_copy.length >= 2 && tries < maxTries) {
    const user = users_copy.pop();
    let pair_with = 0;

    for (let i = 0; i < users_copy.length; i++) {
      const [first, second] = [user, users_copy[i]].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      if (history[first]) {
        if (!history[first].includes(second)) {
          pair_with = users_copy[i];
          users_copy.splice(users_copy.indexOf(pair_with), 1);
          break;
        }
      } else {
        pair_with = users_copy[i];
        users_copy.splice(users_copy.indexOf(pair_with), 1);
        break;
      }
    }

    // No pair found, retry
    if (pair_with == 0) {
      groups = [];
      users_copy = shuffleArray([...users]);
      tries++;
      continue;
    }

    // Add pair to groups
    groups.push([user, pair_with]);
  }

  // Odd number of users
  // Add the user to the last group
  if (users_copy.length == 1 && groups.length > 0) {
    groups[groups.length - 1].push(users_copy[0]);
  }

  logger.info(`Pairing process ended after ${tries + 1} attempts`);

  return groups;
}

// Build history object (same shape as db.js getHistory) from raw rows,
// ignoring the `skip` oldest rounds
function buildHistory(rows, rounds, skip) {
  const valid = new Set(rounds.slice(skip));
  const history = {};

  for (const row of rows) {
    if (!valid.has(row.created)) continue;
    if (!history[row.discord_id1]) history[row.discord_id1] = [];
    history[row.discord_id1].push(row.discord_id2);
  }

  return history;
}

// Try to match with brand new pairs only; if the history makes that
// impossible, progressively allow repeating pairs from the oldest rounds
function getGroupsAllowingRepeats(users, rows) {
  if (users.length < 2) return [];

  // Distinct round timestamps, oldest first
  const rounds = [...new Set(rows.map((row) => row.created))].sort();

  for (let skip = 0; skip <= rounds.length; skip++) {
    const history = buildHistory(rows, rounds, skip);
    const groups = getGroups(shuffleArray([...users]), history);

    if (groups.length > 0) {
      if (skip > 0) {
        logger.info(`History too dense: allowed repeats from the ${skip} oldest round(s) to complete the matching`);
      }
      return groups;
    }
  }

  return [];
}

async function matchUsers(interaction) {
  // Get ignore list
  const ignore = await getIgnores(interaction.guildId);

  logger.info(ignore, 'Ignore list');

  // Get users
  let users = await getUsers(interaction);

  logger.info(users, 'Users');

  // Remove ignored users
  ignore.forEach((id) => { delete users[id] });

  // Get history rows (pairs + round timestamps)
  const rows = await getHistoryRows(interaction.guildId);

  // Match users, allowing repeats of the oldest rounds only if unavoidable
  const groups = getGroupsAllowingRepeats(Object.keys(users), rows);

  logger.info(groups, 'Groups');

  // Record pair information into the database
  await recordGroups(interaction, groups);

  return groups.length;
}

async function pinata(interaction) {
  logger.info({
    guild_id: interaction.guild.id,
    guild_name: interaction.guild.name,
    member_id: interaction.member.id,
    member_name: interaction.member.user.username,
    channel_id: interaction.channelId,
  }, 'Match command executed'
  );

  // Get guild settings
  const guild = await getGuild(interaction.guildId);

  // Defer reply to avoid timeout
  await interaction.deferReply({ ephemeral: true });

  // Time to match users
  if (await matchUsers(interaction)) {
    try {
      // Match process was successful
      await interaction.channel.send(pinataMsg(guild.language));

      // Inform user of the process result
      await interaction.editReply({ content: t(`Piñata created succesfully`, guild.language) });
    } catch (error) {
      // Logging unauthorized command attempt
      logger.info(
        {
          guild_id: interaction.guild.id,
          guild_name: interaction.guild.name,
          member_id: interaction.member.id,
          member_name: interaction.member.user.username,
          channel_id: interaction.channelId,
        },
        'Missing permissions error'
      );
      
      // Missing permissions error
      await interaction.editReply({ content: t(`Missing permissions`, guild.language) });
    }
  } else {
    // No groups found
    // Inform user of the process result
    await interaction.editReply({ content: t(`No groups found`, guild.language) });
  }
}

module.exports = {
  getGroups,
  getGroupsAllowingRepeats,
  shuffleArray,
  data: new SlashCommandBuilder()
    .setName('match')
    .setDescription('Match users in pairs and post message to channel')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    // Manage interaction
    try {
      // Check if the user is authorized (aka admin)
      if (interaction.member.permissions.has('ADMINISTRATOR')) {
        await pinata(interaction);
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

        await interaction.reply({ content: t('Permission required to execute this command'), ephemeral: true });
      }
    } catch (error) {
      logger.error(error, 'Error');

      // Inform the user instead of leaving the interaction unanswered
      // (e.g. GuildMembersTimeout when Discord is slow delivering members)
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