"use client";
import { useEffect, useRef, useState } from "react";
import { areaAtPoint, areaCenter, roundCoordinate, type GeoPoint } from "@catera/domain";
import { Button, TextInput } from "./form-controls";

/** Pins need a browser key for the map; without one the form stays as it was before pins. */
export const webMapsKey = () => process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";

type LatLng = { lat(): number; lng(): number };
type GoogleMap = {
  addListener(event: string, handler: () => void): void;
  getCenter(): LatLng | undefined;
  getZoom(): number | undefined;
  panTo(point: GeoPoint): void;
  setZoom(zoom: number): void;
};
type MapsGlobal = { maps: { Map: new (el: HTMLElement, options: Record<string, unknown>) => GoogleMap } };

let loading: Promise<MapsGlobal> | null = null;
function loadMaps(key: string): Promise<MapsGlobal> {
  const ready = () => (window as unknown as { google?: MapsGlobal }).google;
  if (ready()?.maps?.Map) return Promise.resolve(ready()!);
  return (loading ??= new Promise<MapsGlobal>((resolve, reject) => {
    const callback = "__cateraMapsReady";
    (window as unknown as Record<string, () => void>)[callback] = () => resolve(ready()!);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=${callback}&loading=async&language=id&region=ID`;
    script.async = true;
    script.onerror = () => {
      loading = null;
      reject(new Error("MAPS_UNAVAILABLE"));
    };
    document.head.appendChild(script);
  }));
}

/** Zoomed out past this a pin could be a neighbourhood off. */
const MIN_ZOOM = 15;
const newSession = () => crypto.randomUUID();

/**
 * The address form's map: the pin stays in the middle and the map moves under it. Search and "my location" move the map
 * too. It reports each settled point; the form holds the pin and sends it with the rest of the address.
 */
export function AddressPin({
  value,
  area,
  onChange,
  t,
}: {
  value: GeoPoint | null;
  area: string;
  onChange: (point: GeoPoint | null, areaName: string | null) => void;
  t: (id: string, en: string) => string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<GoogleMap | null>(null);
  const report = useRef(onChange);
  report.current = onChange;
  const [first] = useState(() => value ?? areaCenter(area));
  const [near, setNear] = useState(!!value);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<{ id: string; title: string; detail: string }[]>([]);
  const session = useRef(newSession());
  const [point, setPoint] = useState<GeoPoint | null>(value);

  useEffect(() => {
    let live = true;
    loadMaps(webMapsKey())
      .then((google) => {
        if (!live || !box.current) return;
        const created = new google.maps.Map(box.current, {
          center: first,
          zoom: value ? 17 : 13,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          clickableIcons: false,
        });
        map.current = created;
        created.addListener("idle", () => {
          const center = created.getCenter();
          if (!center) return;
          const zoomedIn = (created.getZoom() ?? 0) >= MIN_ZOOM;
          setNear(zoomedIn);
          const settled = { lat: roundCoordinate(center.lat()), lng: roundCoordinate(center.lng()) };
          setPoint(settled);
          report.current(zoomedIn ? settled : null, zoomedIn ? areaAtPoint(settled) : null);
        });
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ query: q, sessionToken: session.current }),
      })
        .then(async (r) => {
          if (!r.ok) throw new Error("PLACES_UNAVAILABLE");
          const { suggestions: found } = (await r.json()) as { suggestions: typeof suggestions };
          setSuggestions(found);
          setNote(found.length ? "" : t("Lokasi tidak ditemukan. Coba kata lain.", "Nothing found. Try other words."));
        })
        .catch(() => {
          if (!controller.signal.aborted) setNote(t("Pencarian belum bisa dipakai. Geser peta atau pakai lokasimu.", "Search isn't available. Move the map or use your location."));
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const moveTo = (to: GeoPoint) => {
    map.current?.panTo(to);
    map.current?.setZoom(17);
  };

  async function pick(id: string, title: string) {
    setSuggestions([]);
    setQuery(title);
    try {
      const r = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: id, sessionToken: session.current }),
      });
      if (!r.ok) throw new Error("PLACES_UNAVAILABLE");
      moveTo(((await r.json()) as { location: GeoPoint }).location);
      setNote("");
    } catch {
      setNote(t("Pencarian belum bisa dipakai. Geser peta atau pakai lokasimu.", "Search isn't available. Move the map or use your location."));
    } finally {
      session.current = newSession();
    }
  }

  const locate = () => {
    if (!navigator.geolocation) return setNote(t("Lokasimu belum terbaca. Cari alamat atau geser peta.", "We couldn't read your location. Search or move the map."));
    navigator.geolocation.getCurrentPosition(
      (here) => moveTo({ lat: here.coords.latitude, lng: here.coords.longitude }),
      () => setNote(t("Izin lokasi mati. Cari alamat atau geser peta.", "Location is off. Search or move the map.")),
    );
  };

  if (failed)
    return <p className="small muted" role="alert">{t("Peta belum bisa dimuat. Muat ulang halaman ini.", "The map couldn't load. Reload this page.")}</p>;
  const pinArea = point && near ? areaAtPoint(point) : null;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ position: "relative" }}>
        <TextInput
          aria-label={t("Cari lokasi", "Search for a place")}
          placeholder={t("Cari jalan, gedung, atau area", "Search a street, building or area")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          style={{ width: "100%", boxSizing: "border-box" }}
        />
        {suggestions.length ? (
          <div style={{ position: "absolute", zIndex: 2, left: 0, right: 0, top: "100%", marginTop: 4, display: "grid", background: "var(--surface, #FFFEFA)", border: "1px solid var(--line, #E2E3D8)", borderRadius: 12, overflow: "hidden" }}>
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => void pick(s.id, s.title)}
                style={{ minHeight: 48, padding: "8px 12px", textAlign: "left", background: "transparent", border: 0, cursor: "pointer" }}
              >
                <strong style={{ display: "block" }}>{s.title}</strong>
                <span className="small muted">{s.detail}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div style={{ position: "relative", height: 240, borderRadius: 12, overflow: "hidden", border: "1px solid var(--line, #E2E3D8)" }}>
        <div ref={box} style={{ position: "absolute", inset: 0 }} data-testid="address-pin-map" />
        <svg aria-hidden="true" width="36" height="45" viewBox="0 0 44 55" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -100%)", pointerEvents: "none" }}>
          <path d="M22 54C22 54 41 35 41 21A19 19 0 1 0 3 21C3 35 22 54 22 54Z" fill="#163D2E" stroke="#FFF7E9" strokeWidth="2" />
          <circle cx="22" cy="21" r="7" fill="#FFF7E9" />
        </svg>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <p className="small" aria-live="polite" style={{ margin: 0, color: near && point && !pinArea ? "var(--danger, #A33024)" : undefined }}>
          {!near
            ? t("Perbesar peta, lalu geser sampai pin tepat di pintu masuk.", "Zoom in, then move the map until the pin sits at the entrance.")
            : pinArea
              ? t(`Titik ini ada di ${pinArea}.`, `This pin is in ${pinArea}.`)
              : t("Titik ini di luar area layanan. Katering di Catera mengantar ke Jakarta, Tangerang Selatan, dan Bandung.", "This pin is outside our service area. Catera's caterers deliver to Jakarta, Tangerang Selatan and Bandung.")}
        </p>
        <Button type="button" variant="secondary" onClick={locate}>
          {t("Pakai lokasi saya", "Use my location")}
        </Button>
      </div>
      {note ? <p className="small muted" role="status" style={{ margin: 0 }}>{note}</p> : null}
    </div>
  );
}
