import usePrivacyStore from '@/store/privacyStore'

export default function MoneyValue({ children, className = '' }) {
  const hidden = usePrivacyStore((s) => s.hidden)

  if (hidden) {
    return <span className={`privacy-mask ${className}`} aria-hidden="true">••••••</span>
  }

  return <span className={className}>{children}</span>
}
