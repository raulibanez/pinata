jest.mock('../db.js', () => ({ getGuilds: jest.fn(), getGuild: jest.fn(), forgetMembersFetch: jest.fn() }));
jest.mock('../logger', () => ({ info: () => {}, error: () => {} }));
jest.mock('../events/guildCreate', () => ({ execute: jest.fn() }));
jest.mock('../events/guildDelete', () => ({ execute: jest.fn() }));

const { getGuilds, getGuild } = require('../db.js');
const guildCreate = require('../events/guildCreate');
const guildDelete = require('../events/guildDelete');
const raw = require('../events/raw');
const guildAvailable = require('../events/guildAvailable');

const readyPacket = (ids, shard = [0, 1]) => ({ t: 'READY', d: { shard, guilds: ids.map((id) => ({ id, unavailable: true })) } });

describe('guildAvailable (guilds that joined while offline)', () => {
    beforeEach(() => jest.clearAllMocks());

    test('registers guilds that added the bot while it was offline', async () => {
        getGuild.mockResolvedValue(undefined);
        const guild = { id: 'new' };

        await guildAvailable.execute(guild);

        expect(guildCreate.execute).toHaveBeenCalledWith(guild);
    });

    test('reactivates guilds that re-added the bot while it was offline', async () => {
        getGuild.mockResolvedValue({ guild_id: 'back', active: 0 });
        const guild = { id: 'back' };

        await guildAvailable.execute(guild);

        expect(guildCreate.execute).toHaveBeenCalledWith(guild);
    });

    test('does nothing for guilds that are already registered', async () => {
        getGuild.mockResolvedValue({ guild_id: 'known', active: 1 });

        await guildAvailable.execute({ id: 'known' });

        expect(guildCreate.execute).not.toHaveBeenCalled();
    });

    test('does not crash the bot when registering fails', async () => {
        getGuild.mockResolvedValue(undefined);
        guildCreate.execute.mockRejectedValueOnce(new Error('SQLITE_BUSY'));

        await expect(guildAvailable.execute({ id: 'new' })).resolves.toBeUndefined();
    });
});

describe('raw READY (guilds that left while offline)', () => {
    beforeEach(() => jest.clearAllMocks());

    test('marks as left the guilds missing from READY', async () => {
        getGuilds.mockResolvedValue([
            { guild_id: 'stays', guild_name: 'Stays', active: 1 },
            { guild_id: 'gone', guild_name: 'Gone', active: 1 },
        ]);

        await raw.execute(readyPacket(['stays']));

        expect(guildDelete.execute).toHaveBeenCalledTimes(1);
        expect(guildDelete.execute).toHaveBeenCalledWith({ id: 'gone', name: 'Gone' });
    });

    test('does not touch guilds that had already left', async () => {
        // Marking it again would reset left_at and delay the purge
        getGuilds.mockResolvedValue([{ guild_id: 'left', guild_name: 'Left', active: 0 }]);

        await raw.execute(readyPacket([]));

        expect(guildDelete.execute).not.toHaveBeenCalled();
    });

    test('keeps marking the other guilds when one fails', async () => {
        getGuilds.mockResolvedValue([
            { guild_id: 'stays1', guild_name: 'Stays 1', active: 1 },
            { guild_id: 'stays2', guild_name: 'Stays 2', active: 1 },
            { guild_id: 'stays3', guild_name: 'Stays 3', active: 1 },
            { guild_id: 'gone1', guild_name: 'Gone 1', active: 1 },
            { guild_id: 'gone2', guild_name: 'Gone 2', active: 1 },
        ]);
        guildDelete.execute.mockRejectedValueOnce(new Error('SQLITE_BUSY'));

        await raw.execute(readyPacket(['stays1', 'stays2', 'stays3']));

        expect(guildDelete.execute).toHaveBeenCalledWith({ id: 'gone2', name: 'Gone 2' });
    });

    test('does not mark guilds as left when READY lists far fewer guilds than the database', async () => {
        getGuilds.mockResolvedValue([
            { guild_id: 'g1', guild_name: 'G1', active: 1 },
            { guild_id: 'g2', guild_name: 'G2', active: 1 },
            { guild_id: 'g3', guild_name: 'G3', active: 1 },
        ]);

        // e.g. a development token against a copy of the production database
        await raw.execute(readyPacket(['dev-server']));

        expect(guildDelete.execute).not.toHaveBeenCalled();
    });

    test('ignores other gateway events', async () => {
        await raw.execute({ t: 'MESSAGE_CREATE', d: {} });

        expect(getGuilds).not.toHaveBeenCalled();
    });

    test('does nothing with several shards (each READY only lists part of the guilds)', async () => {
        await raw.execute(readyPacket(['stays'], [0, 2]));

        expect(getGuilds).not.toHaveBeenCalled();
    });
});
