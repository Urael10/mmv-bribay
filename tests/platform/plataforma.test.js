// Entrega 37 (v0.38.0) · src/platform/plataforma.js: dónde corre la app (navegador/PWA o APK) y cuándo se permite el service worker.
// Se prueba inyectando un «Capacitor» de mentira: no hace falta un contenedor real ni módulos simulados.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  crearPlataforma, esNativo, plataforma, esAndroid, permiteServiceWorker
} from '../../src/platform/plataforma.js'

const capWeb = {isNativePlatform: () => false, getPlatform: () => 'web'}
const capAndroid = {isNativePlatform: () => true, getPlatform: () => 'android'}
const capIos = {isNativePlatform: () => true, getPlatform: () => 'ios'}
const navConSw = {serviceWorker: {}}
const navSinSw = {}

test('navegador / PWA: no es nativo, la plataforma es web y no es Android', () => {
  const p = crearPlataforma(capWeb)
  assert.equal(p.esNativo(), false)
  assert.equal(p.plataforma(), 'web')
  assert.equal(p.esAndroid(), false)
})

test('APK: es nativo y la plataforma es android', () => {
  const p = crearPlataforma(capAndroid)
  assert.equal(p.esNativo(), true)
  assert.equal(p.plataforma(), 'android')
  assert.equal(p.esAndroid(), true)
})

test('iOS: es nativo pero no es Android', () => {
  const p = crearPlataforma(capIos)
  assert.equal(p.esNativo(), true)
  assert.equal(p.plataforma(), 'ios')
  assert.equal(p.esAndroid(), false)
})

test('el service worker se permite en el navegador que lo soporta (la PWA sigue igual)', () => {
  assert.equal(crearPlataforma(capWeb).permiteServiceWorker(navConSw), true)
})

test('dentro del APK nunca se registra el service worker, aunque el WebView lo soporte', () => {
  assert.equal(crearPlataforma(capAndroid).permiteServiceWorker(navConSw), false)
  assert.equal(crearPlataforma(capIos).permiteServiceWorker(navConSw), false)
})

test('sin navigator o sin serviceWorker en el navegador no se intenta registrar', () => {
  const p = crearPlataforma(capWeb)
  assert.equal(p.permiteServiceWorker(navSinSw), false)
  assert.equal(p.permiteServiceWorker(null), false)
  assert.equal(p.permiteServiceWorker(undefined), p.permiteServiceWorker(globalThis.navigator))
})

test('si Capacitor falta, no trae los métodos o lanza un error, se asume navegador', () => {
  const rotos = [
    undefined,
    null,
    {},
    {isNativePlatform: 'no soy función', getPlatform: 42},
    {
      isNativePlatform: () => {
        throw new Error('boom')
      },
      getPlatform: () => {
        throw new Error('boom')
      }
    }
  ]
  for (const cap of rotos) {
    // `undefined` activa el valor por defecto (el Capacitor real); lo que importa es que nunca lance y no dé «nativo»
    const p = crearPlataforma(cap === undefined ? null : cap)
    assert.equal(p.esNativo(), false, String(cap))
    assert.equal(p.plataforma(), 'web', String(cap))
    assert.equal(p.esAndroid(), false, String(cap))
    assert.equal(p.permiteServiceWorker(navConSw), true, String(cap))
  }
})

test('solo «true» exacto cuenta como nativo (un valor «verdadero» cualquiera no alcanza)', () => {
  assert.equal(crearPlataforma({isNativePlatform: () => 1, getPlatform: () => 'web'}).esNativo(), false)
  assert.equal(crearPlataforma({isNativePlatform: () => 'true', getPlatform: () => 'web'}).esNativo(), false)
})

test('una plataforma desconocida se trata como web y el nombre se normaliza', () => {
  assert.equal(crearPlataforma({getPlatform: () => 'electron'}).plataforma(), 'web')
  assert.equal(crearPlataforma({getPlatform: () => ''}).plataforma(), 'web')
  assert.equal(crearPlataforma({getPlatform: () => 'Android'}).plataforma(), 'android')
  assert.equal(crearPlataforma({getPlatform: () => 'IOS'}).plataforma(), 'ios')
})

test('se consulta en cada llamada: no queda fijado al importar el módulo', () => {
  const cap = {nativo: false, isNativePlatform: () => cap.nativo, getPlatform: () => (cap.nativo ? 'android' : 'web')}
  const p = crearPlataforma(cap)
  assert.equal(p.esNativo(), false)
  cap.nativo = true
  assert.equal(p.esNativo(), true)
  assert.equal(p.permiteServiceWorker(navConSw), false)
  cap.nativo = false
  assert.equal(p.permiteServiceWorker(navConSw), true)
})

test('los exports por defecto usan el Capacitor real: en Node (sin WebView) es web', () => {
  assert.equal(esNativo(), false)
  assert.equal(plataforma(), 'web')
  assert.equal(esAndroid(), false)
  // Node no tiene service worker: el valor por defecto de `nav` es el navigator real y da false
  assert.equal(permiteServiceWorker(), false)
  assert.equal(permiteServiceWorker(navConSw), true)
})
