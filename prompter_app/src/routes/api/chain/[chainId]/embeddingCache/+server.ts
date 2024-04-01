import { loadEmbeddingCacheBytes } from "$lib/api";
import type { RequestHandler } from "@sveltejs/kit";
import { bytesToBase64 } from "byte-base64";

/**
 * Return a base64 representation of the embeddingCache binary.
 * Client should decode base64 and load with ...
 */
export const GET = (({ params }) => {
    // console.log(`GET /api/chain. id: ${id}`);
    const embeddingCacheBytes: Uint8Array = loadEmbeddingCacheBytes(params.chainId!);
    return new Response(bytesToBase64(embeddingCacheBytes));
}) satisfies RequestHandler;
