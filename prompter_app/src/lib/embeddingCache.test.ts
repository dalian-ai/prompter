import { expect, test } from 'vitest'
import { dumpEmbeddingCache, loadEmbeddingCache, type EmbeddingCache, trimEmbeddingCache } from './embeddingCache';

export let TOY_CACHE: EmbeddingCache = {
    'fake-model-spec': {
        'fake-hash-1': [
            0.1, 0.1, 0.1
        ],
        'fake-hash-2': [
            0.2, 0.2, 0.2
        ],
        'fake-hash-3': [
            0.3, 0.3, 0.3
        ]
    }
};

// for (let i = 0; i < 1000; i++) {
//     FAKE_CACHE['fake-model-spec']['prog-hash-' + i] = new Array(500).fill(0).map((x) => {
//         return Math.random() * (0.12099999 - 0.02009999) + 0.02009999;
//     });
// }

test('dump and load toy cache', async () => {
    const serialized = await dumpEmbeddingCache(TOY_CACHE);
    expect(await loadEmbeddingCache(serialized)).toEqual(TOY_CACHE);
})

test('dump and load empty cache', async () => {
    let serialized = await dumpEmbeddingCache({});
    expect(await loadEmbeddingCache(serialized)).toEqual({});

    serialized = await dumpEmbeddingCache({'fake-model-spec': {}});
    expect(await loadEmbeddingCache(serialized)).toEqual({'fake-model-spec': {}});
})

test('dump and load cache with special characters', async () => {
    const fakeCache = {'gemma:2b': TOY_CACHE['fake-model-spec']};
    const serialized = await dumpEmbeddingCache(fakeCache);
    expect(await loadEmbeddingCache(serialized)).toEqual(fakeCache);
});

test('strip embedding cache under max size', () => {
    let modelCache = structuredClone(TOY_CACHE['fake-model-spec'])
    const fakeCache = {'gemma:2b': modelCache};
    const expected = structuredClone(fakeCache);

    expect(trimEmbeddingCache(fakeCache, 1000)).toEqual(expected);
})

test('strip embedding cache equal to max size', () => {
    let modelCache = structuredClone(TOY_CACHE['fake-model-spec'])
    const fakeCache = {'gemma:2b': modelCache};
    const expected = structuredClone(fakeCache);

    expect(trimEmbeddingCache(fakeCache, Object.keys(modelCache).length)).toEqual(expected);
})

test('strip embedding cache above max size', () => {
    let modelCache = structuredClone(TOY_CACHE['fake-model-spec'])
    let fakeCache = {'gemma:2b': modelCache};

    let strippedCache = trimEmbeddingCache(fakeCache, 1); // It's done in place anyways
    expect(Object.keys(strippedCache['gemma:2b']).length).toEqual(1);
})
