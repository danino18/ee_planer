import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react') || id.includes('scheduler')) return 'vendor-react'
          if (id.includes('firebase/auth') || id.includes('@firebase/auth')) return 'vendor-firebase-auth'
          if (id.includes('firebase/firestore') || id.includes('@firebase/firestore')) return 'vendor-firebase-firestore'
          if (id.includes('firebase/app') || id.includes('@firebase/app')) return 'vendor-firebase-core'
          if (id.includes('firebase')) return 'vendor-firebase'
          if (id.includes('@dnd-kit')) return 'vendor-dnd'
          return 'vendor'
        },
      },
    },
  },
})
