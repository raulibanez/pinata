// Same value as production; lower values make the randomized
// pairing flaky when the history is almost exhausted
process.env.MAX_TRIES = 5000;

jest.mock('../db.js', () => ({}));
jest.mock('../messages.js', () => ({}));
jest.mock('../i18n', () => ({ t: (k) => k }));
jest.mock('../logger', () => ({ info: () => {}, error: () => {} }));

const { getGroups, getGroupsAllowingRepeats, shuffleArray } = require('../commands/match');
const { findLateCandidate } = require('../commands/pinata');

// Helper: build history object from a list of pairs (same format as db.js getHistory)
function buildHistory(pairs) {
    const history = {};
    for (const [a, b] of pairs) {
        const [first, second] = [a, b].sort((x, y) => x.localeCompare(y, undefined, { numeric: true }));
        if (!history[first]) history[first] = [];
        history[first].push(second);
    }
    return history;
}

// Helper: extract all pairs from groups (sorted, like the DB stores them)
function extractPairs(groups) {
    const pairs = [];
    for (const group of groups) {
        for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
                const [first, second] = [group[i], group[j]].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                pairs.push(`${first}:${second}`);
            }
        }
    }
    return pairs;
}

describe('getGroups', () => {
    test('2 users with no history should form 1 pair', () => {
        const groups = getGroups(['user1', 'user2'], {});
        expect(groups.length).toBe(1);
        expect(groups[0]).toHaveLength(2);
        expect(groups[0]).toContain('user1');
        expect(groups[0]).toContain('user2');
    });

    test('odd number of users should form a group of 3', () => {
        const users = ['user1', 'user2', 'user3'];
        const groups = getGroups(shuffleArray([...users]), {});
        expect(groups.length).toBe(1);
        expect(groups[0]).toHaveLength(3);
    });

    test('4 users should form 2 pairs', () => {
        const users = ['user1', 'user2', 'user3', 'user4'];
        const groups = getGroups(shuffleArray([...users]), {});
        expect(groups.length).toBe(2);
        groups.forEach(g => expect(g).toHaveLength(2));
    });

    test('1 user should form 0 groups', () => {
        const groups = getGroups(['user1'], {});
        expect(groups.length).toBe(0);
    });

    test('0 users should form 0 groups', () => {
        const groups = getGroups([], {});
        expect(groups.length).toBe(0);
    });

    test('should avoid pairing users already in history', () => {
        const users = ['user1', 'user2', 'user3', 'user4'];
        const history = buildHistory([['user1', 'user2']]);

        const groups = getGroups(shuffleArray([...users]), history);
        const pairs = extractPairs(groups);

        expect(pairs).not.toContain('user1:user2');
    });

    test('all users already paired should return 0 groups', () => {
        const users = ['user1', 'user2'];
        const history = buildHistory([['user1', 'user2']]);

        const groups = getGroups(users, history);
        expect(groups.length).toBe(0);
    });

    // Note: more rounds without repeats are theoretically possible, but the
    // greedy randomized algorithm can paint itself into a corner as the
    // history gets dense; that case is handled by getGroupsAllowingRepeats
    test('5 rounds with 12 users should have no repeated pairs', () => {
        const users = Array.from({ length: 12 }, (_, i) => `user${i}`);
        let history = {};
        const allPairs = new Set();

        for (let round = 0; round < 5; round++) {
            const shuffled = shuffleArray([...users]);
            const groups = getGroups(shuffled, history);

            expect(groups.length).toBe(6);

            const pairs = extractPairs(groups);
            for (const pair of pairs) {
                expect(allPairs.has(pair)).toBe(false);
                allPairs.add(pair);
            }

            // Accumulate history (same format as db.js)
            for (const group of groups) {
                for (let i = 0; i < group.length; i++) {
                    for (let j = i + 1; j < group.length; j++) {
                        const [first, second] = [group[i], group[j]].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                        if (!history[first]) history[first] = [];
                        history[first].push(second);
                    }
                }
            }
        }

        expect(allPairs.size).toBe(30);
    });
});

// Helper: build history rows (same format as db.js getHistoryRows)
function buildRows(roundsOfPairs) {
    const rows = [];
    roundsOfPairs.forEach((pairs, index) => {
        for (const [a, b] of pairs) {
            const [first, second] = [a, b].sort((x, y) => x.localeCompare(y, undefined, { numeric: true }));
            rows.push({ discord_id1: first, discord_id2: second, created: `2026-01-0${index + 1}T00:00:00.000Z` });
        }
    });
    return rows;
}

