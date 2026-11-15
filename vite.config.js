import { defineConfig, loadEnv } from "vite";
import { aiMiddleware } from "./server/ai.mjs";
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  return {
    plugins: [
      {
        name: "private-ai-api",
        configureServer(server) {
          server.middlewares.use(aiMiddleware(env));
        },
        configurePreviewServer(server) {
          server.middlewares.use(aiMiddleware(env));
        },
      },
    ],
  };
});
