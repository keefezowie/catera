"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ArrowLeft, ArrowRight, ArrowUpRight, Pause, Play } from "lucide-react";
import type { Offer } from "@catera/domain";
import { useApp } from "./context";
import { Button } from "./form-controls";
import { HeroIntroduction } from "./hero-introduction";
import { featuredOffers } from "../lib/featured-offers";

export function FeaturedHero() {
  const { offers, area } = useApp();
  const featured = featuredOffers(offers, area);

  return (
    <div className="featured-hero-wrapper">
      {featured.length ? (
        <CatererCarousel
          key={area + featured.map((offer) => offer.id).join(",")}
          offers={featured}
        />
      ) : (
        <HeroIntroduction />
      )}
    </div>
  );
}

function CatererCarousel({ offers }: { offers: Offer[] }) {
  const { t } = useApp();
  const multiple = offers.length > 1;
  const [autoplay] = useState(() =>
    Autoplay({
      delay: 6000,
      playOnInit: false,
      stopOnInteraction: true,
      stopOnFocusIn: false,
    }),
  );
  const [viewport, embla] = useEmblaCarousel(
    { loop: multiple, duration: 35, watchDrag: multiple },
    [autoplay],
  );
  const root = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const requestedPause = useRef(false);
  const pointerPauseIntent = useRef(false);
  const syncPlayback = useRef(() => {});
  const stop = useCallback(() => {
    requestedPause.current = true;
    setPaused(true);
    autoplay.stop();
  }, [autoplay]);

  useEffect(() => {
    if (!embla || !root.current) return;
    const element = root.current;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let hovered = element.matches(":hover");
    const sync = () => {
      if (
        multiple &&
        visible &&
        !hovered &&
        !document.hidden &&
        !media.matches &&
        !requestedPause.current
      )
        autoplay.play();
      else autoplay.stop();
    };
    syncPlayback.current = sync;
    const motion = () => {
      setReducedMotion(media.matches);
      sync();
    };
    const enter = () => {
      hovered = true;
      sync();
    };
    const leave = () => {
      hovered = false;
      sync();
    };
    const select = () => setSelected(embla.selectedScrollSnap());
    const reinit = () => {
      select();
      sync();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { threshold: 0 },
    );
    observer.observe(element);
    motion();
    select();
    media.addEventListener("change", motion);
    document.addEventListener("visibilitychange", sync);
    element.addEventListener("mouseenter", enter);
    element.addEventListener("mouseleave", leave);
    element.addEventListener("focusin", stop);
    embla.on("select", select).on("reInit", reinit).on("pointerDown", stop);
    return () => {
      syncPlayback.current = () => {};
      observer.disconnect();
      media.removeEventListener("change", motion);
      document.removeEventListener("visibilitychange", sync);
      element.removeEventListener("mouseenter", enter);
      element.removeEventListener("mouseleave", leave);
      element.removeEventListener("focusin", stop);
      embla
        .off("select", select)
        .off("reInit", reinit)
        .off("pointerDown", stop);
      autoplay.stop();
    };
  }, [embla, autoplay, multiple, stop]);

  const navigate = (index: number) => {
    stop();
    embla?.scrollTo(index, reducedMotion);
  };
  return (
    <section
      ref={root}
      className="featured-hero"
      aria-label={t("Katerer pilihan", "Featured caterers")}
      aria-roledescription={multiple ? "carousel" : undefined}
    >
      <div className="featured-viewport" ref={viewport}>
        <div
          className="featured-track"
          aria-live={paused || reducedMotion ? "polite" : "off"}
        >
          {offers.map((offer, index) => (
            <div
              key={offer.id}
              className="market-hero featured-slide"
              role="group"
              aria-roledescription={t("slide", "slide")}
              aria-label={`${index + 1} / ${offers.length}`}
              inert={index !== selected}
              aria-hidden={index !== selected}
            >
              <div className="hero-copy">
                <span className="featured-label">
                  {t("Katerer pilihan", "Featured caterer")}
                </span>
                {index === 0 ? (
                  <h1>{offer.caterer}</h1>
                ) : (
                  <h2>{offer.caterer}</h2>
                )}
                <p>{offer.name}</p>
                <Link className="button cream" href={"/packages/" + offer.slug}>
                  {t("Lihat paket", "View package")}
                  <ArrowUpRight size={19} />
                </Link>
              </div>
              <div className="hero-food">
                <img
                  src={offer.image}
                  alt={offer.name}
                  width="724"
                  height="543"
                  fetchPriority={index === 0 ? "high" : "auto"}
                  loading={index === 0 ? "eager" : "lazy"}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      {multiple && (
        <div className="featured-controls">
          <Button
            type="button"
            onClick={() =>
              navigate((selected - 1 + offers.length) % offers.length)
            }
            aria-label={t("Katerer sebelumnya", "Previous caterer")}
          >
            <ArrowLeft size={18} />
          </Button>
          <div className="featured-dots">
            {offers.map((offer, index) => (
              <Button
                type="button"
                key={offer.id}
                aria-label={t("Tampilkan ", "Show ") + offer.caterer}
                aria-current={index === selected ? "true" : undefined}
                onClick={() => navigate(index)}
              >
                <span />
              </Button>
            ))}
          </div>
          <Button
            type="button"
            onClick={() => navigate((selected + 1) % offers.length)}
            aria-label={t("Katerer berikutnya", "Next caterer")}
          >
            <ArrowRight size={18} />
          </Button>
          {!reducedMotion && (
            <Button
              type="button"
              className="featured-playback"
              aria-label={
                paused
                  ? t("Putar otomatis", "Play slideshow")
                  : t("Jeda tayangan", "Pause slideshow")
              }
              onPointerDown={() => {
                pointerPauseIntent.current = !requestedPause.current;
              }}
              onClick={(event) => {
                requestedPause.current = event.detail
                  ? pointerPauseIntent.current
                  : !requestedPause.current;
                setPaused(requestedPause.current);
                syncPlayback.current();
              }}
            >
              {paused ? <Play size={16} /> : <Pause size={16} />}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
