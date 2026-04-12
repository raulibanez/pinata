process.env.MAX_TRIES = 100;

jest.mock('../db.js', () => ({}));
jest.mock('../messages.js', () => ({}));
jest.mock('../i18n', () => ({ t: (k) => k }));
jest.mock('../logger', () => ({ info: () => {}, error: () => {} }));

const { getGroups, shuffleArray } = require('../commands/match');
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

    test('10 rounds with 12 users should have no repeated pairs', () => {
        const users = Array.from({ length: 12 }, (_, i) => `user${i}`);
        let history = {};
        const allPairs = new Set();

        for (let round = 0; round < 10; round++) {
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

        expect(allPairs.size).toBe(60);
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
