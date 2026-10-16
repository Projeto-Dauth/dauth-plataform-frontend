import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { E2E_WEB_URL } from '../../../backend/e2e/testEnv.js'
import { BROWSER_STATE } from '../../e2e/support/browser.js'
import { loginAs } from '../../e2e/support/session.js'

// Kit de gravação dos vídeos de demonstração: cursor, legendas, cartões, gravação por cena e
// montagem final (ffmpeg). Cada vídeo = várias cenas (cada cena é uma gravação do navegador).

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const OUT = path.resolve(HERE, '../../demo-output')
const RAW = path.join(OUT, 'raw')
const SIZE = { width: 1280, height: 720 }

/* ── Cursor visível, ondinha de clique e legenda (injetados em toda página) ── */
const overlay = () => {
  const boot = () => {
    if (document.getElementById('__demo-cap')) return
    const style = document.createElement('style')
    style.textContent = '@keyframes __ripple{from{transform:translate(-50%,-50%) scale(.3);opacity:.9}to{transform:translate(-50%,-50%) scale(2.4);opacity:0}}'
    const cap = document.createElement('div')
    cap.id = '__demo-cap'
    cap.style.cssText = 'position:fixed;left:50%;bottom:34px;transform:translateX(-50%);max-width:82%;background:rgba(31,21,16,.9);color:#fff;font:600 26px Inter,system-ui,sans-serif;padding:14px 30px;border-radius:14px;z-index:2147483646;opacity:0;transition:opacity .35s;pointer-events:none;text-align:center;line-height:1.3'
    const cur = document.createElement('div')
    cur.style.cssText = 'position:fixed;left:-50px;top:-50px;width:26px;height:26px;border-radius:50%;background:rgba(201,165,123,.8);border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);transform:translate(-50%,-50%);z-index:2147483647;pointer-events:none'
    document.documentElement.append(style, cap, cur)
    // O ambiente de teste não tem WhatsApp: esconde o selo "WhatsApp desconectado"
    setInterval(() => {
      document.querySelectorAll('button,span,div,p').forEach((el) => {
        if (el.textContent.trim() === 'WhatsApp desconectado' && el.parentElement?.textContent.trim() !== 'WhatsApp desconectado') el.style.display = 'none'
      })
    }, 300)
    document.addEventListener('mousemove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px' }, true)
    document.addEventListener('mousedown', (e) => {
      const r = document.createElement('div')
      r.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;width:44px;height:44px;border-radius:50%;border:3px solid #c9a57b;z-index:2147483647;pointer-events:none;animation:__ripple .6s ease-out forwards`
      document.documentElement.append(r)
      setTimeout(() => r.remove(), 700)
    }, true)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
}

export const pause = (page, ms) => page.waitForTimeout(ms)

// Legendas: por padrão NÃO ficam gravadas no vídeo — cada `say` vira uma fala com horário e sai em
// demo-output/legendas/<slug>.srt (+ .txt só com o texto). Para o vídeo com a legenda na tela
// (formato antigo): DEMO_BURN_CAPTIONS=1.
const BURN = process.env.DEMO_BURN_CAPTIONS === '1'
const sceneCues = new WeakMap() // page → { cues: [{ at, text, ms }] }

// A fala roda JUNTO com a ação que descreve: `say` não espera o fim da fala, só o fim da fala
// ANTERIOR (para duas falas nunca se sobreporem). A duração vem do tamanho do texto (~13 caracteres
// por segundo de fala), então a ação segue o ritmo de quem narra e não há pausa morta.
const speechSeconds = (text) => (text ? Math.max(1.8, text.length / 13 + 0.5) : 0)

export async function say(page, text) {
  await page.waitForSelector('#__demo-cap', { state: 'attached' })
  const st = sceneCues.get(page)
  if (st) {
    const wait = st.busyUntil - Date.now()
    if (wait > 0) await pause(page, wait)
    const dur = speechSeconds(text)
    st.cues.push({ at: Date.now(), text, dur })
    st.busyUntil = Date.now() + dur * 1000
  }
  if (BURN) {
    await page.evaluate((t) => {
      const c = document.getElementById('__demo-cap')
      c.textContent = t
      c.style.opacity = t ? '1' : '0'
    }, text)
  }
  if (!st) await pause(page, 2600)
}

