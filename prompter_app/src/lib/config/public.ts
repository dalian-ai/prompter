import { env } from "$env/dynamic/public";

export const siteName: string = env.PUBLIC_SITE_NAME ?? "Prompter";
export const embeddingCacheMaxSize: number = parseInt(env.PUBLIC_EMBEDDING_CACHE_MAX_SIZE ?? "1000");