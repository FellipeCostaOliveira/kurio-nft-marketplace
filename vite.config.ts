import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// Build único para dev, demonstração e testes. A camada de mocks entra
// por configuração (VITE_ENABLE_MOCKS) e fica em chunks próprios.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('msw') || id.includes('@mswjs') || id.includes('engine.io-parser') || id.includes('socket.io-parser')) return 'mocks-vendor'
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'react'
          }
        },
      },
    },
  },
  server: { port: 5173 },
  preview: { port: 4173 },
})