const srtTime = (s) => {
  const t = Math.max(0, Math.round(s * 1000))
  const p = (n, w = 2) => String(n).padStart(w, '0')
  return `${p(Math.floor(t / 3600000))}:${p(Math.floor(t / 60000) % 60)}:${p(Math.floor(t / 1000) % 60)},${p(t % 1000, 3)}`
}

// Cartão de título/encerramento em tela cheia. Devolve o instante em que apareceu.
export async function card(page, title, sub, ms = 3000, onShown) {
  await page.waitForSelector('#__demo-cap', { state: 'attached' })
  await page.evaluate(([t, s]) => {
    const d = document.createElement('div')
    d.id = '__demo-card'
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483645;background:radial-gradient(circle at 75% 30%,#4a2c1d 0%,#1f1510 65%);color:#f6f0e8;font-family:Inter,system-ui,sans-serif;display:flex;flex-direction:column;justify-content:center;padding:0 120px;gap:18px;transition:opacity .5s'
    d.innerHTML = `<div style="font-size:26px;font-weight:700;letter-spacing:8px;color:#c9a57b">DAUTH</div><div style="font-size:64px;font-weight:800;line-height:1.08;max-width:980px">${t}</div><div style="font-size:30px;color:#d9cbbe">${s}</div>`
    document.documentElement.append(d)
  }, [title, sub])
  const shownAt = Date.now()
  onShown?.(shownAt) // marca o início útil da gravação (antes é a página carregando, em branco)
  await pause(page, ms)
  return shownAt
}
export async function hideCard(page) {
  await page.evaluate(() => {
    const d = document.getElementById('__demo-card')
    if (d) { d.style.opacity = '0'; setTimeout(() => d.remove(), 600) }
  })
  await pause(page, 700)
}

// ── Movimento humano: o cursor desliza com aceleração e desaceleração suaves (o tempo cresce com a
// distância) e cada ação tem uma pausa antes e depois, como alguém olhando a tela.
const mousePos = new WeakMap()
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

async function moveSmooth(page, x, y) {
  const from = mousePos.get(page) ?? { x: 640, y: 360 }
  const dist = Math.hypot(x - from.x, y - from.y)
  const frames = Math.max(24, Math.min(70, Math.round(dist / 9)))
  for (let i = 1; i <= frames; i++) {
    const k = ease(i / frames)
    await page.mouse.move(from.x + (x - from.x) * k, from.y + (y - from.y) * k)
    await page.waitForTimeout(16) // ~1 quadro de vídeo por passo
  }
  mousePos.set(page, { x, y })
}

// Rolagem suave até o elemento (em vez de pular)
async function scrollTo(page, locator) {
  await locator.scrollIntoViewIfNeeded()
  await pause(page, 350)
}

export async function glide(page, locator) {
  await scrollTo(page, locator)
  const b = await locator.boundingBox()
  // pequeno desvio do centro, para não parecer robô
  await moveSmooth(page, b.x + b.width / 2 + Math.min(10, b.width / 6), b.y + b.height / 2)
  await pause(page, 450)
}
export async function tap(page, locator, wait = 1100) {
  await glide(page, locator)
  await locator.click()
  await pause(page, wait)
}
export async function typeSlow(page, locator, text, delay = 120) {
  await glide(page, locator)
  await locator.click()
  await pause(page, 350)
  await locator.pressSequentially(text, { delay })
  await pause(page, 800)
}
// Campo com busca (SearchableSelect) usado como uma pessoa: abre, digita devagar, aponta e escolhe
export async function pickSlow(page, trigger, optionText, search = optionText) {
  await tap(page, trigger, 700)
  const box = trigger.locator('xpath=..')
  await typeSlow(page, box.getByPlaceholder('Buscar…'), search)
  await tap(page, box.locator('li', { hasText: optionText }).first(), 1000)
}
// Seleção em <select> nativo: aponta, abre e escolhe pelo texto
export async function chooseSlow(page, select, label) {
  await glide(page, select)
  await pause(page, 400)
  await select.selectOption({ label })
  await pause(page, 1000)
}
// Campo de formulário pelo rótulo vizinho (os <label> do app não são ligados aos inputs)
export const field = (scope, label) => scope.locator(`xpath=.//label[normalize-space()="${label}"]/following-sibling::*[1]`)
// Painel lateral aberto (drawer)
export const drawer = (page) => page.locator('div.fixed.inset-0').last()
// Vai a uma tela pelo menu lateral (com a URL de reserva, se o link não estiver visível)
export async function goTo(page, linkName, urlPath) {
  const link = page.getByRole('link', { name: linkName, exact: true }).first()
  if (await link.isVisible().catch(() => false)) await tap(page, link, 900)
  else { await page.goto(urlPath); await pause(page, 900) }
}

async function recorded(browser, dir) {
  const context = await browser.newContext({
    baseURL: E2E_WEB_URL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    storageState: BROWSER_STATE,
    viewport: SIZE,
    recordVideo: { dir, size: SIZE },
  })
  await context.addInitScript(overlay)
  const page = await context.newPage()
  return { context, page, startedAt: Date.now() }
}

// Um vídeo = uma sequência de cenas. Cada cena é uma gravação (com login opcional) e a gravação só
// vale a partir do `ready()` (antes é a página carregando, em branco).
export class Recorder {
  constructor(browser, slug) {
    this.browser = browser
    this.slug = slug
    this.clips = []
    fs.mkdirSync(RAW, { recursive: true })
    fs.rmSync(path.join(RAW, slug), { recursive: true, force: true })
  }

  async scene(login, run) {
    const dir = path.join(RAW, this.slug, String(this.clips.length + 1))
    const { context, page, startedAt } = await recorded(this.browser, dir)
    if (login) await loginAs(page, login)
    let readyAt = startedAt
    const state = { cues: [], busyUntil: 0 }
    sceneCues.set(page, state)
    await run(page, { ready: (t) => { readyAt = t ?? Date.now() } })
    const rest = state.busyUntil - Date.now() // deixa a última fala terminar antes de cortar a cena
    if (rest > 0) await pause(page, rest + 300)
    const endedAt = Date.now()
    const video = page.video()
    await context.close()
    const trim = Math.max(0, (readyAt - startedAt) / 1000 - 0.1)
    const file = await video.path()
    // duração real do trecho que entra no vídeo final (medida no arquivo, não estimada pelo relógio)
    const total = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString())
    this.clips.push({ file, trim, cues: state.cues, readyAt, endedAt, length: total - trim })
  }

  // Falas com horário no vídeo final (início da cena = soma das cenas anteriores, já cortadas)
  writeCaptions() {
    const dir = path.join(OUT, 'legendas')
    fs.mkdirSync(dir, { recursive: true })
    const items = []
    let offset = 0
    for (const c of this.clips) {
      const cues = c.cues
      cues.forEach((q, i) => {
        if (!q.text) return
        const start = offset + (q.at - c.readyAt) / 1000 + 0.1
        const next = cues[i + 1]
        const end = Math.min(start + q.dur, next ? offset + (next.at - c.readyAt) / 1000 + 0.1 : Infinity)
        items.push({ start: Math.max(0, start), end, text: q.text })
      })
      offset += c.length
    }
    const srt = items.map((it, i) => `${i + 1}\n${srtTime(it.start)} --> ${srtTime(it.end)}\n${it.text}\n`).join('\n')
    fs.writeFileSync(path.join(dir, `${this.slug}.srt`), srt, 'utf8')
    fs.writeFileSync(path.join(dir, `${this.slug}.txt`), items.map((it) => it.text).join('\n') + '\n', 'utf8')
  }

  // Junta as cenas em OUT/mp4/<slug>.mp4 e OUT/webm/<slug>.webm (uma pasta por formato)
  build() {
    fs.mkdirSync(path.join(OUT, 'mp4'), { recursive: true })
    fs.mkdirSync(path.join(OUT, 'webm'), { recursive: true })
    const mp4 = path.join(OUT, 'mp4', `${this.slug}.mp4`)
    const webm = path.join(OUT, 'webm', `${this.slug}.webm`)
    const inputs = this.clips.flatMap((c) => ['-ss', c.trim.toFixed(2), '-i', c.file])
    const filter = `${this.clips.map((_, i) => `[${i}:v]`).join('')}concat=n=${this.clips.length}:v=1:a=0[v]`
    const run = (args) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args], { stdio: 'inherit' })
    run([...inputs, '-filter_complex', filter, '-map', '[v]', '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4])
    run(['-i', mp4, '-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '8', '-crf', '34', '-b:v', '0', webm])
    fs.rmSync(path.join(RAW, this.slug), { recursive: true, force: true })
    this.writeCaptions()
    return mp4
  }
}
