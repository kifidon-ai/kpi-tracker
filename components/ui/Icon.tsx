'use client'

interface IconProps {
  name: string
  size?: number
  color?: string
  stroke?: number
}

export function Icon({ name, size = 16, color = 'currentColor', stroke = 1.75 }: IconProps) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (name) {
    case 'home':
      return <svg {...props}><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/></svg>
    case 'log':
      return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>
    case 'team':
      return <svg {...props}><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.8-5.5 6-5.5s6 2 6 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M15 20c0-2.5 1.7-4 4-4"/></svg>
    case 'trophy':
      return <svg {...props}><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M5 6H3v2a3 3 0 0 0 3 3"/><path d="M19 6h2v2a3 3 0 0 1-3 3"/><path d="M9 20h6M10 16h4l1 4H9z"/></svg>
    case 'target':
      return <svg {...props}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>
    case 'phone':
      return <svg {...props}><path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 13l5 2v3a2 2 0 0 1-2 2A14 14 0 0 1 3 6a2 2 0 0 1 2-2Z"/></svg>
    case 'chat':
      return <svg {...props}><path d="M21 12a8 8 0 1 1-3-6.2L21 5l-1 4.5A8 8 0 0 1 21 12Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></svg>
    case 'calendar':
      return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>
    case 'present':
      return <svg {...props}><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><path d="m8 13 3-3 2 2 3-4"/></svg>
    case 'check':
      return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>
    case 'voicemail':
      return <svg {...props}><circle cx="6" cy="13" r="3.5"/><circle cx="18" cy="13" r="3.5"/><path d="M6 16h12"/></svg>
    case 'arrow-up':
      return <svg {...props}><path d="m6 14 6-6 6 6"/></svg>
    case 'arrow-down':
      return <svg {...props}><path d="m6 10 6 6 6-6"/></svg>
    case 'flame':
      return <svg {...props}><path d="M12 3s5 4.5 5 9a5 5 0 0 1-10 0c0-2 1-3 1-3s-1 5 2 5 2-5 2-5 2 3 0 6"/></svg>
    case 'plus':
      return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>
    case 'minus':
      return <svg {...props}><path d="M5 12h14"/></svg>
    case 'board':
      return <svg {...props}><rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="16" rx="1"/><rect x="17" y="4" width="4" height="16" rx="1"/></svg>
    case 'x':
      return <svg {...props}><path d="M6 6l12 12M18 6 6 18"/></svg>
    case 'search':
      return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
    case 'sun':
      return <svg {...props}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
    case 'moon':
      return <svg {...props}><path d="M20 14.5A7.5 7.5 0 0 1 9.5 4 6 6 0 1 0 20 14.5Z"/></svg>
    case 'bell':
      return <svg {...props}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
    case 'bell-off':
      return <svg {...props}><path d="M8.56 2.9A6 6 0 0 1 18 8c0 2.8-.7 5-1.6 6.6M6.5 6.5C6.2 7 6 7.5 6 8c0 7-3 9-3 9h12M13.73 21a2 2 0 0 1-3.46 0M2 2l20 20"/></svg>
    case 'volume':
      return <svg {...props}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
    case 'volume-off':
      return <svg {...props}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
    default:
      return null
  }
}
