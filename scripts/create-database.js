const Database = require('better-sqlite3');
const db = new Database('pinata.db');
const dedent = require('dedent-js');

try {
    db.exec(dedent`
      CREATE TABLE groups (
        guild_id TEXT NOT NULL,
        discord_id1 TEXT NOT NULL,
        discord_id2 TEXT NOT NULL,
        created timestamp NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (guild_id,discord_id1,discord_id2))
    `);
} catch (err) {
  console.error(err);
}

try {
  db.exec(dedent`
    CREATE TABLE guilds (
      guild_id TEXT NOT NULL,
      guild_name TEXT NOT NULL,
      member_count INTEGER NOT NULL,
      premium_tier INTEGER NOT NULL,
      owner_id TEXT NOT NULL,
      description TEXT NULL,
      language TEXT NOT NULL,
      api_key TEXT NOT NULL,
      active INTEGER NOT NULL,
      subscription_plan INTEGER NOT NULL,
      joined_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
      left_at timestamp NULL DEFAULT NULL,
    PRIMARY KEY (guild_id))
  `);
} catch (err) {
console.error(err);
}

try {
  db.exec(dedent`
    CREATE TABLE ignores (
      guild_id TEXT NOT NULL,
      discord_id TEXT NOT NULL,
    PRIMARY KEY (guild_id, discord_id))
  `);
} catch (err) {
console.error(err);
}

db.close();