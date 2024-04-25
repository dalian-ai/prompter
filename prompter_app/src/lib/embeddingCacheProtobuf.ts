import { default as protobuf } from 'protobufjs';

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

import type { EmbeddingCache } from "./embeddingCache";

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

export function dumpEmbeddingCacheProtobuf(aCacheInstance: EmbeddingCache): Uint8Array {
    // --- comparison test --- protolo

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
    
    console.log("proto preproc: ", preprocessedCache);
    console.log("proto dump: ", encodedBuffer);
    return encodedBuffer;
    // return base64.bytesToBase64(encodedBuffer);
}

export function loadEmbeddingCacheProtobuf(serializedCacheBytes: Uint8Array) : EmbeddingCache {
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