import { readEmbeddingCacheBytes } from "$lib/api";
import type { RequestHandler } from "@sveltejs/kit";
import { bytesToBase64 } from "byte-base64";

// export interface EmbeddingCacheResponse {
//     base64: string,
//     format: "proto" | "json.gz"
// }

/**
 * Return a base64 representation of the embeddingCache binary.
 * Client should decode base64 and load with ...
 */
export const GET = (({ params }) => {
    // console.log(`GET /api/chain/{id}/embeddingCache. id: ${id}`);
    const embeddingCacheBytes: Uint8Array = readEmbeddingCacheBytes(params.chainId!);
    return new Response(bytesToBase64(embeddingCacheBytes));
}) satisfies RequestHandler;
