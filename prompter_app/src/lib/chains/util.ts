// TODO: move other util functions here

import type { PromptChain } from "./chains";

/**
 * Prompt chains accumulate more information than needed while being edited.
 * This function prunes redundant information, namely:
 * 
 * - Parameter dict entries that are not referenced in prompts are removed. (to be implemented)
 * - Embedding cache entries that are not matched in document index segments are removed
 * 
 * @param promptChain Any prompt chain
 */
export async function pruneChain(promptChain: PromptChain) : Promise<PromptChain> {
    // Prune parameter dict
    // TODO: implement
    return promptChain;
  }