import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development the app calls localhost:8080, and Vite passes the calls to Foundry (platform facts: verified in the
// smoke test). So no CORS change is needed on the enrollment.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 8080,
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
