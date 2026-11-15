import { defineConfig, loadEnv } from "vite";
import { aiMiddleware } from "./server/ai.mjs";
import { voiceMiddleware } from "./server/voice.mjs";
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  return {
    plugins: [
      {
        name: "private-gemini-api",
        configureServer(server) {
          server.middlewares.use(aiMiddleware(env));
          server.middlewares.use(voiceMiddleware(env));
        },
        configurePreviewServer(server) {
          server.middlewares.use(aiMiddleware(env));
          server.middlewares.use(voiceMiddleware(env));
        },
      },
    ],
  };
});
