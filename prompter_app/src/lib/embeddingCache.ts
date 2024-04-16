import { default as protobuf } from 'protobufjs';
import * as base64 from "byte-base64";
import { StepType, type PromptChain } from './chains/chains';
import { getSegments, type DocumentIndexStep, getEmbeddingModelName } from './chains/documentIndex';
import type { XXHashAPI } from 'xxhash-wasm';
import xxhash from 'xxhash-wasm';
import { embeddingCacheMaxSize } from './config/public';

// import { browser } from '$app/environment';
// import * as fs from "fs";


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

// Protobuf schema for efficient serialization:
// (reduces ~50% wrt JSON)
//
// {
//     version: 1,
//     models: [
//         {
//             model_name: 'any-model-name',
//             text_hashes: ['aaa', 'bbb'],
//             embeddings: [{ e: [0.1, 0.2, 0.3] }, { e: [0.4, 0.5, 0.6] }]
//         }
//     ]
// };
//

var root = protobuf.Root.fromJSON({
    nested: {
        embeddingcache: {
            nested: {
                EmbeddingCache: {
                    fields: {
                        models: {
                            rule: 'repeated',
                            type: 'ModelCacheRecord',
                            id: 1
                        },
                        version: {
                            type: 'int32',
                            id: 2
                        }
                    }
                },
                ModelCacheRecord: {
                    fields: {
                        model_name: {
                            type: 'string',
                            id: 5
                        },
                        text_hashes: {
                            rule: 'repeated',
                            type: 'string',
                            id: 3
                        },
                        embeddings: {
                            rule: 'repeated',
                            type: 'Embedding',
                            id: 4
                        }
                    }
                },
                Embedding: {
                    fields: {
                        e: {
                            rule: 'repeated',
                            type: 'double',
                            id: 6
                        }
                    }
                }
            }
        }
    }
});

interface EmbeddingCacheProtoInterface {
    version: number,
    models: EmbeddingCacheProtoInterfaceModel[]
}

interface EmbeddingCacheProtoInterfaceModel {
    model_name: string,
    text_hashes: string[],
    embeddings: {e: number[]}[]
}

const EmbeddingCacheProto = root.lookupType('embeddingcache.EmbeddingCache');

export function dumpEmbeddingCache(aCacheInstance: EmbeddingCache): Uint8Array {
    // preprocess original cache
    var preprocessedCache: Record<any, any> = {
        version: 1,
        models: []
    };
    for (const modelName in aCacheInstance) {
        let textHashes: string[] = [];
        let embeddings: Record<string, number[]>[] = [];
        for (const textHash in aCacheInstance[modelName]) {
            textHashes.push(textHash);
            embeddings.push({ e: aCacheInstance[modelName][textHash] });
        }
        preprocessedCache.models.push({
            model_name: modelName,
            text_hashes: textHashes,
            embeddings: embeddings
        });
    }

    let encodedBuffer = EmbeddingCacheProto.encode(preprocessedCache).finish();

    // if (! browser) {

    //     fs.appendFile("TMP_EMBEDDING_CACHE", Buffer.from(encodedBuffer), function (err) {
    //         if (err) {
    //           throw(err);
    //         } else {
    //           return(encodedBuffer.length);
    //         }
    //     });

    //     fs.writeFile("TMP_EMBEDDING_CACHE_JSON", JSON.stringify(aCacheInstance), () => {});
    // }
    
    return encodedBuffer;
    // return base64.bytesToBase64(encodedBuffer);
}

export function loadEmbeddingCache(serializedCacheBytes: Uint8Array): EmbeddingCache {
    // const buffer = base64.base64ToBytes(b64SerializedCache);
    let deserialized: EmbeddingCacheProtoInterface = (EmbeddingCacheProto.decode(serializedCacheBytes) as unknown) as EmbeddingCacheProtoInterface;

    let result: EmbeddingCache = {};
    deserialized['models'].forEach(modelEntry => {
        let modelEmbeddings: Record<string, number[]> = {}
        modelEntry.text_hashes.forEach((textHash, i) => {
            modelEmbeddings[textHash] = modelEntry.embeddings[i].e;
        })
        result[modelEntry.model_name] = modelEmbeddings;
    });

    return result;
}
