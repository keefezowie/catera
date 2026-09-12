"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function NotFound() {
  const [english, setEnglish] = useState(false);
  useEffect(() => setEnglish(document.documentElement.lang === "en"), []);
  return (
    <main className="error-page">
      <h1>{english ? "Page not found." : "Halaman tidak ditemukan."}</h1>
      <p>
        {english
          ? "Let’s get back to finding meals for your day."
          : "Yuk, kembali mencari makanan untuk hari-hari Anda."}
      </p>
      <Link href="/" className="button">
        {english ? "Explore caterers" : "Jelajah katering"}
      </Link>
    </main>
  );
}
