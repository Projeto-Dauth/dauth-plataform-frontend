// Acesso ao banco de TESTE (nunca o de dev) pelo mesmo cliente Prisma do backend.
// Só para o que o teste não tem como ver pela tela — ex: o link que iria por WhatsApp/email.
import { E2E_DATABASE_URL } from '../../../backend/e2e/testEnv.js'

process.env.DATABASE_URL = E2E_DATABASE_URL // antes do import: o cliente lê a URL ao ser criado
const { default: prisma } = await import('../../../backend/src/config/prisma.js')

export default prisma
