const Database = require('better-sqlite3');
const db = new Database('pinata.db');
const dedent = require('dedent-js');

// Function to delete groups from a specific guild
function deleteGroups(guildId) {
  const deleteStmt = db.prepare('DELETE FROM groups WHERE guild_id = ?');
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

  // Get guilds that have been inactive for more than a month
  const selectStmt = db.prepare(dedent`
    SELECT guild_id FROM guilds
    WHERE active = 0 AND datetime(left_at) <= datetime(?)
  `);
  const inactiveGuilds = selectStmt.all(daysAgo.toISOString());

  // Process each inactive guild
  inactiveGuilds.forEach((guild) => {
    console.log(`Cleaning data for guild: ${guild.guild_id}`);
    deleteGroups(guild.guild_id); // Delete groups associated with the guild
    deleteGuild(guild.guild_id); // Delete the guild itself
  });

  console.log(`Cleanup process completed. Inactive guilds cleaned: ${inactiveGuilds.length}`);
}

// Execute the cleanup
cleanupGuilds();

db.close(); // Close the database connection
