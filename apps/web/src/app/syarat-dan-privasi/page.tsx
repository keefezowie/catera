import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./terms.css";

/**
 * A labelled placeholder (decision E2): the owner has not supplied the terms or the privacy policy yet, so this page
 * says so and states nothing else. No legal wording, dates or company details are written here. The two sections keep
 * their anchors so the apps (Pengaturan, Hapus akun) can link to `#syarat` and `#privasi` before the real text lands.
 */
const copy = {
  id: {
    title: "Syarat dan privasi",
    notice:
      "Halaman ini masih sementara. Teks resmi syarat penggunaan dan kebijakan privasi Catera belum tersedia dan akan menggantikan halaman ini.",
    terms: "Syarat penggunaan",
    privacy: "Privasi",
    empty: "Belum ada teks.",
    back: "Kembali ke Catera",
  },
  en: {
    title: "Terms and privacy",
    notice:
      "This page is temporary. The official terms of use and privacy policy for Catera are not available yet and will replace this page.",
    terms: "Terms of use",
    privacy: "Privacy",
    empty: "No text yet.",
    back: "Back to Catera",
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const english = (await cookies()).get("catera_locale")?.value === "en";
  return { title: copy[english ? "en" : "id"].title, robots: { index: false } };
}

export default async function TermsPage() {
  const english = (await cookies()).get("catera_locale")?.value === "en";
  const c = copy[english ? "en" : "id"];
  return (
    <main className="terms-page">
      <article className="terms-body">
        <h1>{c.title}</h1>
        <p className="terms-notice">{c.notice}</p>
        <section aria-labelledby="syarat">
          <h2 id="syarat">{c.terms}</h2>
          <p>{c.empty}</p>
        </section>
        <section aria-labelledby="privasi">
          <h2 id="privasi">{c.privacy}</h2>
          <p>{c.empty}</p>
        </section>
        <a href="/" className="terms-back">
          {c.back}
        </a>
      </article>
    </main>
  );
}
