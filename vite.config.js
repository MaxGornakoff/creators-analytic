import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// !!! ОБНОВИТЬ ЭТУ СТРОКУ !!!
const NGROK_HOST = '9532b6c23918.ngrok-free.app'; 

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, 
    port: 5173, 
    strictPort: true,
    hmr: {
        protocol: 'ws',
        host: NGROK_HOST,
    },
    allowedHosts: [
        NGROK_HOST
    ]
  }
})