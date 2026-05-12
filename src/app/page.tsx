'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    router.replace(`/room/${uuidv4()}`)
  }, [router])

  return (
    <div className="flex items-center justify-center h-screen" style={{ background: 'var(--background)' }}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500 mx-auto mb-4" />
        <p style={{ color: 'var(--text-muted)' }}>Creating workspace...</p>
      </div>
    </div>
  )
}
