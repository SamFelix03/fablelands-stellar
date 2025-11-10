import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import dotenv from "dotenv";

// Load .env file using dotenv
dotenv.config();

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [
      react(),
      nodePolyfills({
        include: ["buffer"],
        globals: {
          Buffer: true,
        },
      }),
      wasm(),
    ],
    build: {
      target: "esnext",
    },
    optimizeDeps: {
      exclude: ["@stellar/stellar-xdr-json"],
    },
    define: {
      global: "window",
    },
    envPrefix: "PUBLIC_",
    server: {
      proxy: {
        "/friendbot": {
          target: "http://localhost:8000/friendbot",
          changeOrigin: true,
        },
        "/api/imagegen": {
          target: "https://imagegen-739298578243.us-central1.run.app",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/imagegen/, ""),
        },
        "/api/clipgen": {
          target: "https://clipgen-739298578243.us-central1.run.app",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/clipgen/, ""),
        },
        "/api/s3-proxy": {
          target: "https://real-estate-brochures-tenori.s3.ap-south-1.amazonaws.com",
          changeOrigin: true,
          rewrite: (path) => {
            // Extract the S3 path from the query parameter
            try {
              const url = new URL(path, 'http://localhost:5173')
              const s3Path = url.searchParams.get('path')
              if (s3Path) {
                return decodeURIComponent(s3Path)
              }
            } catch (e) {
              console.warn('Error parsing S3 proxy path:', e)
            }
            return path.replace(/^\/api\/s3-proxy/, "")
          },
        },
      },
    },
  };
});
