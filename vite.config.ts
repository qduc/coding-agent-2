import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      // Entry points for your CLI application
      entry: resolve(__dirname, 'src/cli/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js'
    },
    rollupOptions: {
      // Mark Node.js built-ins and dependencies as external
      external: [
        /^node:.*/,  // Node.js built-ins with 'node:' prefix
        // Node.js built-ins without prefix
        'fs', 'path', 'url', 'util', 'events', 'stream', 'crypto', 'os', 'child_process',
        // All npm dependencies
        /^[^./]/
      ],
      output: {
        // Ensure proper ESM format with .js extensions
        format: 'es',
        // Preserve module structure
        preserveModules: true,
        preserveModulesRoot: 'src',
        // Add .js extensions to imports in the output
        entryFileNames: '[name].js',
        chunkFileNames: '[name]-[hash].js'
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
    target: 'node18',
    minify: false, // Keep readable for CLI debugging
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
