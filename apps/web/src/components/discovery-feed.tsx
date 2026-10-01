"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import {
  ArrowDown,
  ArrowUp,
  ArrowRight,
  Check,
  ImageOff,
  Rows3,
  GalleryVerticalEnd,
} from "lucide-react";
import {
  currency,
  mealLabel,
  perMealPrice,
  purchaseCommitment,
  swipeTarget,
  type Offer,
} from "@catera/domain";
import { prefersReducedMotion } from "@/lib/motion";
import { Button } from "./form-controls";
import { FoodImage } from "./food-image";
import { useApp } from "./context";
import { SaveButton } from "./saved-context";

export function PackagePhoto({
  offer,
  priority = false,
}: {
  offer: Pick<Offer, "image" | "name">;
  priority?: boolean;
}) {
  const { t } = useApp();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [offer.image]);
  return failed || !offer.image ? (
    <div
      className="package-photo-missing"
      role="img"
      aria-label={t("Foto paket tidak tersedia", "Package photo unavailable")}
    >
      <ImageOff size={24} aria-hidden="true" />
      <span>{t("Foto tidak tersedia", "Photo unavailable")}</span>
    </div>
  ) : (
    <FoodImage
      src={offer.image}
      alt={offer.name}
      width={724}
      height={543}
      loading={priority ? "eager" : "lazy"}
      sizes="(max-width:560px) 100vw, 400px"
      onError={() => setFailed(true)}
    />
  );
}
export function useDiscoveryView(enabled: boolean) {
  const params = useSearchParams(),
    pathname = usePathname();
  const [mobile, setMobile] = useState(false);
  const [preferred, setPreferred] = useState<"swipe" | "list">("swipe");
  const [fits, setFits] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem("catera-discovery-view") === "list")
        setPreferred("list");
    } catch {}
    const media = matchMedia("(max-width: 560px)");
    const sync = () => {
      setMobile(media.matches);
      setFits(true);
    };
    sync();
    media.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);
  const requested = params.get("view");
  const mode =
    requested === "list" || requested === "swipe" ? requested : preferred;
  function choose(value: "list" | "swipe") {
    setPreferred(value);
    setFits(true);
    try {
      localStorage.setItem("catera-discovery-view", value);
    } catch {}
    const query = new URLSearchParams(location.search);
    query.set("view", value);
    history.replaceState(null, "", pathname + "?" + query + location.hash);
  }
  return {
    mobile: mobile && enabled,
    feed: enabled && mobile && fits && mode === "swipe",
    fallback: enabled && mobile && !fits && mode === "swipe",
    choose,
    cannotFit: () => setFits(false),
  };
}
export function DiscoveryMode({
  feed,
  choose,
}: {
  feed: boolean;
  choose: (mode: "swipe" | "list") => void;
}) {
  const { t } = useApp();
  return (
    <div
      className="discovery-modes"
      role="group"
      aria-label={t("Tampilan paket", "Package view")}
    >
      <Button type="button" aria-pressed={feed} onClick={() => choose("swipe")}>
        <GalleryVerticalEnd size={17} aria-hidden="true" />
        {t("Geser", "Swipe")}
      </Button>
      <Button type="button" aria-pressed={!feed} onClick={() => choose("list")}>
        <Rows3 size={17} aria-hidden="true" />
        {t("Daftar", "List")}
      </Button>
    </div>
  );
}
/** The measured bottom limit includes the real tab bar and comparison tray. */
export function useFeedHeight(
  active: boolean,
  section: RefObject<HTMLElement | null>,
) {
  useLayoutEffect(() => {
    if (!active || !section.current) return;
    const node = section.current,
      before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.scrollTo(0, 0);
    const measure = () => {
      const viewport = window.visualViewport?.height || window.innerHeight;
      let bottom = viewport;
      for (const selector of [".mobile-bottom", ".compare-floating"]) {
        const chrome = document.querySelector<HTMLElement>(selector);
        if (chrome && getComputedStyle(chrome).display !== "none")
          bottom = Math.min(bottom, chrome.getBoundingClientRect().top);
      }
      node.style.height =
        Math.max(0, bottom - node.getBoundingClientRect().top - 8) + "px";
    };
    const observer = new ResizeObserver(measure);
    for (const selector of [
      ".site-header",
      ".demo-ribbon",
      ".mobile-bottom",
      ".compare-floating",
    ])
      document.querySelectorAll(selector).forEach((el) => observer.observe(el));
    const mutations = new MutationObserver(() => {
      document
        .querySelectorAll(".compare-floating")
        .forEach((el) => observer.observe(el));
      measure();
    });
    mutations.observe(document.querySelector(".app-shell") || document.body, {
      childList: true,
      subtree: true,
    });
    measure();
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      mutations.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      document.body.style.overflow = before;
      node.style.height = "";
    };
  }, [active, section]);
}
export function DiscoveryFeed({
  offers,
  cannotFit,
  filtersOpen,
}: {
  offers: Offer[];
  cannotFit: () => void;
  filtersOpen: boolean;
}) {
  const { t, locale, area, compare, toggleCompare } = useApp();
  const params = useSearchParams(),
    pathname = usePathname();
  const [viewport, embla] = useEmblaCarousel({
    axis: "y",
    loop: false,
    align: "start",
    slidesToScroll: 1,
    dragFree: false,
    skipSnaps: false,
    watchDrag: false,
    containScroll: false,
  });
  const root = useRef<HTMLDivElement>(null),
    focus = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    id: number;
    y: number;
    x: number;
    at: number;
    origin: number;
  } | null>(null);
  const [active, setActive] = useState(0);
  const ids = offers.map((offer) => offer.id).join(",");
  const selected = params.get("card");
  const callback = useRef(cannotFit);
  callback.current = cannotFit;
  const choose = useCallback(
    (index: number) => {
      if (!embla) return;
      const next = Math.max(0, Math.min(offers.length - 1, index));
      if (
        focus.current?.contains(document.activeElement) &&
        document.activeElement !== focus.current
      )
        focus.current.focus({ preventScroll: true });
      embla.scrollTo(next, prefersReducedMotion());
    },
    [embla, offers.length],
  );
  useEffect(() => {
    if (!embla) return;
    const changed = () => {
      const index = embla.selectedScrollSnap();
      setActive(index);
      const id = offers[index]?.id;
      if (!id) return;
      const query = new URLSearchParams(location.search);
      if (query.get("card") !== id) {
        query.set("card", id);
        history.replaceState(null, "", pathname + "?" + query + location.hash);
      }
    };
    embla.on("select", changed);
    return () => {
      embla.off("select", changed);
    };
  }, [embla, ids, pathname]);
  useEffect(() => {
    if (!embla) return;
    const index = Math.max(
      0,
      offers.findIndex((offer) => offer.id === selected),
    );
    if (embla.selectedScrollSnap() !== index) embla.scrollTo(index, true);
    setActive(index);
  }, [embla, ids, selected]);
  useLayoutEffect(() => {
    const node = root.current;
    if (!node || filtersOpen) return;
    const measure = () => {
      const essential = node.querySelector<HTMLElement>(
        '[data-active="true"] .discovery-essential',
      );
      const window = node.querySelector<HTMLElement>(".discovery-window");
      if (
        essential &&
        window &&
        essential.scrollHeight + 104 > window.clientHeight
      )
        callback.current();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    const essential = node.querySelector<HTMLElement>(
      '[data-active="true"] .discovery-essential',
    );
    if (essential) observer.observe(essential);
    measure();
    return () => observer.disconnect();
  }, [active, ids, locale, filtersOpen]);
  useEffect(() => {
    const node = focus.current;
    if (!node || !embla) return;
    let lockedUntil = 0;
    const wheel = (event: WheelEvent) => {
      if (
        event.ctrlKey ||
        filtersOpen ||
        Math.abs(event.deltaY) < 8 ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
      )
        return;
      event.preventDefault();
      if (performance.now() < lockedUntil) return;
      lockedUntil = performance.now() + 500;
      choose(embla.selectedScrollSnap() + Math.sign(event.deltaY));
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, [embla, choose, filtersOpen]);
  function finish(event: React.PointerEvent, cancelled = false) {
    const start = gesture.current;
    gesture.current = null;
    if (focus.current) focus.current.style.translate = "0 0";
    if (!start || start.id !== event.pointerId || cancelled || !embla) return;
    const distance = start.y - event.clientY;
    if (Math.abs(distance) < Math.abs(start.x - event.clientX)) return;
    choose(
      swipeTarget(
        start.origin,
        offers.length,
        distance,
        distance / Math.max(1, performance.now() - start.at),
      ),
    );
  }
  const currentReturn =
    pathname + (params.size ? "?" + params.toString() : "") + "#packages";
  return (
    <div className="discovery-feed" ref={root} inert={filtersOpen}>
      <div className="discovery-window">
        <div
          className="discovery-viewport"
          ref={(node) => {
            viewport(node);
            focus.current = node;
          }}
          role="region"
          aria-roledescription={t("daftar kartu", "card carousel")}
          aria-label={t("Jelajah paket", "Browse packages")}
          tabIndex={0}
          onKeyDown={(event) => {
            if (
              (event.target as HTMLElement).closest(
                "input,select,textarea,button,a",
              )
            )
              return;
            if (
              ["ArrowDown", "PageDown", "ArrowUp", "PageUp"].includes(event.key)
            ) {
              event.preventDefault();
              choose(
                active +
                  (["ArrowDown", "PageDown"].includes(event.key) ? 1 : -1),
              );
            }
          }}
          onPointerDown={(event) => {
            if (
              !event.isPrimary ||
              event.button !== 0 ||
              (event.target as HTMLElement).closest(
                "button,a,input,select,textarea",
              )
            )
              return;
            gesture.current = {
              id: event.pointerId,
              y: event.clientY,
              x: event.clientX,
              at: performance.now(),
              origin: active,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (
              gesture.current?.id === event.pointerId &&
              !prefersReducedMotion()
            )
              event.currentTarget.style.translate =
                "0 " +
                Math.max(-80, Math.min(80, event.clientY - gesture.current.y)) +
                "px";
          }}
          onPointerUp={(event) => finish(event)}
          onPointerCancel={(event) => finish(event, true)}
        >
          <div className="discovery-track">
            {offers.map((offer, index) => {
              const commitment = purchaseCommitment({
                offer,
                addressCovered: area ? offer.areas.includes(area) : null,
              });
              const compared = compare.includes(offer.id);
              return (
                <article
                  className="discovery-slide"
                  key={offer.id}
                  data-package-id={offer.id}
                  data-active={index === active}
                  aria-hidden={index !== active}
                  inert={index !== active}
                  aria-label={t(
                    `Paket ${index + 1} dari ${offers.length}`,
                    `Package ${index + 1} of ${offers.length}`,
                  )}
                >
                  <div className="discovery-photo">
                    <PackagePhoto
                      offer={offer}
                      priority={index <= active + 1 && index >= active - 1}
                    />
                  </div>
                  <div className="discovery-essential">
                    <div className="discovery-identity">
                      <p>{offer.caterer}</p>
                      <h2>{offer.name}</h2>
                    </div>
                    <p className="discovery-commitment">
                      <strong>
                        {offer.days} {t("hari pengantaran", "delivery days")}
                      </strong>
                      <span>
                        {mealLabel(offer.meal, locale)} ·{" "}
                        {offer.flexible
                          ? t("Fleksibel", "Flexible")
                          : t("Jadwal tetap", "Fixed schedule")}
                      </span>
                    </p>
                    <div className="discovery-price">
                      <strong>
                        {currency(commitment.packagePrice, locale)}
                      </strong>
                      <span className="discovery-price-context">
                        <span>
                          {t("Paket / 1 porsi", "Package / 1 portion")}
                        </span>
                        <span className="discovery-per-meal">
                          {currency(perMealPrice(offer), locale)}{" "}
                          {t("/ sekali makan", "/ meal")}
                        </span>
                      </span>
                    </div>
                    <p className="discovery-fees">
                      {t(
                        "Pengantaran termasuk. Biaya layanan saat checkout.",
                        "Delivery included. Service fee at checkout.",
                      )}
                    </p>
                    <p
                      className={
                        "discovery-coverage " + commitment.addressEligibility
                      }
                    >
                      {area
                        ? offer.areas.includes(area)
                          ? t(`Mengantar ke ${area}`, `Delivers to ${area}`)
                          : t(
                              "Di luar area pengantaran",
                              "Outside delivery area",
                            )
                        : t(
                            "Pilih area untuk memeriksa jangkauan.",
                            "Choose an area to check delivery coverage.",
                          )}
                    </p>
                    <div className="discovery-actions">
                      <SaveButton packageId={offer.id} name={offer.name} />
                      <Button
                        variant="secondary"
                        aria-pressed={compared}
                        aria-label={t("Bandingkan: ", "Compare: ") + offer.name}
                        onClick={() => toggleCompare(offer.id)}
                      >
                        {compared && <Check size={16} aria-hidden="true" />}
                        {t("Bandingkan", "Compare")}
                      </Button>
                      <Link
                        className="button"
                        href={
                          "/packages/" +
                          offer.slug +
                          "?next=" +
                          encodeURIComponent(currentReturn)
                        }
                      >
                        {t("Lihat paket", "View package")}
                        <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
      <div className="discovery-navigation">
        <Button
          variant="icon"
          disabled={active === 0}
          aria-label={t("Paket sebelumnya", "Previous package")}
          onClick={() => choose(active - 1)}
        >
          <ArrowUp size={20} />
        </Button>
        <span role="status" aria-live="polite" aria-atomic="true">
          <span className="sr-only">{offers[active]?.name}. </span>
          {active + 1} / {offers.length}
          {active === offers.length - 1
            ? t(" · Paket terakhir", " · Last package")
            : t(" · Geser ke atas", " · Swipe up")}
        </span>
        <Button
          variant="icon"
          disabled={active === offers.length - 1}
          aria-label={t("Paket berikutnya", "Next package")}
          onClick={() => choose(active + 1)}
        >
          <ArrowDown size={20} />
        </Button>
      </div>
    </div>
  );
}
