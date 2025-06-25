import "./globals.css";

export default function RootLayout({children}){
  return (
    <html lang="en" className="dark">
      <head/>
      <body className="bg-white text-black dark:bg-[#0e0e0e] dark:text-white transition-colors">
        {children}
      </body>
    </html>
  )
}