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

    // Prepare statement
    const insert = await db.prepare('INSERT or IGNORE INTO groups (guild_id, discord_id1, discord_id2, created) VALUES (?, ?, ?, ?)');

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
    const stmt = await db.prepare('INSERT INTO `guilds` (guild_id, guild_name, owner_id, member_count, subscription_plan, premium_tier, active, description, language, api_key, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    await stmt.run(guild.id, guild.name, guild.ownerId, guild.memberCount, 0, guild.premiumTier, 1, guild.description, 'en', crypto.randomBytes(32).toString('base64'), new Date().toISOString());
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

module.exports = {
    getMatch,
    getUsers,
    getHistory,
    recordGroups,
    resetHistory,
    addGuild,
    getGuild,
    updateGuild,
    ignoreUser,
    unignoreUser,
    getIgnores
};