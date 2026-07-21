import path from "node:path";

import { defaultExclude, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "node",
    exclude: [...defaultExclude, "**/.tmp-*/**"],
  },
});
