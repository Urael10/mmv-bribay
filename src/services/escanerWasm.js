// MMV · lector de códigos de barras de reemplazo (Entrega 43, v0.44.0).
// El WebView de Android (APK) no trae BarcodeDetector. Este módulo expone la misma clase con ZXing en WebAssembly
// (`barcode-detector`, ponyfill: no toca `window`). El .wasm se empaqueta con la app (Vite lo copia a dist/assets), así que
// no se descarga de ninguna CDN. Solo lo baja `escaner.js` cuando hace falta (import dinámico).
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import {BarcodeDetector, setZXingModuleOverrides} from 'barcode-detector/ponyfill'

setZXingModuleOverrides({
  locateFile: (ruta, prefijo) => (String(ruta).endsWith('.wasm') ? wasmUrl : prefijo + ruta)
})

export {BarcodeDetector}
