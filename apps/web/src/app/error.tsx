"use client";
import { Button } from "../components/form-controls";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>Ada yang belum berhasil dimuat.</h1>
      <p>Data Anda tetap tersimpan. Silakan coba sekali lagi.</p>
      <Button onClick={reset}>Coba lagi</Button>
    </main>
  );
}
