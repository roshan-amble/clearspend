import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The supplier site runs on its own port with its own OAuth client (D9, P11). Vite passes the calls to Foundry.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 8081,
    strictPort: true,
    proxy: {
      "^(/multipass/api|/api)": {
        target: "https://roshan-amble.usw-3.palantirfoundry.com",
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
