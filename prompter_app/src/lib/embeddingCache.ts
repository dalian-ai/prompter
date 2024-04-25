import { StepType, type PromptChain } from './chains/chains';
import { getSegments, type DocumentIndexStep, getEmbeddingModelName } from './chains/documentIndex';
import type { XXHashAPI } from 'xxhash-wasm';
import xxhash from 'xxhash-wasm';
import { embeddingCacheMaxSize } from './config/public';
import { dumpEmbeddingCacheProtobuf, loadEmbeddingCacheProtobuf } from './embeddingCacheProtobuf';


//
// Hashing
//

let xxhashLoaded = xxhash();

/**
 * Centralizes the segment hash function to ensure consistent cache access
 */
export class CacheDocumentHasher {
  loadedXxhash: XXHashAPI

  constructor(loadedXxhash: XXHashAPI) {
    this.loadedXxhash = loadedXxhash;
  }

  hash(text: string) : string {
    return this.loadedXxhash.h32ToString(text);
  }
}

/**
 * We use xxhash-wasm for cache, which is fast but require async load of the WASM module.
 * This function returns a document hasher class that recycles the xxhash instance that
 * is loaded at module level.
 * 
 * This way hashing 100K "Mary had a little lamb" strings took 78ms, comparable with loading
 * xxhash directly (84ms). A baseline wrapper hashString function that 1) awaits xxhash 2) hashes
 * a single string input goes out of memory. A modified hashString that awaits on documentIndex.xxhashLoaded
 * took 1464ms to hash the 100K strings.
 * 
 * @returns A CacheDocumentHasher instance
 */
export async function getCacheDocumentHasher() : Promise<CacheDocumentHasher> {
  let hasher = await xxhashLoaded;
  return new CacheDocumentHasher(hasher);
}

//
// Embedding Cache Interface
//

//                           modelSpec -> (segmentHash -> embedding)
export type EmbeddingCache = Record<string, Record<string, number[]>>
// export type EmbeddingCache = {[embeddingService in PredictionService]?: Record<string, Record<string, number[]>> }

export function getEmbeddingModelSpecString(docIndexStep: DocumentIndexStep) : string {
    // ollama|gemma:7b
    return docIndexStep.embeddingService + '|' + getEmbeddingModelName(docIndexStep);
}

export async function pruneEmbeddingCache(embeddingCache: EmbeddingCache, promptChain: PromptChain) : Promise<EmbeddingCache> {
    // Prune unusued embeddings from cache (note that query embeddings are not cached)
    let prunedCache: EmbeddingCache = {}; // TODO: consider pruning in place to optimize memory
    let hasher = await getCacheDocumentHasher();
    promptChain.steps.forEach(step => {
      if (step.stepType == StepType.documentIndex) {
        const docIndexStep: DocumentIndexStep = step as DocumentIndexStep;
        const modelSpec: string = getEmbeddingModelSpecString(docIndexStep);
        if (modelSpec in embeddingCache) {
            if (! (modelSpec in prunedCache)) prunedCache[modelSpec] = {};
            Object.values(getSegments(step as DocumentIndexStep)).forEach(segments => {
                segments.forEach(s => {
                    const sHash = hasher.hash(s);
                    const sCached = embeddingCache[modelSpec][sHash];
                    if (sCached) prunedCache[modelSpec][sHash] = sCached;
                    // console.log("pruning: ", sCached, sHash, s);
                })
            })
        }
      }
    });
    return prunedCache;
}


/**
 * Drop cached embeddings until the total number is under `embeddingCacheMaxSize`
 * 
 * @param embeddingCache An EmbeddingCache object
 * @returns the same embeddingCache object, stripped of exceeding embeddings
 */
export function trimEmbeddingCache(embeddingCache: EmbeddingCache, maxSize: number = embeddingCacheMaxSize) : EmbeddingCache {
    let embeddingsLeft = maxSize;
    for (const modelSpec in embeddingCache) {
        for (const key in embeddingCache[modelSpec]) {
            if (embeddingsLeft-- <= 0) {
                delete embeddingCache[modelSpec][key];
            }
        }
    }
    return embeddingCache;
}

//
// I/O
//

// | N. embeddings | Embedding type   | Size (JSON) | Size (JSON+gzip)    | Size (protobuf)         |
// |---------------|------------------|-------------|---------------------|-------------------------|
// | 10            | openai           | 211.5 KB    | 79.5 KB             | 135.4 KB                |
// | 993           | openai           | 19.1 MB     | 7.1 MB (~7s encode) | 12.2 MB (~500ms encode) |
// | 993           | nomic-embed-text | 15.1 MB     | 6.9 MB (~6s encode) | 6.1 MB (~400ms encode)  |


export async function dumpEmbeddingCache(aCacheInstance: EmbeddingCache): Promise<Uint8Array> {
    return dumpEmbeddingCacheProtobuf(aCacheInstance);
    
    // import { compress } from './gzip';
    // return compress(JSON.stringify(aCacheInstance));
}

export async function loadEmbeddingCache(serializedCacheBytes: Uint8Array): Promise<EmbeddingCache> {
    return loadEmbeddingCacheProtobuf(serializedCacheBytes);
    
    // import { decompress } from './gzip';
    // return JSON.parse(await decompress(serializedCacheBytes));
}
