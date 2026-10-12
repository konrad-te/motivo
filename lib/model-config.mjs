export function getModelConfig(values = {}, environment = process.env) {
  const provider = String(values.AI_PROVIDER || environment.AI_PROVIDER || '').toLowerCase();
  const apiKey = values.OPENAI_API_KEY || environment.OPENAI_API_KEY;
  if (provider === 'ollama') return {
    provider:'ollama',
    model:values.OLLAMA_MODEL || environment.OLLAMA_MODEL || 'qwen3.5:4b',
    baseUrl:values.OLLAMA_BASE_URL || environment.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'
  };
  if (provider === 'openai' && apiKey) return {provider:'openai',model:values.OPENAI_MODEL || environment.OPENAI_MODEL || 'gpt-6.1-sol',apiKey};
  if (!provider && apiKey) return {provider:'openai',model:values.OPENAI_MODEL || environment.OPENAI_MODEL || 'gpt-6.1-sol',apiKey};
  return {provider:'catalog',model:'deterministic-baseline-v1'};
}
