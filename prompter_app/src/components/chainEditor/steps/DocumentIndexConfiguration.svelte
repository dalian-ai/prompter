<script lang="ts">
	import { STEP_TYPE_DATA, StepType } from '$lib/chains/chains';
	import type { DocumentIndexStep } from '$lib/chains/documentIndex';
	import { embeddingCacheMaxSize } from '$lib/config/public';
	import { editorSession } from '$lib/editorSession';
	import { getEmbeddingModelSpecString } from '$lib/embeddingCache';
	import { PredictionService, LLM_SERVICE_NAMES, type PredictionSettings, ENABLED_EMBEDDING_SERVICES, OPENAI_EMBEDDING_MODELS } from "$lib/services";
	import Button from '../../Button.svelte';
	import PredictionServiceSettings from '../userSettings/PredictionServiceSettings.svelte';

    export let docIndexStep: DocumentIndexStep;

    let cacheCount: number = 0;
    $: cacheCount = Object.keys($editorSession.embeddingCache[getEmbeddingModelSpecString(docIndexStep)] ?? {}).length;

    function clearCache() {
        $editorSession.embeddingCache = {};
    }
</script>

    <h2>{STEP_TYPE_DATA[StepType.documentIndex].label} configuration</h2>

    <table>
        <tr>
            <th><label for="llmService">Embedding Service</label></th>
            <td>
                <select name="llmService" id="llmService" bind:value={docIndexStep.embeddingService}>
                    {#each ENABLED_EMBEDDING_SERVICES as service}
                    <option value={service}>{LLM_SERVICE_NAMES[service]}</option>
                    <!-- <option value={service}>{service}</option> -->
                    {/each}
                </select>
            </td>
        </tr>

        {#if docIndexStep.embeddingService == PredictionService.openai}
            <tr>
                <th><label for="openaiModel">Embedding Model</label></th>
                <td>
                    <select name="openaiModel" id="openaiModel" bind:value={docIndexStep.embeddingSettings.openai.modelName}>
                        {#each OPENAI_EMBEDDING_MODELS as model}
                            <option value={model}>{model}</option>
                        {/each}
                    </select>
                </td>
            </tr>
        {/if}
        

        {#if docIndexStep.embeddingService == PredictionService.ollama}
            <tr>
                <th><label for="ollamaModel">Embedding Model</label></th>
                <td>
                    <input type="text" name="ollamaModel" id="ollamaModel" bind:value={docIndexStep.embeddingSettings.ollama.modelName} />
                </td>
            </tr>
        {/if}

        <tr>
            <th>Embedding cache</th>
            <td class="embeddingCacheCell">
                <p class:cacheExceeded={cacheCount > embeddingCacheMaxSize} title="At most {embeddingCacheMaxSize} embeddings are saved in shared prompts. Exceeding embeddings will be computed at prediction time">
                    {cacheCount} / {embeddingCacheMaxSize}
                    &nbsp;
                    <Button label="Clear cache" style="B" size="medium" onClick={clearCache} /> 
                </p>
                {#if cacheCount > embeddingCacheMaxSize}
                    <p class="cacheExceedWarning">At most {embeddingCacheMaxSize} can be stored in saved prompts (exceeding segments will be re-embeeded at prediction time).</p>
                    <p class="cacheExceedWarning">To overcome this limitation you can run your own instance, or ask for a managed account at <a href="mailto:info@conversabile.com">info@conversabile.com</a>.</p>
                {/if}
            </td>
        </tr>
    </table>

    <h2>User configuration</h2>

    <PredictionServiceSettings bind:service={docIndexStep.embeddingService} />
    
<style>
.embeddingCacheCell p {
   margin: .5em 0;
}

.cacheExceeded {
    color: orange;
}

.cacheExceedWarning {
    font-size: .8em;
}
</style>
