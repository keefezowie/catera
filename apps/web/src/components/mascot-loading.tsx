"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { mascotMotion as motion } from "../../../../packages/brand/motion";
import "./mascot-loading.css";

const layers = ["body", "half", "closed", "sparkles"] as const;

export function MascotAnimation({
  size = motion.size,
  active = true,
}: {
  size?: number;
  active?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [foreground, setForeground] = useState(true);
  useEffect(() => {
    // Cached images may finish before React hydrates and attaches onLoad.
    const cached = new Set<string>();
    root.current
      ?.querySelectorAll<HTMLImageElement>(".mascot-layer")
      .forEach((img) => {
        if (img.complete && img.naturalWidth > 0)
          cached.add(img.src.split("/").pop()!.replace(".png", ""));
      });
    setLoaded((old) => new Set([...old, ...cached]));
    const update = () => setForeground(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    );
    if (root.current) observer.observe(root.current);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const ready = loaded.size === layers.length && !failed;
  return (
    <div
      ref={root}
      className="mascot-animation"
      aria-hidden="true"
      data-ready={ready}
      data-active={active && visible && foreground}
      style={
        {
          width: size,
          height: size,
          "--mascot-duration": `${motion.duration}ms`,
          "--mascot-rise": `${(-motion.rise * size) / motion.size}px`,
          "--mascot-tilt": `${motion.tilt}deg`,
        } as CSSProperties
      }
    >
      <img
        className="mascot-poster"
        src="/assets/mascot-motion/neutral.png"
        alt=""
        width={size}
        height={size}
      />
      <div className="mascot-rig">
        <div className="mascot-body">
          {layers
            .filter((name) => name !== "sparkles")
            .map((name) => (
              <img
                key={name}
                className={`mascot-layer mascot-${name === "body" ? "body-art" : name}`}
                src={`/assets/mascot-motion/${name}.png`}
                alt=""
                width={size}
                height={size}
                onLoad={() => setLoaded((old) => new Set(old).add(name))}
                onError={() => setFailed(true)}
              />
            ))}
        </div>
        <img
          className="mascot-layer mascot-sparkles"
          src="/assets/mascot-motion/sparkles.png"
          alt=""
          width={size}
          height={size}
          onLoad={() => setLoaded((old) => new Set(old).add("sparkles"))}
          onError={() => setFailed(true)}
        />
      </div>
    </div>
  );
}

export function MascotLoading({
  label = motion.label,
  size = motion.size,
  active = true,
  startup = false,
}: {
  label?: string;
  size?: number;
  active?: boolean;
  startup?: boolean;
}) {
  return (
    <div
      className={`mascot-loading${startup ? " mascot-startup" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div
        className="mascot-loading-visual"
        aria-hidden="true"
        style={{ animationDelay: `${motion.delay}ms` }}
      >
        <MascotAnimation size={size} active={active} />
        <p>{label}</p>
      </div>
    </div>
  );
}
