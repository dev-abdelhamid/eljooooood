import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  assetsInclude: ['**/*.ttf'], // دعم ملفات الخطوط
  server: {
    fs: {
      // السماح بالوصول إلى ملفات الخطوط في مجلد public/fonts
      allow: ['.', './public/fonts'],
    },
  },
  build: {
    assetsInlineLimit: 0, // منع إدراج ملفات الخطوط كـ inline
    rollupOptions: {
      // التأكد من إدراج ملفات الخطوط في عملية البناء
      output: {
        assetFileNames: 'fonts/[name].[ext]', // وضع ملفات الخطوط في مجلد fonts
      },
    },
  },
});