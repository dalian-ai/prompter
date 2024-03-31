import { expect, test } from 'vitest'
import { dumpEmbeddingCache, loadEmbeddingCache, type EmbeddingCache } from './embeddingCache';

let TOY_CACHE: EmbeddingCache = {
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

test('dump and load toy cache', () => {
    const serialized = dumpEmbeddingCache(TOY_CACHE);
    expect(loadEmbeddingCache(serialized)).toEqual(TOY_CACHE);
})