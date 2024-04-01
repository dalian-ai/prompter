import { error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { nanoid } from 'nanoid';

import type { PromptChain } from '$lib/chains/chains';
import { chainExists, saveChain, type PostPromptChainBody } from '$lib/api';
import { base64ToBytes } from 'byte-base64';

export const GET = (({ url }) => {
    return new Response(`Error`);
}) satisfies RequestHandler;

/**
 * Create a new prompt record in database
 */

export const POST = (async ({ url, request }) => {
    const chain: PostPromptChainBody = await request.json();
    const embeddingCacheBase64 = chain['embeddingCacheBase64'] ?? null;
    const embeddingCacheBytes = embeddingCacheBase64 ? base64ToBytes(embeddingCacheBase64) : null;

    delete chain['embeddingCacheBase64'];

    let chainId = nanoid(11);
    while (chainExists(chainId)) {
        console.warn("Chain id collision!", chainId);
        chainId = nanoid(11);
    }
    const editKey = crypto.randomUUID(); // TODO: polyfill
    console.log(`POST /api/chain. Generated chainId: ${chainId}`);
    saveChain(chainId, chain, editKey, embeddingCacheBytes);
    return new Response(JSON.stringify({
        chainId: chainId,
        editKey: editKey
    }));
}) satisfies RequestHandler;