describe('getGroupsAllowingRepeats', () => {
    test('behaves like getGroups when history allows new pairs', () => {
        const users = ['user1', 'user2', 'user3', 'user4'];
        const rows = buildRows([[['user1', 'user2']]]);

        const groups = getGroupsAllowingRepeats(users, rows);
        const pairs = extractPairs(groups);

        expect(groups.length).toBe(2);
        expect(pairs).not.toContain('user1:user2');
    });

    test('allows repeats when all pairs are exhausted', () => {
        const users = ['user1', 'user2'];
        const rows = buildRows([[['user1', 'user2']]]);

        const groups = getGroupsAllowingRepeats(users, rows);

        expect(groups.length).toBe(1);
        expect(extractPairs(groups)).toContain('user1:user2');
    });

    test('repeats pairs from the oldest round first', () => {
        // With 4 users there are only 3 possible full pairings; use them all
        const rows = buildRows([
            [['user1', 'user2'], ['user3', 'user4']], // round 1 (oldest)
            [['user1', 'user3'], ['user2', 'user4']], // round 2
            [['user1', 'user4'], ['user2', 'user3']], // round 3 (newest)
        ]);

        const groups = getGroupsAllowingRepeats(['user1', 'user2', 'user3', 'user4'], rows);
        const pairs = extractPairs(groups);

        // Only ignoring round 1 makes a full matching possible again,
        // so the result must be exactly round 1's pairing
        expect(groups.length).toBe(2);
        expect(pairs).toContain('user1:user2');
        expect(pairs).toContain('user3:user4');
    });

    test('less than 2 users returns 0 groups even with empty history', () => {
        expect(getGroupsAllowingRepeats(['user1'], []).length).toBe(0);
        expect(getGroupsAllowingRepeats([], []).length).toBe(0);
    });

    describe('small guild scenarios', () => {
        test('5 users with no history form a pair and a triple', () => {
            const users = ['user1', 'user2', 'user3', 'user4', 'user5'];

            const groups = getGroupsAllowingRepeats(users, []);

            expect(groups.length).toBe(2);
            expect(groups.map((g) => g.length).sort().join()).toBe('2,3');
            expect(groups.flat().sort().join()).toBe([...users].sort().join());
        });

        test('5 users with fully exhausted history still get a full round', () => {
            const users = ['user1', 'user2', 'user3', 'user4', 'user5'];

            // All 10 possible pairs already used
            const allPairs = [];
            for (let i = 0; i < users.length; i++) {
                for (let j = i + 1; j < users.length; j++) {
                    allPairs.push([users[i], users[j]]);
                }
            }
            const rows = buildRows([allPairs]);

            const groups = getGroupsAllowingRepeats(users, rows);

            expect(groups.length).toBe(2);
            expect(groups.flat().sort().join()).toBe([...users].sort().join());
        });

        test('5 users where one has met everyone: absorbed into the triple, no repeated pair needed', () => {
            const users = ['user1', 'user2', 'user3', 'user4', 'user5'];

            // user1 has already been paired with all the others
            const rows = buildRows([users.slice(1).map((u) => ['user1', u])]);

            const groups = getGroupsAllowingRepeats(users, rows);

            expect(groups.length).toBe(2);
            expect(groups.flat().sort().join()).toBe([...users].sort().join());

            // user1 can only fit as the third member of the triple; the
            // remaining pair is therefore made of new partners
            const triple = groups.find((g) => g.length === 3);
            const pair = groups.find((g) => g.length === 2);
            expect(triple).toContain('user1');
            expect(pair).not.toContain('user1');
        });

        test('3 users with exhausted history still form a triple', () => {
            const users = ['user1', 'user2', 'user3'];
            const rows = buildRows([[['user1', 'user2'], ['user1', 'user3'], ['user2', 'user3']]]);

            const groups = getGroupsAllowingRepeats(users, rows);

            expect(groups.length).toBe(1);
            expect(groups[0]).toHaveLength(3);
        });

        test('2 users get rematched round after round', () => {
            const users = ['user1', 'user2'];
            let rows = [];

            for (let round = 0; round < 5; round++) {
                const groups = getGroupsAllowingRepeats(users, rows);

                expect(groups.length).toBe(1);
                expect(groups[0].sort().join()).toBe('user1,user2');

                // Upsert semantics: the pair keeps only its latest round date
                rows = [{ discord_id1: 'user1', discord_id2: 'user2', created: `000${round}` }];
            }
        });

        test('20 rounds with 5 users always produce a full round', () => {
            const users = ['user1', 'user2', 'user3', 'user4', 'user5'];
            const lastPaired = new Map();

            for (let round = 0; round < 20; round++) {
                const created = String(round).padStart(4, '0');
                const rows = [...lastPaired.entries()]
                    .map(([key, ts]) => {
                        const [discord_id1, discord_id2] = key.split(':');
                        return { discord_id1, discord_id2, created: ts };
                    })
                    .sort((a, b) => a.created.localeCompare(b.created));

                const groups = getGroupsAllowingRepeats(users, rows);

                expect(groups.length).toBe(2);
                expect(groups.flat().sort().join()).toBe([...users].sort().join());

                for (const pair of extractPairs(groups)) {
                    lastPaired.set(pair, created);
                }
            }
        });
    });

    // Build a history where a full round of new pairs is IMPOSSIBLE:
    // users[0] and users[2] have already met everyone except users[1],
    // so both would need users[1] and one of them is always left out.
    // users[0]'s pairs go in an old round, users[2]'s in a newer one.
    function impossibleHistory(users) {
        const oldRound = users
            .filter((u) => u !== users[0] && u !== users[1])
            .map((u) => [users[0], u]);
        const newRound = users
            .filter((u) => u !== users[0] && u !== users[1] && u !== users[2])
            .map((u) => [users[2], u]);
        return buildRows([oldRound, newRound]);
    }

    describe('large guilds where a round without repeats is impossible', () => {
        const originalMaxTries = process.env.MAX_TRIES;

        // Lower MAX_TRIES so proving "no new-pairs round exists" stays fast
        beforeAll(() => { process.env.MAX_TRIES = 50; });
        afterAll(() => { process.env.MAX_TRIES = originalMaxTries; });

        test.each([100, 1000])('%i users still get a full round', (size) => {
            const users = Array.from({ length: size }, (_, i) => `user${i}`);
            const rows = impossibleHistory(users);

            const groups = getGroupsAllowingRepeats(users, rows);
            const pairs = extractPairs(groups);

            // Full round: everyone matched exactly once
            expect(groups.length).toBe(size / 2);
            expect(groups.flat().sort().join()).toBe([...users].sort().join());

            // Dropping only the oldest round frees users[0]; users[2]'s only
            // new partners left are users[0] (their old pair was in the
            // dropped round) and users[1], so users[2] must be with one of them
            const groupOfUser2 = groups.find((group) => group.includes(users[2]));
            const partner = groupOfUser2.find((u) => u !== users[2]);
            expect([users[0], users[1]]).toContain(partner);

            // No pair from the still-active newest round may be repeated
            for (const u of users.slice(3)) {
                const [first, second] = [users[2], u].sort((x, y) => x.localeCompare(y, undefined, { numeric: true }));
                expect(pairs).not.toContain(`${first}:${second}`);
            }
        });
    });

    test('20 rounds with 12 users always produce a full round', () => {
        const users = Array.from({ length: 12 }, (_, i) => `user${i}`);

        // Mimic the DB with upsert semantics: repeated pairs get their
        // round timestamp updated (like recordGroups does now)
        const lastPaired = new Map();

        for (let round = 0; round < 20; round++) {
            const created = String(round).padStart(4, '0');
            const rows = [...lastPaired.entries()]
                .map(([key, ts]) => {
                    const [discord_id1, discord_id2] = key.split(':');
                    return { discord_id1, discord_id2, created: ts };
                })
                .sort((a, b) => a.created.localeCompare(b.created));

            const groups = getGroupsAllowingRepeats(users, rows);

            // Every user gets matched, every single round
            expect(groups.length).toBe(6);
            expect(groups.flat().sort().join()).toBe([...users].sort().join());

            for (const pair of extractPairs(groups)) {
                lastPaired.set(pair, created);
            }
        }
    });
});

describe('findLateCandidate', () => {
    test('should return a candidate when no history', () => {
        const candidate = findLateCandidate('newUser', ['candidate1', 'candidate2'], {});
        expect(['candidate1', 'candidate2']).toContain(candidate);
    });

    test('should return null when no candidates available', () => {
        const candidate = findLateCandidate('newUser', [], {});
        expect(candidate).toBeNull();
    });

    test('should skip candidates already in history', () => {
        const history = buildHistory([['newUser', 'candidate1']]);
        const candidate = findLateCandidate('newUser', ['candidate1', 'candidate2'], history);
        expect(candidate).toBe('candidate2');
    });

    test('should return null when all candidates are in history', () => {
        const history = buildHistory([['newUser', 'candidate1'], ['newUser', 'candidate2']]);
        const candidate = findLateCandidate('newUser', ['candidate1', 'candidate2'], history);
        expect(candidate).toBeNull();
    });

    test('should respect sorted ID order for history lookup', () => {
        // 'aaa' < 'zzz' so history key is 'aaa' with value ['zzz']
        const history = buildHistory([['zzz', 'aaa']]);
        const candidate = findLateCandidate('zzz', ['aaa', 'bbb'], history);
        expect(candidate).toBe('bbb');
    });
});
