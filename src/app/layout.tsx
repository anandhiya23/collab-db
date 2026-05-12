import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CollabERD — Collaborative PostgreSQL Schema Designer',
  description: 'Real-time collaborative ERD editor with live PostgreSQL DDL output',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
