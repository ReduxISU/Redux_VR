import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    // 0.0.0.0 so Windows can reach the dev server through WSL2 port forwarding.
    host: true,
    port: 5173,
  },
})
