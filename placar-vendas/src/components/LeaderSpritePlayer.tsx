import { useEffect, useRef } from 'react';

export interface LeaderSpriteConfig {
  id: string;
  basePath: string;
  numSheets: number;
  cols: number;
  perSheet: number;
  totalFrames: number;
  frameW: number;
  frameH: number;
  fps?: number;
  pauseMs?: number;
}

type FrameSource = ImageBitmap | HTMLImageElement;

async function loadSheet(url: string): Promise<FrameSource> {
  if (typeof createImageBitmap === 'function') {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return createImageBitmap(blob);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export default function LeaderSpritePlayer({
  config,
  className,
}: {
  config: LeaderSpriteConfig;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1200px)');
    if (!desktopQuery.matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fps = config.fps ?? 15;
    const pauseMs = config.pauseMs ?? 30_000;
    const playDurationMs = (config.totalFrames / fps) * 1000;
    const cycleMs = pauseMs + playDurationMs;
    const sources: (FrameSource | null)[] = Array(config.numSheets).fill(null);

    let cancelled = false;
    let rafId = 0;
    let startTime = 0;
    let lastFrame = -1;
    let loadedCount = 0;

    function drawFrame(frameIndex: number) {
      if (!ctx || cancelled) return;
      const sheetIndex = Math.floor(frameIndex / config.perSheet);
      const source = sources[sheetIndex];
      if (!source) return;

      const localIndex = frameIndex % config.perSheet;
      const col = localIndex % config.cols;
      const row = Math.floor(localIndex / config.cols);
      const sx = col * config.frameW;
      const sy = row * config.frameH;

      ctx.clearRect(0, 0, config.frameW, config.frameH);
      ctx.drawImage(
        source,
        sx,
        sy,
        config.frameW,
        config.frameH,
        0,
        0,
        config.frameW,
        config.frameH,
      );
      lastFrame = frameIndex;
    }

    function tick(now: number) {
      if (cancelled) return;
      if (!document.hidden && loadedCount === config.numSheets) {
        if (!startTime) startTime = now;
        const elapsedInCycle = (now - startTime) % cycleMs;
        const frame =
          elapsedInCycle < pauseMs
            ? 0
            : Math.min(
                config.totalFrames - 1,
                Math.floor(((elapsedInCycle - pauseMs) / 1000) * fps),
              );
        if (frame !== lastFrame) {
          drawFrame(frame);
        }
      }
      if (!reducedMotion) {
        rafId = window.requestAnimationFrame(tick);
      }
    }

    // Load sheet 0 immediately so frame 0 appears at once, then load remaining sheets in parallel.
    loadSheet(`${config.basePath}-0.webp`)
      .then(sheet0 => {
        if (cancelled) {
          if ('close' in sheet0) sheet0.close();
          return;
        }
        sources[0] = sheet0;
        loadedCount++;
        drawFrame(0);
        if (reducedMotion) return;

        for (let i = 1; i < config.numSheets; i++) {
          loadSheet(`${config.basePath}-${i}.webp`)
            .then(sheet => {
              if (cancelled) {
                if ('close' in sheet) sheet.close();
                return;
              }
              sources[i] = sheet;
              loadedCount++;
              if (loadedCount === config.numSheets && !rafId) {
                startTime = performance.now();
                rafId = window.requestAnimationFrame(tick);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      for (const s of sources) {
        if (s && 'close' in s) s.close();
      }
    };
  }, [config]);

  return (
    <canvas
      ref={canvasRef}
      width={config.frameW}
      height={config.frameH}
      className={className}
      aria-hidden="true"
    />
  );
}
