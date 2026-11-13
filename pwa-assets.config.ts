import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#1D4ED8' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#1D4ED8' } },
  },
  images: ['public/icon.svg'],
})
