"use client";
import { useEffect, useState } from "react";
import { Button } from "../components/form-controls";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const [english, setEnglish] = useState(false);
  useEffect(() => setEnglish(document.documentElement.lang === "en"), []);
  return (
    <main className="error-page">
      <h1>{english ? "Something didn't load." : "Ada yang belum bisa dimuat."}</h1>
      <p>
        {english
          ? "Your data is still saved. Try again."
          : "Datamu tetap tersimpan. Coba lagi."}
      </p>
      <Button variant="primary" onClick={reset}>
        {english ? "Try again" : "Coba lagi"}
      </Button>
    </main>
  );
}
