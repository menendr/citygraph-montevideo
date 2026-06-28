import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const requestedBasePath = process.env.VITE_BASE_PATH || '/'
const basePath = requestedBasePath.endsWith('/') ? requestedBasePath : `${requestedBasePath}/`

// https://vite.dev/config/
export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
})
