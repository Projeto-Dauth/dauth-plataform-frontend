// Gradientes placeholder idênticos ao hifi
const placeholders = [
  'bg-gradient-to-br from-gold to-brand',
  'bg-gradient-to-br from-[#b7a08a] to-[#5c443a]',
  'bg-gradient-to-br from-[#e1c9a5] to-[#a37548]',
  'bg-gradient-to-br from-[#a89681] to-[#3d2b24]',
  'bg-gradient-to-br from-[#d9b48a] to-[#7a4c31]',
  'bg-gradient-to-br from-[#c2a682] to-[#56392e]',
]

const sizes = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-[72px] h-[72px] text-xl',
}

export default function Avatar({ name = '', index = 0, size = 'md', src, className = '' }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const nameHash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const gradient = placeholders[nameHash % placeholders.length]

  return (
    <div
      className={`rounded-full border border-line inline-flex items-center justify-center
        font-display font-semibold text-white overflow-hidden
        ${sizes[size]} ${src ? '' : gradient} ${className}`}
      style={src ? { backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
    >
      {!src && initials}
    </div>
  )
}
