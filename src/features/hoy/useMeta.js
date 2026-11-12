// Entrega 49 (v0.50.0) · festejo de una meta en Hoy. Avisa a src/services/feedback.js si la meta está cumplida y,
// cuando pasa de no cumplida a cumplida mientras la pantalla está abierta, la festeja (una vez por meta y por día).
// `valor` es null mientras el dato no se cargó: esa primera lectura es solo el punto de partida y no festeja.
// Devuelve true unos instantes después de festejar, para que el anillo dé su pulso.
import {useEffect, useRef, useState} from 'react'
import {cruzoMeta} from '../../domain/feedback'
import {festejarMeta, marcarCumplida} from '../../services/feedback'

export default function useMeta(clave, valor, meta) {
  const antes = useRef(null),
    reloj = useRef(null),
    [pop, setPop] = useState(false)
  useEffect(() => {
    if (valor === null || valor === undefined || !(+meta > 0)) return
    marcarCumplida(clave, +valor >= +meta)
    if (cruzoMeta(antes.current, valor, meta) && festejarMeta(clave)) {
      setPop(true)
      clearTimeout(reloj.current)
      reloj.current = setTimeout(() => setPop(false), 1000)
    }
    antes.current = valor
  }, [clave, valor, meta])
  useEffect(() => () => clearTimeout(reloj.current), [])
  return pop
}
