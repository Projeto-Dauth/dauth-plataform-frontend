// Prepara os vídeos do Docs para o bucket: copia demo-output/mp4/*.mp4 e converte as legendas .srt em .vtt
// (formato que o <video> entende) para demo-output/publish/. Depois envie a pasta ao bucket, por exemplo:
//   aws s3 sync demo-output/publish s3://<bucket> --endpoint-url https://<conta>.r2.cloudflarestorage.com
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../demo-output')
const PUBLISH = path.join(OUT, 'publish')
fs.rmSync(PUBLISH, { recursive: true, force: true })
fs.mkdirSync(PUBLISH, { recursive: true })

for (const f of fs.readdirSync(path.join(OUT, 'mp4')).filter((n) => n.endsWith('.mp4'))) {
  const name = path.basename(f, '.mp4')
  fs.copyFileSync(path.join(OUT, 'mp4', f), path.join(PUBLISH, f))
  const srt = path.join(OUT, 'legendas', `${name}.srt`)
  if (fs.existsSync(srt)) {
    const vtt = 'WEBVTT\n\n' + fs.readFileSync(srt, 'utf8').replace(/\r/g, '').replace(/(\d\d:\d\d:\d\d),(\d{3})/g, '$1.$2')
    fs.writeFileSync(path.join(PUBLISH, `${name}.vtt`), vtt)
  }
  console.log('pronto:', name)
}
