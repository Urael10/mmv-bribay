import test from 'node:test'
import assert from 'node:assert/strict'
import {pedirIA, probarIA, leerJSON, segundosDeEspera, esCuota, esSobrecarga} from '../src/services/ia.js'

const resp = (status, j) => async () => ({status, json: async () => j})
const ok = txt => ({candidates: [{content: {parts: [{text: txt}]}, finishReason: 'STOP'}]})
const base = {modelos: ['a', 'b'], key: 'k', cuerpo: '{}', espera: async () => {}}

test('leerJSON: acepta JSON limpio, con ```json y con texto alrededor; si no hay, null', () => {
  assert.deepEqual(leerJSON('{"a":1}'), {a: 1})
  assert.deepEqual(leerJSON('```json\n{"a":1}\n```'), {a: 1})
  assert.deepEqual(leerJSON('Acá está: {"a":[1,2]} listo'), {a: [1, 2]})
  assert.equal(leerJSON('no hay nada'), null)
  assert.equal(leerJSON('{"a":'), null)
  assert.equal(leerJSON(''), null)
})

test('cuota (429): NO reintenta el mismo modelo, prueba el otro una vez y explica el límite con el código', async () => {
  const llamadas = []
  const pedir = async url => {
    llamadas.push(url)
    return {status: 429, json: async () => ({error: {code: 429, message: 'You exceeded your current quota. Please retry in 34.2s'}})}
  }
  await assert.rejects(pedirIA({...base, pedir}), e => {
    assert.match(e.message, /límite gratuito/)
    assert.match(e.message, /35 segundos/)
    assert.match(e.message, /\[código 429 · b\]/)
    assert.doesNotMatch(e.message, /alta demanda/)
    return true
  })
  assert.equal(llamadas.length, 2, 'una por modelo, no 6')
})

test('cuota en el primer modelo y el segundo responde: devuelve el resultado', async () => {
  const pedir = async url =>
    url.includes('/a:')
      ? {status: 429, json: async () => ({error: {code: 429, message: 'RESOURCE_EXHAUSTED'}})}
      : {status: 200, json: async () => ok('{"bloques":[]}')}
  assert.deepEqual(await pedirIA({...base, pedir}), {bloques: []})
})

test('alta demanda (503) sigue reintentando y el mensaje conserva la alternativa y el código', async () => {
  let n = 0
  const pedir = async () => {
    n++
    return {status: 503, json: async () => ({error: {code: 503, message: 'high demand'}})}
  }
  await assert.rejects(pedirIA({...base, pedir, alt: 'cargá a mano'}), /alta demanda[\s\S]*cargá a mano[\s\S]*\[código 503/)
  assert.equal(n, 6)
})

test('clave inválida: corta enseguida y manda a «Probar la IA»', async () => {
  let n = 0
  const pedir = async () => {
    n++
    return {status: 400, json: async () => ({error: {code: 400, message: 'API key not valid. Please pass a valid API key.'}})}
  }
  await assert.rejects(pedirIA({...base, pedir}), /no aceptó tu clave[\s\S]*Probar la IA/)
  assert.equal(n, 1)
})

test('respuesta con ```json y texto: se lee igual; si es ilegible se reintenta y después se explica', async () => {
  assert.deepEqual(
    await pedirIA({...base, pedir: resp(200, ok('```json\n{"bloques":[{"tipo":"emom"}]}\n```'))}),
    {bloques: [{tipo: 'emom'}]}
  )
  let n = 0
  const pedir = async () => {
    n++
    return {status: 200, json: async () => ({candidates: [{content: {parts: [{text: '{"bloques":[{"ti'}]}, finishReason: 'MAX_TOKENS'}]})}
  }
  await assert.rejects(pedirIA({...base, pedir}), /se cortó[\s\S]*MAX_TOKENS/)
  assert.equal(n, 6)
})

test('foto bloqueada por Google: lo dice con el motivo', async () => {
  await assert.rejects(
    pedirIA({...base, pedir: resp(200, {promptFeedback: {blockReason: 'OTHER'}})}),
    /no aceptó la foto \(OTHER\)/
  )
})

test('modelo retirado en el primero: pasa al segundo sin gastar reintentos', async () => {
  const urls = []
  const pedir = async url => {
    urls.push(url)
    return url.includes('/a:')
      ? {status: 404, json: async () => ({error: {code: 404, message: 'models/a is not found for API version v1beta'}})}
      : {status: 200, json: async () => ok('{"x":1}')}
  }
  assert.deepEqual(await pedirIA({...base, pedir}), {x: 1})
  assert.equal(urls.length, 2)
})

test('clasificadores: cuota vs sobrecarga y segundos de espera', () => {
  assert.equal(esCuota({error: {code: 429}}, 429), true)
  assert.equal(esCuota({error: {message: 'Quota exceeded for metric'}}, 400), true)
  assert.equal(esCuota({error: {code: 503, message: 'overloaded'}}, 503), false)
  assert.equal(esSobrecarga({error: {code: 503}}, 503), true)
  assert.equal(esSobrecarga({error: {code: 429, message: 'quota'}}, 429), false)
  assert.equal(segundosDeEspera('Please retry in 34.2s.'), 35)
  assert.equal(segundosDeEspera('sin dato'), null)
})

test('probarIA: clave buena + modelo que existe y responde; sugiere solo los flash con generateContent', async () => {
  const pedir = async (url, o) =>
    o
      ? {status: 200, json: async () => ok('ok')}
      : {
          status: 200,
          json: async () => ({
            models: [
              {name: 'models/gemini-x-flash', supportedGenerationMethods: ['generateContent']},
              {name: 'models/gemini-x-pro', supportedGenerationMethods: ['generateContent']},
              {name: 'models/embed-flash', supportedGenerationMethods: ['embedContent']}
            ]
          })
        }
  const r = await probarIA({key: 'k', modelo: 'gemini-x-flash', pedir})
  assert.deepEqual(r.sugeridos, ['gemini-x-flash'])
  assert.ok(r.lineas.some(l => /clave es válida/.test(l)))
  assert.ok(r.lineas.some(l => /responde/.test(l)))
})

test('probarIA: clave mala, modelo inexistente, cuota y sin conexión (nunca lanza)', async () => {
  let r = await probarIA({key: 'k', modelo: 'm', pedir: resp(400, {error: {code: 400, message: 'API key not valid'}})})
  assert.match(r.lineas[0], /no aceptó la clave/)
  r = await probarIA({key: '', modelo: 'm'})
  assert.match(r.lineas[0], /No cargaste la clave/)
  r = await probarIA({key: 'k', modelo: 'm', pedir: async () => { throw new Error('x') }})
  assert.match(r.lineas.join(' '), /No hay conexión/)
  const pedir = async (url, o) =>
    o
      ? {status: 429, json: async () => ({error: {code: 429, message: 'quota. retry in 10s'}})}
      : {status: 200, json: async () => ({models: [{name: 'models/otro-flash', supportedGenerationMethods: ['generateContent']}]})}
  r = await probarIA({key: 'k', modelo: 'viejo', pedir})
  assert.ok(r.lineas.some(l => /no figura/.test(l)))
  assert.ok(r.lineas.some(l => /límite gratuito[\s\S]*10 s/.test(l)))
  assert.deepEqual(r.sugeridos, ['otro-flash'])
})
