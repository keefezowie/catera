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
    // Decode cached and newly loaded layers before replacing the poster.
    let live = true;
    root.current
      ?.querySelectorAll<HTMLImageElement>(".mascot-layer")
      .forEach((img) => {
        img
          .decode()
          .then(() => {
            if (live)
              setLoaded((old) =>
                new Set(old).add(img.src.split("/").pop()!.replace(".png", "")),
              );
          })
          .catch(() => {
            if (live) setFailed(true);
          });
      });
    const update = () => setForeground(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    );
    if (root.current) observer.observe(root.current);
    return () => {
      live = false;
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
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), motion.delay);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div
      className={`mascot-loading${startup ? " mascot-startup" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div
        className="mascot-loading-visual"
        aria-hidden="true"
        data-visible={visible}
      >
        <MascotAnimation size={size} active={active && visible} />
        <p>{label}</p>
      </div>
    </div>
  );
}
