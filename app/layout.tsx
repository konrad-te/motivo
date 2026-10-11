import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Motivo — Find a car that fits your life',description:'A thoughtful car advisor grounded in real historical Polish listings. Explore, compare and understand your next car.',icons:{icon:'/motivo.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
