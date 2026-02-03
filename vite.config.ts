import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        target: 'esnext',
        minify: 'terser',
        sourcemap: true
    },
    server: {
        host: true,
        port: 5173
    },
    optimizeDeps: {
        include: ['three']
    }
});
