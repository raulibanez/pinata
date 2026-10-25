const logger = require('../logger');
const { getGuilds } = require('../db.js');
const guildDelete = require('./guildDelete');

// Safety net: if Discord reports far fewer guilds than the database (wrong BOT_TOKEN, a
// copy of the production database in development...), marking them all as left would
// get them purged a day later
const MAX_LEFT_RATIO = 0.5;

// guildDelete is only emitted while the bot is connected, so guilds that removed the bot
// while it was offline are marked as left here (guilds that joined while offline are
// registered by guildAvailable or on their first interaction)
async function syncLeftGuilds(guildIds) {
	const active = (await getGuilds()).filter((row) => row.active);
	const left = active.filter((row) => !guildIds.has(row.guild_id));

	if (left.length > 1 && left.length > active.length * MAX_LEFT_RATIO) {
		logger.error({ left: left.length, active: active.length }, 'Too many guilds left while offline, not marking them as left: check BOT_TOKEN and the database');
		return;
	}

	for (const row of left) {
		// One failing guild must not stop the rest
		try {
			await guildDelete.execute({ id: row.guild_id, name: row.guild_name });
		} catch (error) {
			logger.error(error, 'Error');
		}
	}
}

// Discord's READY payload (on startup, and when a lost session has to be re-established)
// lists every guild the bot is in. client.guilds.cache can't be used instead: it keeps
// guilds that removed the bot while the connection was down. The raw client event is
// used to get the payload because the event loader in app.js only listens on the client
module.exports = {
	name: 'raw',
	once: false,
	syncLeftGuilds,
	async execute(packet) {
		if (packet.t !== 'READY') return;

		// With several shards, each READY only lists that shard's guilds
		if (packet.d.shard && packet.d.shard[1] > 1) return;

		try {
			await syncLeftGuilds(new Set(packet.d.guilds.map((guild) => guild.id)));
		} catch (error) {
			logger.error(error, 'Error');
		}
	},
};
