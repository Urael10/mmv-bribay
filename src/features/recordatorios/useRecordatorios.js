import {useEffect} from 'react'
import {vigilar} from './servicio'

// Entrega 41 · se monta una vez en App: en el APK deja los avisos al día; en la PWA no hace nada.
export default function useRecordatorios() {
  useEffect(() => vigilar(), [])
}
