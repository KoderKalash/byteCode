import { Space_Grotesk, Space_Mono } from "next/font/google"

import "./globals.css"

// Self-hosted at build time by next/font — no runtime CDN dependency.
const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-grotesk",
  display: "swap",
})

const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
  display: "swap",
})

export const metadata = {
  title: "ByteCode — Online Compiler",
  description: "Run Python, C++ and Java in a sandboxed container.",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${grotesk.variable} ${mono.variable} dark`}>
      <body>{children}</body>
    </html>
  )
}
