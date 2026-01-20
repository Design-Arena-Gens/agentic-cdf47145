"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

type DrawContext = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  random: () => number;
  perlin: (x: number, y: number) => number;
};

const DOWNLOAD_WIDTH = 7680;
const DOWNLOAD_HEIGHT = 4320;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createPerlin(random: () => number) {
  const permutation = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) {
    p[i] = i;
  }
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  for (let i = 0; i < 512; i += 1) {
    permutation[i] = p[i & 255];
  }

  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (t: number, a: number, b: number) => a + t * (b - a);
  const grad = (hash: number, x: number, y: number) => {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  };

  return (x: number, y: number) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = fade(xf);
    const v = fade(yf);

    const aa = permutation[X + permutation[Y]];
    const ab = permutation[X + permutation[Y + 1]];
    const ba = permutation[X + 1 + permutation[Y]];
    const bb = permutation[X + 1 + permutation[Y + 1]];

    const x1 = lerp(u, grad(aa, xf, yf), grad(ba, xf - 1, yf));
    const x2 = lerp(u, grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1));

    return (lerp(v, x1, x2) + 1) / 2;
  };
}

function fillBackground({ ctx, width, height }: DrawContext) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#05070b");
  sky.addColorStop(0.3, "#0d1117");
  sky.addColorStop(0.65, "#1a1a1f");
  sky.addColorStop(1, "#2c1c14");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createLinearGradient(0, height * 0.55, 0, height);
  glow.addColorStop(0, "rgba(255,120,30,0.25)");
  glow.addColorStop(0.35, "rgba(210,80,20,0.15)");
  glow.addColorStop(1, "rgba(20,12,10,0.85)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, height * 0.55, width, height * 0.45);
}

