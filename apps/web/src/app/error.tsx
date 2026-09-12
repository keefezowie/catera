"use client";
import { useEffect, useState } from "react";
import { Button } from "../components/form-controls";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const [english, setEnglish] = useState(false);
  useEffect(() => setEnglish(document.documentElement.lang === "en"), []);
  return (
    <main className="error-page">
      <h1>{english ? "Something did not load." : "Ada yang belum berhasil dimuat."}</h1>
      <p>
        {english
          ? "Your data is still saved. Please try once more."
          : "Data Anda tetap tersimpan. Silakan coba sekali lagi."}
      </p>
      <Button onClick={reset}>{english ? "Try again" : "Coba lagi"}</Button>
    </main>
  );
}
