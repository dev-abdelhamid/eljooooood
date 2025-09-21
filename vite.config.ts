import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
        include: ['bidi-js', 'jspdf', 'jspdf-autotable'], // تأكد من تضمين bidi-js

    exclude: ['lucide-react'],
  },
});
