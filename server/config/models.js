export const MODELS = {
  qwen_3_5: {
    name: 'Qwen 3.5 122B (NVIDIA)',
    provider: 'nvidia',
    model: 'qwen/qwq-32b',
    endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
    apiKeyEnv: 'NVIDIA_API_KEY',
    free: true,
  },
};

export const DEFAULT_MODEL = 'qwen_3_5';
