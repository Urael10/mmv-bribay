// Llamada a Gemini: reintenta solo lo que sirve reintentar, prueba el modelo de respaldo y dice QUÉ falló.
// Tres clases de error distintas (antes se trataban igual y se mostraban todas como «alta demanda»):
//  · cuota (429): reintentar el mismo modelo GASTA más cuota y no sirve; se pasa al otro modelo y se avisa.
//  · sobrecarga (500/502/503/504, «high demand»): sí sirve esperar y reintentar.
//  · formato (la IA contestó algo que no es JSON): se reintenta una vez más y, si sigue, se dice.
const SOBRECARGA = /high demand|overloaded|unavailable|try again/i
const CUOTA = /quota|rate.?limit|resource.?exhausted|too many requests/i
const retirado = m => /no longer|not found|deprecat|not supported for generatecontent/i.test(m || '')
const claveMala = m => /api key not valid|api_key_invalid|invalid api key|permission denied|api key expired/i.test(m || '')
const demora = ms => new Promise(r => setTimeout(r, ms))
export const URL_IA = 'https://generativelanguage.googleapis.com/v1beta'

const codigoDe = (j, st) => j?.error?.code || st
export const esCuota = (j, st) => codigoDe(j, st) === 429 || CUOTA.test(j?.error?.message || '')
export const esSobrecarga = (j, st) =>
  [500, 502, 503, 504].includes(codigoDe(j, st)) || SOBRECARGA.test(j?.error?.message || '')

// «Please retry in 34.5s» → 35 (segundos), o null.
export const segundosDeEspera = msg => {
  const m = /retry in ([\d.]+)\s*s/i.exec(msg || '')
  return m ? Math.ceil(+m[1]) : null
}

// Saca el JSON de la respuesta aunque venga entre ```json … ``` o con texto alrededor. Devuelve null si no hay.
export function leerJSON(txt) {
  const t = String(txt || '')
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
  try {
    return JSON.parse(t)
  } catch {}
  const a = t.indexOf('{'),
    z = t.lastIndexOf('}')
  if (a >= 0 && z > a)
    try {
      return JSON.parse(t.slice(a, z + 1))
    } catch {}
  return null
}

const detalle = (cod, modelo) => ` [código ${cod || '?'} · ${modelo || '?'}]`

export async function pedirIA({
  modelos,
  key,
  cuerpo,
  prog = () => {},
  espera = demora,
  pedir = fetch,
  intentos = 3,
  alt = 'cargá la sesión manual'
}) {
  const lista = [...new Set(modelos.filter(Boolean))]
  let ult = '',
    cod = '',
    mod = '',
    clase = '', // 'cuota' | 'sobrecarga' | 'red' | 'formato' | 'otro'
    espSeg = null,
    n = 0
  for (let k = 0; k < lista.length; k++) {
    const m = lista[k]
    for (let i = 0; i < intentos; i++) {
      if (n++)
        prog(
          clase === 'red'
            ? `Sin conexión con Google. Reintentando… (${n})`
            : clase === 'formato'
              ? `La IA contestó raro. Reintentando… (${n})`
              : `Google está con alta demanda. Reintentando… (${n})`
        )
      let r, j
      try {
        r = await pedir(`${URL_IA}/models/${m}:generateContent?key=${key}`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: cuerpo
        })
        j = await r.json()
      } catch (e) {
        ult = 'No hay conexión con Google.'
        clase = 'red'
        cod = 'red'
        mod = m
        await espera(1500 * (i + 1))
        continue
      }
      if (!j.error) {
        const c = j.candidates?.[0],
          txt = c?.content?.parts?.[0]?.text
        if (!txt) {
          const bloq = j.promptFeedback?.blockReason
          if (bloq) throw new Error(`Google no aceptó la foto (${bloq}). Probá con otra foto.${detalle(200, m)}`)
          throw new Error('La IA no devolvió resultado. Probá con otra foto.' + detalle(200, m))
        }
        const v = leerJSON(txt)
        if (v !== null && typeof v === 'object') return v
        ult =
          c.finishReason === 'MAX_TOKENS'
            ? 'La respuesta de la IA se cortó antes de terminar.'
            : 'La IA contestó en un formato que no pude leer.'
        clase = 'formato'
        cod = c.finishReason || 'formato'
        mod = m
        await espera(1000 * (i + 1))
        continue
      }
      ult = j.error.message || 'Error de la IA'
      cod = codigoDe(j, r?.status)
      mod = m
      if (retirado(ult)) {
        clase = 'otro'
        break // este modelo no existe: probar el otro
      }
      if (claveMala(ult) || cod === 401 || cod === 403)
        throw new Error('Google no aceptó tu clave de IA. Revisala en Ajustes → «Probar la IA».' + detalle(cod, m))
      if (esCuota(j, r?.status)) {
        clase = 'cuota'
        espSeg = segundosDeEspera(ult) ?? espSeg
        break // no insistir con el mismo modelo: cada intento gasta más cuota
      }
      if (!esSobrecarga(j, r?.status)) throw new Error(ult + detalle(cod, m))
      clase = 'sobrecarga'
      await espera(2000 * (i + 1))
    }
  }
  const d = detalle(cod, mod)
  if (clase === 'cuota')
    throw new Error(
      'Llegaste al límite gratuito de Google (cuota)' +
        (espSeg ? `: probá de nuevo en ${espSeg} segundos` : ': esperá un minuto y, si sigue, hasta mañana') +
        ' o ' +
        alt +
        '.' +
        d
    )
  if (clase === 'sobrecarga')
    throw new Error('Google tiene alta demanda en este momento. Probá de nuevo en unos minutos o ' + alt + '.' + d)
  if (clase === 'red') throw new Error('No hay conexión con Google. Revisá tu internet o ' + alt + '.' + d)
  if (clase === 'formato') throw new Error(ult + ' Probá con otra foto más nítida o ' + alt + '.' + d)
  throw new Error(ult + (retirado(ult) ? ' → Tocá «Probar la IA» en Ajustes para elegir otro modelo.' : '') + d)
}

