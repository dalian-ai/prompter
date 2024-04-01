import { error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

import { isValidChain } from '$lib/chains/chains';
import { saveChain, PermissionDeniedError } from '$lib/api';
import { base64ToBytes } from 'byte-base64';
import type { PostPromptChainBody } from '$lib/api';

export const GET = (({ url }) => {
    const id = Number(url.searchParams.get('id') ?? '0');
    console.log(`GET /api/chain. id: ${id}`);
    return new Response(`I'm a chain with id ${id}`);
}) satisfies RequestHandler;

export const POST = (async ({ url, request, params }) => {
    const chain: PostPromptChainBody = await request.json();
    const editKey = url.searchParams.get('editKey') ?? undefined;
    const embeddingCacheBase64 = chain['embeddingCacheBase64'] ?? null;
    const embeddingCacheBytes = embeddingCacheBase64 ? base64ToBytes(embeddingCacheBase64) : null;
    // console.log("post b64: ", embeddingCacheBase64);
    // console.log("post bytes: ", embeddingCacheBytes);

    delete chain['embeddingCacheBase64'];

    if (editKey === undefined) {
        throw error(400, "Missing URL parameter: editKey");
    }
    console.log(`POST /api/chain/${params.chainId}`);
    if (! isValidChain(chain)) {
        throw error(400, "Invalid chain record");
    }
    try {
        saveChain(params.chainId!, chain, editKey, embeddingCacheBytes);
    } catch (e) {
        if (e instanceof PermissionDeniedError) {
            throw error(403, "Invalid editKey");
        }
        throw(e);
    }
    
    return new Response();
}) satisfies RequestHandler;
