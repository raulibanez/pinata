const logger = require('../logger');

module.exports = {
	name: 'ready',
	once: true,
	execute(client) {
		// Logging event
		logger.info(
			{
				member_id: client.user.id,
				member_name: client.user.username,
				bot: client.user.tag
			},
			'Bot ready'
		);
	},
};