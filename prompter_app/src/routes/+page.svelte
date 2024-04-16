<script>
	import PromptChainEditor from '../components/chainEditor/PromptChainEditor.svelte';
	import { siteName } from '$lib/config/public';
</script>

<svelte:head>
	<title>{siteName}</title>
	<meta name="description" content="A Web UI for editing and sharing LLM prompts" />
</svelte:head>

<section>
	<PromptChainEditor />
</section>

<style>
	section {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		/* flex: 0.6; */
	}
</style>
