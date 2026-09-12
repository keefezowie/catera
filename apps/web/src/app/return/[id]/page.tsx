import Link from 'next/link';
import {notFound} from 'next/navigation';
import {cookies} from 'next/headers';

export default async function PaymentReturn({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const english=(await cookies()).get('catera_locale')?.value==='en';
  return <main className="narrow payment-pending">
    <img src="/assets/wordmark.png" width={190} height={64} alt="Catera" />
    <h1>{english?'Back to your meals.':'Kembali ke makananmu.'}</h1>
    <p>{english?'Your payment will be checked with the payment provider. Open Catera to see the latest status and schedule.':'Pembayaran akan diperiksa dengan penyedia pembayaran. Buka Catera untuk melihat status dan jadwal terbaru.'}</p>
    <a className="button full spaced" href={`catera://payment/${id}`}>{english?'Open Catera app':'Buka aplikasi Catera'}</a>
    <Link className="button secondary full spaced" href={`/payment/${id}`}>{english?'Continue on web':'Lanjutkan di web'}</Link>
    <p className="small muted">{english?'This return link does not confirm a successful payment.':'Tautan kembali ini tidak menyatakan pembayaran berhasil.'}</p>
  </main>;
}
