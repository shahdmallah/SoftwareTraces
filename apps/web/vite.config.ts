import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const mobileEnvDir = path.resolve(__dirname, '../mobile')
  const webEnv = loadEnv(mode, __dirname, ['VITE_', 'EXPO_PUBLIC_'])
  const mobileEnv = loadEnv(mode, mobileEnvDir, ['EXPO_PUBLIC_'])

  const mapboxAccessToken =
    webEnv.VITE_MAPBOX_ACCESS_TOKEN ||
    webEnv.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ||
    mobileEnv.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ||
    process.env.VITE_MAPBOX_ACCESS_TOKEN ||
    process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ||
    ''

  const mapboxStyleUrl =
    webEnv.VITE_MAPBOX_STYLE_URL ||
    webEnv.EXPO_PUBLIC_MAPBOX_STYLE_URL ||
    mobileEnv.EXPO_PUBLIC_MAPBOX_STYLE_URL ||
    process.env.VITE_MAPBOX_STYLE_URL ||
    process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL ||
    ''

  return {
    plugins: [
      // The React and Tailwind plugins are both required for Make, even if
      // Tailwind is not being actively used.
      react(),
      tailwindcss(),
    ],
    define: {
      'import.meta.env.VITE_MAPBOX_ACCESS_TOKEN': JSON.stringify(mapboxAccessToken),
      'import.meta.env.VITE_MAPBOX_STYLE_URL': JSON.stringify(mapboxStyleUrl),
    },
    resolve: {
      alias: {
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
    },

    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: ['**/*.svg', '**/*.csv'],
  }
})
