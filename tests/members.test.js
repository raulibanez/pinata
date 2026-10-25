jest.mock('better-sqlite3', () => jest.fn(() => ({})));
jest.mock('../logger', () => ({ info: () => {}, error: () => {} }));

const { fetchAllMembers, forgetMembersFetch } = require('../db.js');

// Fake guild whose members.fetch() stays in flight until finishFetch() is called,
// then fills the cache like discord.js does
function fakeGuild(id) {
    const cache = new Map();
    let finishFetch;
    const fetch = jest.fn(() => new Promise((resolve) => {
        finishFetch = () => {
            cache.set('user1', {});
            cache.set('user2', {});
            resolve(new Map(cache));
        };
    }));

    return { guild: { id, members: { cache, fetch } }, fetch, finishFetch: () => finishFetch() };
}

describe('fetchAllMembers', () => {
    // Fake timers also control performance.now(), which can't be spied on in Node 16
    beforeEach(() => jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] }));
    afterEach(() => jest.useRealTimers());

    test('reuses the member list for 30 seconds instead of asking Discord again', async () => {
        const { guild, fetch, finishFetch } = fakeGuild('guild-a');

        const first = fetchAllMembers(guild);
        finishFetch();
        expect((await first).size).toBe(2);

        jest.advanceTimersByTime(29e3);
        const second = await fetchAllMembers(guild);

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(second.size).toBe(2);
    });

    test('concurrent calls share the request in flight and get the full list', async () => {
        const { guild, fetch, finishFetch } = fakeGuild('guild-b');

        const first = fetchAllMembers(guild);
        const second = fetchAllMembers(guild);
        finishFetch();

        expect((await first).size).toBe(2);
        expect((await second).size).toBe(2);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('asks Discord again after 30 seconds', async () => {
        const { guild, fetch, finishFetch } = fakeGuild('guild-c');

        const first = fetchAllMembers(guild);
        finishFetch();
        await first;

        jest.advanceTimersByTime(30e3);
        fetchAllMembers(guild);

        expect(fetch).toHaveBeenCalledTimes(2);
    });

    test('each guild has its own 30 seconds window', async () => {
        const a = fakeGuild('guild-d');
        const b = fakeGuild('guild-e');

        const first = fetchAllMembers(a.guild);
        const second = fetchAllMembers(b.guild);
        a.finishFetch();
        b.finishFetch();
        await Promise.all([first, second]);

        expect(a.fetch).toHaveBeenCalledTimes(1);
        expect(b.fetch).toHaveBeenCalledTimes(1);
    });

    test('a failed request is not reused: the next call asks Discord again', async () => {
        const fetch = jest.fn()
            .mockRejectedValueOnce(new Error('GuildMembersTimeout'))
            .mockResolvedValueOnce(new Map());
        const guild = { id: 'guild-f', members: { cache: new Map(), fetch } };

        await expect(fetchAllMembers(guild)).rejects.toThrow('GuildMembersTimeout');
        await fetchAllMembers(guild);

        expect(fetch).toHaveBeenCalledTimes(2);
    });

    test('downloads the list again when the guild becomes available (its cache was emptied)', async () => {
        const { guild, fetch, finishFetch } = fakeGuild('guild-g');

        const first = fetchAllMembers(guild);
        finishFetch();
        await first;

        forgetMembersFetch(guild);
        fetchAllMembers(guild);

        expect(fetch).toHaveBeenCalledTimes(2);
    });
});
