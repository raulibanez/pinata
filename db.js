require('dotenv').config({path: '.env'});
const logger = require('./logger');
const crypto = require('crypto');

const Database = require('better-sqlite3');
const db = new Database('pinata.db');

// Permission bitfield
const { PermissionsBitField } = require('discord.js');

const getMatch = async (interaction) => {
	const guild_id = interaction.guild.id;
	const member_id = interaction.user.id;

    const stmt = await db.prepare("SELECT * FROM groups WHERE guild_id = ? AND ? IN (discord_id1, discord_id2) AND created = (SELECT MAX(created) FROM groups where guild_id = ?)")
        .bind(guild_id, member_id, guild_id);
    const rows = await stmt.all();

    // Return array of users in match    
    return rows.map(row => row.discord_id1 === member_id ? row.discord_id2 : row.discord_id1);
}

const getUsers = async (interaction) => {
    let users = {};

    // Retrieve all guild members
    const members = await interaction.guild.members.fetch();

    // Verify user can see that channel
    for (let [snowflake, guildMember] of members) {
        if (guildMember.permissionsIn(interaction.channel).has(PermissionsBitField.Flags.ViewChannel) && !guildMember.user.bot) {
            users[guildMember.user.id] = guildMember.displayName;
        }
    }

    return users;
}

// Raw history rows (sorted pairs + round timestamp), oldest round first
const getHistoryRows = async (guild_id) => {
    const stmt = await db.prepare("SELECT discord_id1, discord_id2, created FROM groups WHERE guild_id = ? ORDER BY created ASC").bind(guild_id);
    return await stmt.all();
}

const getHistory = async (interaction) => {
    const stmt = await db.prepare("SELECT * FROM groups WHERE guild_id = ?").bind(interaction.guildId);
    const rows = await stmt.all();

    let history = {};

    for (let row of rows) {
        if (typeof history[row.discord_id1] === 'undefined') {
        history[row.discord_id1] = [row.discord_id2];
        } else {
        history[row.discord_id1].push(row.discord_id2);
        }
    }

    return history;
}

const recordGroups = async (interaction, groups, history) => {
    // Get date
    const date = new Date().toISOString();

    // Upsert: repeated pairs must get the new round date, otherwise /pinata
    // (which looks up pairs by MAX(created)) would not find them
    const insert = await db.prepare('INSERT INTO groups (guild_id, discord_id1, discord_id2, created) VALUES (?, ?, ?, ?) ON CONFLICT(guild_id, discord_id1, discord_id2) DO UPDATE SET created = excluded.created');

    for (let group of groups) { 
        // Split groups into sorted pairs to store in database (e.g. 3 users group)
        var pairs = group.flatMap((v, i) => group.slice(i+1).map(w => [v, w].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))));

        for (let pair of pairs) {
            // We need duplicated to allow more than 2 users to be in a group
            await insert.run(interaction.guildId, ...pair, date);
        }
    }
}

const resetHistory = async (interaction) => {
    const stmt = await db.prepare('DELETE FROM `groups` WHERE guild_id = ?').bind(interaction.guildId);
    await stmt.run();
}

const addGuild = async (guild) => {
    const stmt = await db.prepare('INSERT INTO `guilds` (guild_id, guild_name, owner_id, member_count, subscription_plan, premium_tier, active, description, language, api_key, joined_at, late_matching) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    await stmt.run(guild.id, guild.name, guild.ownerId, guild.memberCount, 0, guild.premiumTier, 1, guild.description, 'en', crypto.randomBytes(32).toString('base64'), new Date().toISOString(), 'enabled');
}

const getGuild = async (id) => {
    const stmt = await db.prepare('SELECT * FROM `guilds` WHERE guild_id = ?').bind(id);
    const row = await stmt.get();

    return row;
}

const updateGuild = async (id, update) => {
    let query = 'UPDATE `guilds` SET ';
    let values = [];

    for (let [key, value] of Object.entries(update)) {
        query += `${key} = ?, `;
        values.push(value);
    }

    query = query.slice(0, -2);
    query += ' WHERE guild_id = ?';
    values.push(id);

    const stmt = await db.prepare(query);
    await stmt.run(...values);
}

const ignoreUser = async (interaction) => {
    const stmt = await db.prepare('INSERT OR IGNORE INTO `ignores` (guild_id, discord_id) VALUES (?, ?)');
    await stmt.run(interaction.guildId, interaction.options.getUser('user', true).id);
}

const unignoreUser = async (interaction) => {
    const stmt = await db.prepare('DELETE FROM `ignores` WHERE guild_id = ? AND discord_id = ?');
    await stmt.run(interaction.guildId, interaction.options.getUser('user', true).id);
}

const getIgnores = async (guild_id) => {
    const stmt = await db.prepare('SELECT * FROM `ignores` WHERE guild_id = ?').bind(guild_id);
    const rows = await stmt.all();

    let ignore = [];

    for (let row of rows) {
        ignore.push(row.discord_id);
    }

    return ignore;
}

const getLatestMatchTimestamp = async (guild_id) => {
    const stmt = await db.prepare("SELECT MAX(created) as latest FROM groups WHERE guild_id = ?").bind(guild_id);
    const row = await stmt.get();
    return row ? row.latest : null;
}

const getMatchedUsersInRound = async (guild_id, timestamp) => {
    const stmt = await db.prepare(
        "SELECT DISTINCT discord_id FROM (" +
        "SELECT discord_id1 AS discord_id FROM groups WHERE guild_id = ? AND created = ? " +
        "UNION " +
        "SELECT discord_id2 AS discord_id FROM groups WHERE guild_id = ? AND created = ?" +
        ")"
    ).bind(guild_id, timestamp, guild_id, timestamp);
    const rows = await stmt.all();
    return rows.map(row => row.discord_id);
}

const recordLateMatch = async (guild_id, user1, user2, timestamp) => {
    const [first, second] = [user1, user2].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const insert = await db.prepare('INSERT OR IGNORE INTO groups (guild_id, discord_id1, discord_id2, created) VALUES (?, ?, ?, ?)');
    await insert.run(guild_id, first, second, timestamp);
}

module.exports = {
    getMatch,
    getUsers,
    getHistory,
    getHistoryRows,
    recordGroups,
    resetHistory,
    addGuild,
    getGuild,
    updateGuild,
    ignoreUser,
    unignoreUser,
    getIgnores,
    getLatestMatchTimestamp,
    getMatchedUsersInRound,
    recordLateMatch
};