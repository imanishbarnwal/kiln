import type { Metadata } from 'next'
import { Geist, Geist_Mono, Fraunces } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { Toaster } from '@/components/ui/sonner'

const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

// Fraunces is a variable-axis serif (opsz, SOFT, WONK) that lives in
// the display/display-italic classes in globals.css. It gives Kiln a
// warm editorial voice instead of a generic tech-product sans.
const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  axes: ['SOFT', 'WONK', 'opsz'],
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: 'Kiln · Sovereign AI for Experts',
  description:
    'Mint your fine-tuned AI as an iNFT. Rent it. Sell it. Earn forever.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} dark antialiased`}
    >
      <body className="min-h-dvh relative">
        <Providers>{children}</Providers>
        <div className="kiln-grain" aria-hidden />
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: 'kiln-toast',
            },
          }}
        />
      </body>
    </html>
  )
}
