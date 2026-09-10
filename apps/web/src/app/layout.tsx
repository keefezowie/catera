import {webVariables} from '@catera/design-tokens';
import type {Metadata} from 'next';
import {cookies} from 'next/headers';
import './globals.css';
export const metadata:Metadata={title:{default:'Catera — Good Food on Repeat',template:'%s · Catera'},description:'Temukan katering harian, atur jadwal makan, dan nikmati makanan yang Anda sukai. Pengantaran termasuk.',manifest:'/manifest.webmanifest',icons:{icon:'/assets/app-icon.png',apple:'/assets/app-icon.png'}};
export default async function RootLayout({children}:{children:React.ReactNode}){const locale=(await cookies()).get('catera_locale')?.value==='en'?'en':'id';return <html style={webVariables as React.CSSProperties} lang={locale} data-scroll-behavior="smooth"><body>{children}</body></html>}
