import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
          overlay: resolve(__dirname, 'src/preload/overlay.ts'),
          'ai-overlay': resolve(__dirname, 'src/preload/ai-overlay.ts'),
          'interview-banner': resolve(__dirname, 'src/preload/interview-banner.ts')
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src')
      }
    },
    plugins: [vue(), tailwindcss()]
  }
})
