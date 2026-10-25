const Database = require('better-sqlite3');
const db = new Database('pinata.db');
const dedent = require('dedent-js');

// Function to delete groups from a specific guild
function deleteGroups(guildId) {
  const deleteStmt = db.prepare('DELETE FROM groups WHERE guild_id = ?');
  deleteStmt.run(guildId);
}

// Function to delete the ignore list from a specific guild
function deleteIgnores(guildId) {
  const deleteStmt = db.prepare('DELETE FROM ignores WHERE guild_id = ?');
  deleteStmt.run(guildId);
}

// Function to delete a guild from the database
function deleteGuild(guildId) {
  const deleteStmt = db.prepare('DELETE FROM guilds WHERE guild_id = ?');
  deleteStmt.run(guildId);
}

// Function to identify and process inactive guilds
function cleanupGuilds() {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - 1); // Subtract 1 days from the current date

  // Get guilds that have been inactive for more than a day
  const selectStmt = db.prepare(dedent`
    SELECT guild_id FROM guilds
    WHERE active = 0 AND datetime(left_at) <= datetime(?)
  `);
  const inactiveGuilds = selectStmt.all(daysAgo.toISOString());

  // Process each inactive guild
  inactiveGuilds.forEach((guild) => {
    console.log(`Cleaning data for guild: ${guild.guild_id}`);
    deleteGroups(guild.guild_id); // Delete groups associated with the guild
    deleteIgnores(guild.guild_id); // Delete ignored users of the guild
    deleteGuild(guild.guild_id); // Delete the guild itself
  });

  console.log(`Cleanup process completed. Inactive guilds cleaned: ${inactiveGuilds.length}`);
}

// Function to delete pairs and ignores of guilds that are not registered. They were left
// behind by older versions (this script didn't delete ignores, and guilds that joined
// while the bot was offline were never registered). It can't tell those apart from a
// guild still using the bot without a row, so it only runs on demand, once the updated
// bot has been restarted and has registered its guilds:
//   node scripts/purge-database.js --orphans
function cleanupOrphans() {
  const groups = db.prepare('DELETE FROM groups WHERE guild_id NOT IN (SELECT guild_id FROM guilds)').run().changes;
  const ignores = db.prepare('DELETE FROM ignores WHERE guild_id NOT IN (SELECT guild_id FROM guilds)').run().changes;

  console.log(`Orphan rows deleted: ${groups} groups, ${ignores} ignores`);
}

// Execute the cleanup
cleanupGuilds();

if (process.argv.includes('--orphans')) {
  cleanupOrphans();
}

db.close(); // Close the database connection
