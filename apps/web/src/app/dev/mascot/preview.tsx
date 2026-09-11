"use client";
import { useState } from "react";
import {
  MascotAnimation,
  MascotLoading,
} from "../../../components/mascot-loading";
import { Button, Checkbox } from "../../../components/form-controls";

export function MascotPreview() {
  const [active, setActive] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [run, setRun] = useState(0);
  return (
    <main style={{ maxWidth: 960, margin: "auto", padding: 24 }}>
      <h1>Gerak maskot Catera</h1>
      <p>Pratinjau pengembangan · animasi 2,4 detik</p>
      <div
        style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}
      >
        <Button className="button" onClick={() => setActive(!active)}>
          {active ? "Jeda" : "Putar"}
        </Button>
        <label>
          <Checkbox
            checked={reduced}
            onChange={(e) => setReduced(e.target.checked)}
          />{" "}
          Kurangi gerakan
        </label>
        <Button
          className="button secondary"
          onClick={() => {
            setRun((n) => n + 1);
            setLoading(true);
          }}
        >
          Mulai memuat
        </Button>
        <Button className="button secondary" onClick={() => setLoading(false)}>
          Selesai
        </Button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {(["#FFF7E9", "#FFFFFF", "#163D2E"] as const).map((background, i) => (
          <div
            key={background}
            style={{
              background,
              padding: 24,
              borderRadius: 12,
              color: i === 2 ? "#FFF7E9" : "#163D2E",
              flex: "1 1 220px",
              display: "grid",
              justifyItems: "center",
            }}
          >
            <MascotAnimation
              size={[120, 160, 200][i]}
              active={active && !reduced}
            />
            <p style={{ color: "inherit" }}>{[120, 160, 200][i]} px</p>
          </div>
        ))}
      </div>
      {loading ? (
        <MascotLoading key={run} active={active && !reduced} />
      ) : (
        <p role="note">Konten siap.</p>
      )}
    </main>
  );
}
