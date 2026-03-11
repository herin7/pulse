export const MODELS = {
  gemini: {
    name: "Gemini 2.0 Flash",
    provider: "google",
    model: "gemini-2.5-flash-lite",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    apiKeyEnv: "GEMINI_API_KEY",
    free: true,
  },
  groq_llama: {
    name: "Llama 3.3 70B (Groq)",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    apiKeyEnv: "GROQ_API_KEY",
    free: true,
  },
  sarvam: {
    name: "Sarvam 105B",
    provider: "sarvam",
    model: "sarvam-105b",
    endpoint: "https://api.sarvam.ai/v1/chat/completions",
    apiKeyEnv: "SARVAM_API_KEY",
    free: false,
  },
  claude: {
    name: "Claude Sonnet (Anthropic)",
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    endpoint: "https://api.anthropic.com/v1/messages",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    free: false,
  },
};

export const DEFAULT_MODEL = "gemini";
