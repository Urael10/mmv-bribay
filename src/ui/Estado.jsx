import Icono from './Icono'
import {chipEstado} from '../domain/variacion'

// Rótulo de estado como chip: ícono + texto + color semántico (el color nunca va solo).
export default function Estado({etiqueta, tono = ''}) {
  const {tipo, icono} = chipEstado(etiqueta, tono)
  return (
    <span className={'estado ' + tipo}>
      <Icono n={icono} tam={14} />
      {etiqueta}
    </span>
  )
}
