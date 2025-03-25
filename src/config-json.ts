export const configJson = {
  env: {
    https_proxy: "",
    OPENAI_BASE_URL: "https://openrouter.ai/api/v1",
    GEMINI_API_KEY: "AIzaSyAr71blNhanhWAAEqG72UEyJMA35l-lnGA",
    OPENAI_API_KEY:
      "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",
    JINA_API_KEY:
      "jina_f71f1b30c087401c81a76fe09f5c270bshV358Y2Gdbp1LtbK74k60XiGhzr",
    BRAVE_API_KEY: "",
    SERPER_API_KEY: "",
    DEFAULT_MODEL_NAME: "",
  },
  defaults: {
    search_provider: "jina",
    llm_provider: "openai",
    step_sleep: 100,
  },
  providers: {
    gemini: {
      createClient: "createGoogleGenerativeAI",
    },
    openai: {
      createClient: "createOpenAI",
      clientConfig: {
        compatibility: "strict",
      },
    },
  },
  models: {
    gemini: {
      default: {
        model: "gemini-2.0-flash",
        temperature: 0,
        maxTokens: 2000,
      },
      tools: {
        coder: { temperature: 0.7 },
        searchGrounding: { temperature: 0 },
        dedup: { temperature: 0.1 },
        evaluator: { temperature: 0.6, maxTokens: 200 },
        errorAnalyzer: {},
        queryRewriter: { temperature: 0.1 },
        agent: { temperature: 0.7 },
        agentBeastMode: { temperature: 0.7 },
        fallback: { maxTokens: 8000, model: "gemini-2.0-flash-lite" },
      },
    },
    openai: {
      default: {
        model: "gpt-4o-mini",
        temperature: 0,
        maxTokens: 8000,
      },
      tools: {
        coder: { temperature: 0.7 },
        searchGrounding: { temperature: 0 },
        dedup: { temperature: 0.1 },
        evaluator: {},
        errorAnalyzer: {},
        queryRewriter: { temperature: 0.1 },
        agent: { temperature: 0.7 },
        agentBeastMode: { temperature: 0.7 },
        fallback: { temperature: 0 },
      },
    },
  },
};
