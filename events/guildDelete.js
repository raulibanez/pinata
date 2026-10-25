const { getGuild, updateGuild } = require('../db.js');
const logger = require('../logger');

module.exports = {
	name: 'guildDelete',
	once: false,
	async execute(guild) {
    // Logging event
		logger.info(
			{
				guild_id: guild.id,
				guild_name: guild.name
			},
			'Guild leave'
		);

    // A database error must not crash the bot (unhandled rejection)
    try {
      // Existing guild ?
      if (await getGuild(guild.id)) {
        // Update guild attributes
        await updateGuild(
          guild.id,
          {
            active: 0,
            left_at: new Date().toISOString()
          });
      }
    } catch (error) {
      logger.error(error, 'Error');
    }
	},
};