import { convert } from "html-to-text";
import type { PromptChain } from "./chains/chains";
import type { PromptStep, PromptStepResult } from "./chains/prompts";
import { defaultPredictionSettings } from "./services";
import { assert } from "./util";
import fs from 'fs';
import { loadEmbeddingCache, type EmbeddingCache, dumpEmbeddingCache, trimEmbeddingCache } from "./embeddingCache";


const API_ROOT = '';
// const API_ROOT = 'https://webhook.site/2c78c4a9-5a7a-4ede-9488-0584c7214f08';

export interface PostPromptChainBody extends PromptChain {
    embeddingCacheBase64?: string
}

/*
 * Chain Input/Output
 */

function chainBasePath(promptId: string) {
    return `./data/${promptId[0]}/${promptId}`
}

function chainDataPath(promptId: string) {
    return chainBasePath(promptId) + '/prompt.json'
}

function chainEditKeyPath(promptId: string) {
    return chainBasePath(promptId) + '/editKey'
}

function chainEmbeddingCachePath(promptId: string) {
    return chainBasePath(promptId) + '/embeddingCache.v1.proto'
    // return chainBasePath(promptId) + '/embeddingCache.json.gz'
}

export function chainExists(chainId: string) {
    return fs.existsSync(chainBasePath(chainId));
}

export async function saveChain(chainId: string, chain: PromptChain, editKey: string, embeddingCacheBytes: Uint8Array | null) {
    // export function save({promptId: string, prompt: Prompt}) {
    // console.debug(`Saving chain "${chainId}": ` + util.inspect(chain, {showHidden: false, depth: null, colors: true}));
    // console.log("saving chain emb: ", embeddingCacheBytes);
    const basePath: string = chainBasePath(chainId);
    if (!fs.existsSync(basePath)) {
        fs.mkdirSync(basePath, { recursive: true });
        fs.writeFileSync(
            chainEditKeyPath(chainId),
            editKey,
            'utf8'
        );
    } else if (!isValidEditKey(chainId, editKey)) {
        throw new PermissionDeniedError(`Incorrect editKey for prompt record at: ${basePath}`)
    }

    fs.writeFileSync(
        chainDataPath(chainId),
        JSON.stringify(chain),
        'utf8'
    );

    if (embeddingCacheBytes) {
        // Enforce cahce max size (frontend should send and already trimmed cache)
        // TODO: log malicious calls
        const embeddingCache: EmbeddingCache = await loadEmbeddingCache(embeddingCacheBytes);
        embeddingCacheBytes = await dumpEmbeddingCache(trimEmbeddingCache(embeddingCache));

        fs.writeFileSync(
            chainEmbeddingCachePath(chainId),
            Buffer.from(embeddingCacheBytes)
        )

        // TEST
        // fs.writeFileSync(
        //     chainEmbeddingCachePath(chainId) + "-PROTOBUF",
        //     Buffer.from(dumpEmbeddingCacheProtobuf(embeddingCache))
        // )
        // fs.writeFileSync(
        //     chainEmbeddingCachePath(chainId) + "-JSON",
        //     JSON.stringify(embeddingCache)
        // )
    }
}

function isValidEditKey(chainId: string, editKey: string): boolean {
    let expected: string = fs.readFileSync(chainEditKeyPath(chainId)).toString();
    return expected == editKey;
}

export function loadChain(chainId: string): PromptChain {
    let rawdata: Buffer;

    try {
        rawdata = fs.readFileSync(chainDataPath(chainId));
    } catch (error: any) {
        const nodeError: NodeJS.ErrnoException = error;
        if (nodeError.code == "ENOENT") {
            throw new ChainNotFoundError("loadChain: Chain not found");
        }
        throw error;
    }

    let chainOrPrompt: object = JSON.parse(rawdata.toString());

    // Upgrade if legacy record
    let chain = upgradeChainOrPrompt(chainOrPrompt)

    return chain;
}

/**
 * This is called by API endpoints to retrieve bytes of the embedding cache file. These bytes are meant to be interpreted by {@link loadEmbeddingCache} to produce an {@link EmbeddingCache structure}
 * 
 * @param chainId ID of the chain to load embeddings for
 * @returns An array of bytes containin the embedding cache
 */
export function readEmbeddingCacheBytes(chainId: string): Uint8Array {
    if (! fs.existsSync(chainDataPath(chainId))) {
        throw new ChainNotFoundError("readEmbeddingCacheBytes: Chain not found");
    }

    let rawdata: Buffer;
    try {
        rawdata = fs.readFileSync(chainEmbeddingCachePath(chainId));
    } catch (error: any) {
        const nodeError: NodeJS.ErrnoException = error;

        // Cache not saved for this chainId, it's ok
        if (nodeError.code == "ENOENT") {
            return new Uint8Array();
        }
        throw error;
    }
    return rawdata;
}

export class ChainNotFoundError extends Error { };
export class PermissionDeniedError extends Error { };



/*
 * Record Compatibility
 */

function upgradeChainOrPrompt(chainOrPrompt: any): PromptChain {
    if (chainOrPrompt.version <= 2) {
        return upgradePrompt(chainOrPrompt as PromptStep)
    }

    return upgradeChain(chainOrPrompt as PromptChain);
}

function upgradePrompt(prompt: any): PromptChain {
    assert(prompt.version <= 2); // From v3 records have PromptChain type

    if (prompt.version == 1) {
        prompt.prompt_text = convert(prompt.prompt_text);
        prompt.version = 2;
    }

    let result = {
        version: 3,
        title: prompt.title,
        prompts: [prompt]
    }

    return upgradeChain(result);
}

function upgradeChain(chain: any): PromptChain {
    if (chain.version < 4) {
        chain = {
            version: 4,
            title: chain.title,
            prompts: [{
                version: 4,
                promptText: chain.prompts[0].prompt_text,
                parametersDict: chain.prompts[0].parameters_dict,
                title: chain.prompts[0].title,
                predictions: chain.prompts[0].predictions ?? null,
                predictionService: "openai",
                predictionSettings: defaultPredictionSettings(),
            }]
        }
    }

    if (chain.version < 5) {
        chain = {
            version: 5,
            title: chain.title,
            parametersDict: chain.prompts[0].parametersDict,
            steps: chain.prompts.map((prompt: any) => ({
                stepType: "prompt",
                title: prompt.title,
                resultKey: "result_0",
                results: prompt.predictions?.map((prediction: any): PromptStepResult => {
                    return {
                        model: prediction.model,
                        datetime: prediction.datetime,
                        renderedPrompt: prediction.renderedPrompt,
                        resultRaw: prediction.predictionRaw,
                        resultJson: null
                    }
                }),
                minimized: false,
                promptText: prompt.promptText,
                predictionService: prompt.predictionService,
                predictionSettings: prompt.predictionSettings
            }))
        }
    }

    // console.log("Loading chain", chain as PromptChain);
    return chain;
}


//
// Util
//

export function apiUrl(resource: string) {
    if (resource.startsWith('/')) {
        resource = resource.substring(1);
    }
    return API_ROOT + "/" + resource;
}
