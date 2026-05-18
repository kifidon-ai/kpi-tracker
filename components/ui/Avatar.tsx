'use client'

import type { Rep } from '@/lib/types'

interface AvatarProps {
  rep: Rep | null | undefined
  size?: number
  ring?: boolean
}

export function Avatar({ rep, size = 32, ring = false }: AvatarProps) {
  if (!rep) return null
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${rep.color}, ${rep.color}99)`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#0A0E1A',
        fontWeight: 700,
        fontSize: size * 0.36,
        boxShadow: ring ? `0 0 0 2px #0A0E1A, 0 0 0 4px ${rep.color}` : 'none',
        flexShrink: 0,
      }}
    >
      {rep.initials}
    </div>
  )
}
