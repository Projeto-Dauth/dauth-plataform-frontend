import { Children } from 'react'

// Cartão de seção das telas de configuração: título em destaque, descrição opcional e cada item
// separado por espaço + linha fina. Usado em Configurações (todas as abas) e no painel do Plano.
export const sectionStyle = { background: 'rgb(var(--surface))', borderRadius: 14, border: '1px solid rgb(var(--line))', padding: '24px 24px 20px', boxShadow: '0 2px 12px rgb(var(--ink) / 0.05)' }

export default function Section({ title, description, children }) {
  return (
    <section style={sectionStyle}>
      <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgb(var(--brand))', margin: description ? '0 0 6px' : '0 0 18px' }}>
        {title}
      </h2>
      {description && <p style={{ fontSize: 13, color: 'rgb(var(--ink-3))', marginBottom: 18 }}>{description}</p>}
      {/* Cada item separado por espaço + linha fina */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {Children.toArray(children).filter(Boolean).map((child, i, items) => (
          <div key={i} style={{
            paddingTop: i === 0 ? 0 : 20,
            paddingBottom: i === items.length - 1 ? 0 : 20,
            borderTop: i === 0 ? 'none' : '1px solid rgb(var(--line-2))',
          }}>
            {child}
          </div>
        ))}
      </div>
    </section>
  )
}
