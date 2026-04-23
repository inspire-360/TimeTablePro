import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const normalizeModuleId = (id) => id.replaceAll('\\', '/')

const getVendorChunkName = (id) => {
  const normalizedId = normalizeModuleId(id)

  if (!normalizedId.includes('/node_modules/')) {
    return undefined
  }

  if (
    normalizedId.includes('/node_modules/react/') ||
    normalizedId.includes('/node_modules/react-dom/') ||
    normalizedId.includes('/node_modules/react-router/') ||
    normalizedId.includes('/node_modules/react-router-dom/')
  ) {
    return 'react-vendor'
  }

  if (
    normalizedId.includes('/node_modules/firebase/') ||
    normalizedId.includes('/node_modules/@firebase/')
  ) {
    return 'firebase-vendor'
  }

  if (normalizedId.includes('/node_modules/html2canvas/')) {
    return 'html2canvas-vendor'
  }

  if (
    normalizedId.includes('/node_modules/jspdf/') ||
    normalizedId.includes('/node_modules/fflate/')
  ) {
    return 'jspdf-vendor'
  }

  if (normalizedId.includes('/node_modules/dayjs/')) {
    return 'date-vendor'
  }

  return 'vendor'
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        manualChunks: getVendorChunkName,
      },
    },
  },
})
