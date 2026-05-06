import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Solo cubrir lógica de negocio, excluir componentes React y hooks de React
      include: ['src/lib/**', 'src/store/**', 'src/services/**'],
      exclude: [
        'src/main.tsx',
        'src/App.tsx',
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
        'src/**/*.stories.tsx',
        'src/test/**',
        'src/pages/**',
        'src/components/**',
        'src/hooks/**', // Excluir: requieren testing de integración WS y React
      ],
      thresholds: {
        // Cobertura objetivo para lógica de negocio (lib, store, services)
        // Los hooks de React se excluyen porque requieren testing de integración WS
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})