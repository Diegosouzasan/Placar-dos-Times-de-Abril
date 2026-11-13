import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { recessoApi } from './server/recesso-api'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), recessoApi()],
  server: {
    watch: { ignored: ['**/.recesso/**'] },
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.recesso/**', '**/*.sqlite', '**/*.sqlite-*'] },
  },
})
