const { addGuild, getGuild, updateGuild } = require('../db.js');
require('dotenv').config({path: '../.env'});
const logger = require('../logger');

module.exports = {
	name: 'guildCreate',
	once: false,
	async execute(guild) {
		// Logging event
		logger.info(
			{
				guild_id: guild.id,
				guild_name: guild.name,
				member_count: guild.memberCount,
				premium_tier: guild.premiumTier,
				description: guild.description,
			},
			'Guild join'
		);

		// Existing guild ?
		if (!await getGuild(guild.id)) {
			// New user
			addGuild(guild)
		} else {
			// Update guild attributes
			await updateGuild(
				guild.id,
				{
					guild_name: guild.name,
					owner_id: guild.ownerId,
					member_count: guild.memberCount,
					premium_tier: guild.premiumTier,
					active: 1,
					left_at: null,
				});
		}
	},
};