// Diagnóstico para Ajustes → «Probar la IA». Hace 2 consultas chicas: lista de modelos y un «ok» con el modelo elegido.
// Devuelve {lineas: [texto…], sugeridos: [nombre…]}; nunca lanza.
export async function probarIA({key, modelo, pedir = fetch}) {
  const lineas = [],
    sugeridos = []
  if (!key) return {lineas: ['No cargaste la clave de IA.'], sugeridos}
  try {
    const r = await pedir(`${URL_IA}/models?pageSize=200&key=${key}`),
      j = await r.json()
    if (j.error) {
      lineas.push(
        claveMala(j.error.message) || [400, 401, 403].includes(codigoDe(j, r.status))
          ? '❌ Google no aceptó la clave.'
          : `❌ Lista de modelos: ${j.error.message} [código ${codigoDe(j, r.status)}]`
      )
      return {lineas, sugeridos}
    }
    lineas.push('✅ La clave es válida.')
    for (const x of j.models || []) {
      const nom = String(x.name || '').replace(/^models\//, '')
      if (/flash/i.test(nom) && (x.supportedGenerationMethods || []).includes('generateContent')) sugeridos.push(nom)
    }
    const hay = sugeridos.includes(modelo)
    lineas.push(
      hay
        ? `✅ El modelo «${modelo}» existe.`
        : `⚠️ El modelo «${modelo}» no figura entre los disponibles para tu clave.`
    )
  } catch {
    lineas.push('❌ No hay conexión con Google.')
    return {lineas, sugeridos}
  }
  try {
    const r = await pedir(`${URL_IA}/models/${modelo}:generateContent?key=${key}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({contents: [{parts: [{text: 'Respondé solo con la palabra: ok'}]}]})
      }),
      j = await r.json()
    if (!j.error) lineas.push(`✅ «${modelo}» responde.`)
    else if (esCuota(j, r.status))
      lineas.push(
        `⚠️ «${modelo}» llegó al límite gratuito (cuota)` +
          (segundosDeEspera(j.error.message) ? `: reintentá en ${segundosDeEspera(j.error.message)} s.` : '.') +
          ' Probá con otro modelo de la lista.'
      )
    else if (esSobrecarga(j, r.status)) lineas.push(`⚠️ «${modelo}» está con alta demanda ahora. Probá con otro modelo.`)
    else lineas.push(`❌ «${modelo}»: ${j.error.message} [código ${codigoDe(j, r.status)}]`)
  } catch {
    lineas.push('❌ No hay conexión con Google.')
  }
  return {lineas, sugeridos}
}
