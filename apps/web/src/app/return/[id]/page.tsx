import Link from 'next/link';
import {notFound} from 'next/navigation';

export default async function PaymentReturn({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  return <main className="narrow payment-pending">
    <img src="/assets/wordmark.png" width={190} height={64} alt="Catera" />
    <h1>Kembali ke makananmu.</h1>
    <p>Pembayaran akan diperiksa dengan penyedia pembayaran. Buka Catera untuk melihat status dan jadwal terbaru.</p>
    <a className="button full spaced" href={`catera://payment/${id}`}>Buka aplikasi Catera</a>
    <Link className="button secondary full spaced" href={`/payment/${id}`}>Lanjutkan di web</Link>
    <p className="small muted">Tautan kembali ini tidak menyatakan pembayaran berhasil.</p>
  </main>;
}