function drawExplosion({ ctx, width, height, random }: DrawContext) {
  const fireballCount = 3 + Math.floor(random() * 2);
  for (let i = 0; i < fireballCount; i += 1) {
    const baseX = width * (0.38 + random() * 0.24);
    const baseY = height * (0.62 + random() * 0.06);
    const radius = width * (0.12 + random() * 0.08);
    const gradient = ctx.createRadialGradient(baseX, baseY, radius * 0.1, baseX, baseY, radius);
    gradient.addColorStop(0, "rgba(255,245,200,0.95)");
    gradient.addColorStop(0.2, "rgba(255,190,90,0.9)");
    gradient.addColorStop(0.45, "rgba(220,90,20,0.75)");
    gradient.addColorStop(0.85, "rgba(70,25,12,0.2)");
    gradient.addColorStop(1, "rgba(20,10,8,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(baseX, baseY, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSmoke({ ctx, width, height, random, perlin }: DrawContext) {
  const layers = 16;
  for (let layer = 0; layer < layers; layer += 1) {
    const opacity = 0.25 - layer * 0.01;
    const offset = random() * 1000;
    const yBase = height * (0.55 + layer * 0.015);
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += width / 160) {
      const noise = perlin(x * 0.002 + offset, layer * 0.25 + offset * 0.01);
      const y = yBase - noise * height * 0.22;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = `rgba(28,24,30,${opacity})`;
    ctx.fill();
  }
}

function drawEmbers({ ctx, width, height, random, perlin }: DrawContext) {
  const count = Math.floor(width * 0.7);
  for (let i = 0; i < count; i += 1) {
    const x = random() * width;
    const y = height * (0.4 + random() * 0.45);
    const intensity = perlin(x * 0.03, y * 0.03);
    if (intensity < 0.45) continue;
    const size = 0.8 + random() * 1.6;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((random() - 0.5) * Math.PI * 0.3);
    const gradient = ctx.createLinearGradient(0, 0, 0, size * 6);
    gradient.addColorStop(0, `rgba(255,210,120,${0.85 + random() * 0.1})`);
    gradient.addColorStop(0.5, "rgba(255,120,30,0.4)");
    gradient.addColorStop(1, "rgba(60,20,10,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(-size, 0, size * 2, size * 6 + random() * 18);
    ctx.restore();
  }
}

function drawTerrain({ ctx, width, height, random, perlin }: DrawContext) {
  const horizon = height * 0.68;
  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let x = 0; x <= width; x += width / 200) {
    const noise = perlin(x * 0.003, 20);
    const y = horizon + noise * height * 0.18;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fillStyle = "#050406";
  ctx.fill();

  const structures = 12 + Math.floor(random() * 6);
  for (let i = 0; i < structures; i += 1) {
    const x = (i / structures) * width + random() * width * 0.04;
    const baseHeight = height * (0.12 + random() * 0.12);
    const widthFactor = width * (0.02 + random() * 0.03);
    ctx.save();
    ctx.translate(x, horizon - random() * height * 0.08);
    ctx.scale(1, 1 + random() * 0.2);
    ctx.beginPath();
    ctx.moveTo(-widthFactor * 0.6, 0);
    ctx.lineTo(-widthFactor * 0.3, -baseHeight * (0.3 + random() * 0.2));
    ctx.lineTo(-widthFactor * 0.4, -baseHeight * (0.7 + random() * 0.2));
    ctx.lineTo(widthFactor * 0.2, -baseHeight);
    ctx.lineTo(widthFactor * 0.4, -baseHeight * (0.7 + random() * 0.2));
    ctx.lineTo(widthFactor * 0.7, -baseHeight * (0.3 + random() * 0.2));
    ctx.lineTo(widthFactor * 0.9, 0);
    ctx.closePath();
    ctx.fillStyle = "rgba(10,10,14,0.9)";
    ctx.fill();
    ctx.restore();
  }

  ctx.globalCompositeOperation = "lighter";
  const haze = ctx.createLinearGradient(0, horizon - height * 0.1, 0, horizon + height * 0.2);
  haze.addColorStop(0, "rgba(255,130,60,0.06)");
  haze.addColorStop(0.5, "rgba(255,90,40,0.1)");
  haze.addColorStop(1, "rgba(30,10,10,0)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - height * 0.1, width, height * 0.3);
  ctx.globalCompositeOperation = "source-over";
}

function drawAtmosphericDust({ ctx, width, height, random }: DrawContext) {
  const density = Math.floor(width * 3.6);
  for (let i = 0; i < density; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const alpha = 0.02 + random() * 0.04;
    const size = random() * 2;
    ctx.fillStyle = `rgba(240,200,140,${alpha})`;
    ctx.fillRect(x, y, size, size);
  }
}

function drawScene(canvas: HTMLCanvasElement, width: number, height: number, seed: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const random = mulberry32(seed);
  const perlin = createPerlin(random);
  const drawContext: DrawContext = { ctx, width, height, random, perlin };

  ctx.clearRect(0, 0, width, height);
  fillBackground(drawContext);
  drawExplosion(drawContext);
  drawSmoke(drawContext);
  drawEmbers(drawContext);
  drawTerrain(drawContext);
  drawAtmosphericDust(drawContext);
}

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [seed, setSeed] = useState(() => Date.now());
  const [isRendering, setIsRendering] = useState(false);

  const renderPreview = useCallback(
    (targetSeed: number) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const { clientWidth, clientHeight } = container;
      canvas.width = Math.max(1, Math.floor(clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(clientHeight * dpr));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      drawScene(canvas, clientWidth, clientHeight, targetSeed);
    },
    []
  );

  useEffect(() => {
    renderPreview(seed);
  }, [seed, renderPreview]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      renderPreview(seed);
    });
    const node = containerRef.current;
    if (!node) return;
    observer.observe(node);
    return () => observer.disconnect();
  }, [seed, renderPreview]);

  const regenerate = useCallback(() => {
    const nextSeed = Date.now() ^ Math.floor(Math.random() * 1e9);
    setSeed(nextSeed);
  }, []);

  const download = useCallback(async () => {
    if (isRendering) return;
    setIsRendering(true);
    try {
      const offscreen = document.createElement("canvas");
      offscreen.width = DOWNLOAD_WIDTH;
      offscreen.height = DOWNLOAD_HEIGHT;
      drawScene(offscreen, DOWNLOAD_WIDTH, DOWNLOAD_HEIGHT, seed);
      const link = document.createElement("a");
      link.download = `war-background-${seed}.jpg`;
      link.href = offscreen.toDataURL("image/jpeg", 0.94);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsRendering(false);
    }
  }, [seed, isRendering]);

  const aspectHint = useMemo(() => `${DOWNLOAD_WIDTH} × ${DOWNLOAD_HEIGHT} (16:9)`, []);

  return (
    <div className={styles.page}>
      <div className={styles.canvasWrapper} ref={containerRef}>
        <canvas ref={canvasRef} className={styles.canvas} />
        <div className={styles.overlay}>
          <div className={styles.badge}>سينمائي</div>
          <h1 className={styles.title}>خلفية حرب واقعية</h1>
          <p className={styles.subtitle}>
            نار متوهجة، دخان كثيف، شرارات متناثرة — مشهد درامي جاهز لخلفية سطح مكتب أو تصميم سينمائي.
          </p>
          <div className={styles.actions}>
            <button onClick={download} disabled={isRendering} className={styles.primaryButton}>
              {isRendering ? "يتم التجهيز..." : "تنزيل بدقة 8K"}
            </button>
            <button onClick={regenerate} className={styles.secondaryButton}>
              توليد مشهد جديد
            </button>
          </div>
          <span className={styles.aspectHint}>دقة التحميل: {aspectHint}</span>
        </div>
      </div>
    </div>
  );
}
