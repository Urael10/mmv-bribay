// Llamada a Gemini con reintentos automáticos y modelo de respaldo.
const temporal = (j, st) =>
  [429, 500, 502, 503, 504].includes(j?.error?.code || st) ||
  /high demand|overloaded|unavailable|try again|resource.?exhausted/i.test(j?.error?.message || '')
const retirado = m => /no longer|not found|deprecat/i.test(m || '')
const demora = ms => new Promise(r => setTimeout(r, ms))

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
  const lista = [...new Set(modelos)]
  let ult = '',
    n = 0
  for (let k = 0; k < lista.length; k++) {
    const m = lista[k]
    for (let i = 0; i < intentos; i++) {
      if (n++) prog(`Google está con alta demanda. Reintentando… (${n}/${lista.length * intentos})`)
      let r, j
      try {
        r = await pedir(
          `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`,
          {method: 'POST', headers: {'Content-Type': 'application/json'}, body: cuerpo}
        )
        j = await r.json()
      } catch (e) {
        ult = 'No hay conexión con Google.'
        await espera(1500 * (i + 1))
        continue
      }
      if (!j.error) {
        if (!j.candidates?.[0]?.content?.parts?.[0]?.text)
          throw new Error('La IA no devolvió resultado. Probá con otra foto.')
        return JSON.parse(j.candidates[0].content.parts[0].text)
      }
      ult = j.error.message || 'Error de la IA'
      if (retirado(ult)) break
      if (!temporal(j, r.status)) throw new Error(ult)
      await espera(2000 * (i + 1))
    }
  }
  throw new Error(
    /high demand|overloaded|unavailable|try again/i.test(ult)
      ? 'Google tiene alta demanda en este momento. Probá de nuevo en unos minutos o ' + alt + '.'
      : ult + (retirado(ult) ? ' → Probá otro modelo en Ajustes.' : '')
  )
}
