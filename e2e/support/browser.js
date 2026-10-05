import { E2E_WEB_URL } from '../../../backend/e2e/testEnv.js'
import { TOUR_KEYS } from '../../src/config/tours.js'

// Navegador de quem já aceitou o aviso de cookies (CookieBanner) e já viu os tours de primeiro
// acesso (Shepherd): os dois ficam por cima dos botões e não são assunto de nenhum teste.
export const BROWSER_STATE = {
  cookies: [],
  origins: [{
    origin: E2E_WEB_URL,
    localStorage: [
      { name: 'dauth_cookies_accepted', value: 'e2e' },
      ...Object.values(TOUR_KEYS).map(name => ({ name, value: 'done' })),
    ],
  }],
}

// Segundo usuário no mesmo teste (ex: Admin e profissional). `browser.newContext()` não herda o
// `use` do playwright.config, então repassa o essencial aqui.
export async function newUserPage(browser) {
  const context = await browser.newContext({
    baseURL: E2E_WEB_URL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    storageState: BROWSER_STATE,
  })
  return context.newPage()
}
