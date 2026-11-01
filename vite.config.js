import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {readFileSync} from 'node:fs'
// Trazabilidad: versión (package.json) + fecha y hora de compilación, visibles en la app y en /version.json
const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))
const info = {version: pkg.version, entrega: pkg.entrega, build: new Date().toISOString()}
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'version-json',
      generateBundle() {
        this.emitFile({type: 'asset', fileName: 'version.json', source: JSON.stringify(info)})
      }
    }
  ],
  define: {__APP_INFO__: JSON.stringify(info)},
  base: './'
})
