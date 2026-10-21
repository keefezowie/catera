/**
 * The one caption table for every cut, so the Indonesian and English previews stay in step.
 * Text and order follow docs/STORE-PREVIEW-STORYBOARD.md; change both together.
 */
export type Locale = "id" | "en";

export type ShotId = "jelajah" | "paket" | "beli" | "bayar" | "jadwal" | "beranda" | "menuBesok";

export const captions: Record<ShotId, Record<Locale, string>> = {
  jelajah: { id: "Katering harian di dekat Anda", en: "Daily catering near you" },
  paket: { id: "Lihat menu dan jadwalnya", en: "See the menu and schedule" },
  beli: { id: "Pilih porsi dan tanggal mulai", en: "Choose portions and start date" },
  bayar: { id: "Bayar dengan QRIS atau VA", en: "Pay with QRIS or VA" },
  jadwal: { id: "Semua jadwal antar di satu kalender", en: "Every delivery on one calendar" },
  beranda: { id: "Lihat makanan hari ini", en: "See today’s meal" },
  menuBesok: { id: "Menu besok sudah siap", en: "Tomorrow’s menu is ready" },
};

/** Raw screen recordings in public/takes, one per shot (see public/takes/README.md). */
export const takes: Record<ShotId, string> = {
  jelajah: "01-jelajah.mp4",
  paket: "02-paket.mp4",
  beli: "03-beli.mp4",
  bayar: "04-bayar.mp4",
  jadwal: "05-jadwal.mp4",
  beranda: "06-beranda.mp4",
  menuBesok: "07-menu-besok.mp4",
};
