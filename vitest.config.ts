import path from "node:path";

import { defaultExclude, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "server-only": path.resolve(__dirname, "test/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    exclude: [
      ...defaultExclude,
      "**/.tmp-*/**",
      "**/.codex-*/**",
      "**/.worktrees/**",
      "**/.fix-*/**",
      "**/source/**",
      "**/validation/**",
      "**/recruitment-alerts/**",
    ],
  },
});
