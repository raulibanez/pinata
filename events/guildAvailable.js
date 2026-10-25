const { getGuild, forgetMembersFetch } = require('../db.js');
const guildCreate = require('./guildCreate');
const logger = require('../logger');

// discord.js emits guildAvailable for every guild on startup (and when a guild comes
// back after a Discord outage or a new session), but guildCreate only while the bot is
// connected. Register here the guilds that added the bot while it was offline (new, or
// re-added after leaving)
module.exports = {
	name: 'guildAvailable',
	once: false,
	async execute(guild) {
		// The member cache has just been emptied: don't reuse a recent download
		forgetMembersFetch(guild);

		try {
			const row = await getGuild(guild.id);

			if (!row || !row.active) {
				await guildCreate.execute(guild);
			}
		} catch (error) {
			logger.error(error, 'Error');
		}
	},
};
