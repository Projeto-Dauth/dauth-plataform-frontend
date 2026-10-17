import fs from 'node:fs'
import { test } from '@playwright/test'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from '../../e2e/support/session.js'
import { Recorder, OUT } from './kit.js'
import { ensureDemoData } from './dados.js'

// Vídeo curto (até 30 s) de um tópico do Docs: uma cena só, legenda gravada no vídeo.
// `open` leva à tela e espera ela carregar (a gravação só vale depois disso); `run` é o roteiro.
// O arquivo sai em demo-output/mp4/<role>-<slug>.mp4 (o nome que o videos.json aponta).
export const MAX_SECONDS = 30

export function docVideo({ role = 'admin', slug, title, prepare, open, run }) {
  test(`${role} · ${title}`, async ({ browser, page }) => {
    await loginAs(page, SEED_USERS.owner)
    const data = await ensureDemoData(page)
    const rec = new Recorder(browser, `${role}-${slug}`)
    const user = role === 'admin' ? SEED_USERS.owner : SEED_USERS.profissional
    // `prepare` monta um salão só do vídeo quando os dados do salão de exemplo atrapalham (ex.: convites)
    const own = prepare ? await prepare(page) : null
    const salonSlug = own?.slug ?? SEED_SALON_SLUG
    const ctx = { base: `/${salonSlug}/${role}`, slug: salonSlug, ...data, ...own }

    await rec.scene(user, async (p, { ready }) => {
      await open(p, ctx)
      ready() // a gravação passa a valer daqui: o sistema já está na tela
      await run(p, ctx)
    })

    const seconds = rec.clips.reduce((sum, c) => sum + c.length, 0)
    rec.build()
    fs.mkdirSync(OUT, { recursive: true })
    fs.appendFileSync(`${OUT}/duracoes.txt`, `${role}-${slug}	${seconds.toFixed(1)}s
`)
    if (seconds > MAX_SECONDS + 2) throw new Error(`${role}-${slug} ficou com ${seconds.toFixed(1)}s (máximo ${MAX_SECONDS}s)`)
  })
}
