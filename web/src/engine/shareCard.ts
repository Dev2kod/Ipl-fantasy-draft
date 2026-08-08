// shareCard.ts -- draws a shareable PNG "result card" on an off-screen
// <canvas>: verdict, your XI, and every match played. Hand-rolled with the
// Canvas 2D API (no html2canvas/similar) so there's no extra dependency and
// full control over a design that matches the app's own look.

const W = 1080;
const PAD = 56;
const COLOR = {
  bg: "#fff8ec",
  panel: "#ffffff",
  panel2: "#eef6ff",
  line: "#e4e9f2",
  accent: "#ff7a1a",
  accent2: "#059d8f",
  ink: "#1e2433",
  slate: "#64748b",
  win: "#16a34a",
  loss: "#e11d48",
};

export interface ShareCardPlayer {
  name: string;
  role: string;
  overall: number;
  srcLabel: string;
  srcCode: string;
}

export interface ShareCardMatch {
  stage: string;
  ourRuns: number;
  theirRuns: number;
  oppName: string;
  oppCode: string;
  win: boolean;
}

export interface ShareCardData {
  verdict: string;
  sub: string;
  perfect: boolean;
  won: number;
  played: number;
  groupRank: number;
  overall: number;
  modeName: string;
  difficultyName: string;
  styleName: string;
  players: ShareCardPlayer[];
  matches: ShareCardMatch[];
  /** Resolve a country code to a flag image URL, if one exists (see Flag.tsx). */
  flagUrl: (code: string) => string | undefined;
  /** Fallback swatch colour for codes with no flag artwork (WI, EAF, unknown). */
  countryColour: (code: string) => string | undefined;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Truncates text with an ellipsis so it never overruns `maxWidth`. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxWidth) s = s.slice(0, -1);
  return s + "…";
}

/** Draws a flag (real artwork if we have it, a colour swatch otherwise) into a size×size box. */
function drawFlag(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | undefined,
  fallbackColour: string,
  x: number,
  y: number,
  size: number
) {
  roundRect(ctx, x, y, size, size, size * 0.18);
  ctx.save();
  ctx.clip();
  if (img) {
    ctx.drawImage(img, x, y, size, size);
  } else {
    ctx.fillStyle = fallbackColour;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, size, size, size * 0.18);
  ctx.stroke();
}

export async function renderResultCard(d: ShareCardData): Promise<Blob> {
  const codes = new Set<string>();
  d.players.forEach((p) => codes.add(p.srcCode));
  d.matches.forEach((m) => codes.add(m.oppCode));

  const images = new Map<string, HTMLImageElement>();
  await Promise.all(
    Array.from(codes).map(async (code) => {
      const url = d.flagUrl(code);
      if (!url) return;
      try {
        images.set(code, await loadImage(url));
      } catch {
        // fall back to the colour swatch if a flag fails to load
      }
    })
  );

  const colsXI = 2;
  const rowsXI = Math.ceil(d.players.length / colsXI);
  const rowH = 74;
  const matchRowH = 68;

  const headerH = 210;
  const verdictH = d.perfect ? 420 : 300;
  const statsH = 140;
  const xiTitleH = 70;
  const xiH = rowsXI * rowH;
  const matchesTitleH = 70;
  const matchesH = d.matches.length * matchRowH;
  const footerH = 110;

  const height =
    headerH + verdictH + statsH + xiTitleH + xiH + 24 + matchesTitleH + matchesH + footerH + PAD * 2;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Background + top accent band
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, W, height);
  ctx.fillStyle = COLOR.accent;
  ctx.fillRect(0, 0, W, 10);

  let y = PAD + 30;

  // Header: wordmark + tagline
  ctx.textBaseline = "alphabetic";
  ctx.font = "900 46px system-ui, sans-serif";
  ctx.fillStyle = COLOR.ink;
  const wordmark = "UNBEATEN ";
  ctx.textAlign = "left";
  const wmW = ctx.measureText(wordmark).width;
  const xiW = ctx.measureText("XI").width;
  const startX = (W - wmW - xiW) / 2;
  ctx.fillText(wordmark, startX, y);
  ctx.fillStyle = COLOR.accent;
  ctx.fillText("XI", startX + wmW, y);

  y += 36;
  ctx.font = "700 20px system-ui, sans-serif";
  ctx.fillStyle = COLOR.accent2;
  ctx.textAlign = "center";
  ctx.fillText("WORLD CUP DRAFT · 1975–2023", W / 2, y);

  y += headerH - 66;

  // Verdict block
  if (d.perfect) {
    ctx.font = "900 130px system-ui, sans-serif";
    ctx.fillStyle = COLOR.accent;
    ctx.textAlign = "center";
    ctx.fillText("7–0", W / 2, y);
    y += 110;
  }
  ctx.font = "900 54px system-ui, sans-serif";
  ctx.fillStyle = COLOR.ink;
  ctx.fillText(d.verdict, W / 2, y);
  y += 46;
  ctx.font = "500 26px system-ui, sans-serif";
  ctx.fillStyle = COLOR.slate;
  ctx.fillText(d.sub, W / 2, y);
  y += 70;

  // Stats row
  const stats: [string, string][] = [
    [`${d.won}/${d.played}`, "WON"],
    [`${d.groupRank}/4`, "GROUP"],
    [String(Math.round(d.overall)), "OVERALL"],
  ];
  const statW = (W - PAD * 2) / 3;
  stats.forEach(([v, k], i) => {
    const cx = PAD + statW * i + statW / 2;
    ctx.font = "900 40px system-ui, sans-serif";
    ctx.fillStyle = COLOR.accent;
    ctx.fillText(v, cx, y);
    ctx.font = "800 17px system-ui, sans-serif";
    ctx.fillStyle = COLOR.slate;
    ctx.fillText(k, cx, y + 30);
  });
  y += statsH - 10;

  // "YOUR XI" section
  ctx.textAlign = "left";
  ctx.font = "900 24px system-ui, sans-serif";
  ctx.fillStyle = COLOR.accent2;
  ctx.fillText("YOUR XI", PAD, y);
  y += 42;

  const colW = (W - PAD * 2 - 20) / colsXI;
  d.players.forEach((p, i) => {
    const col = Math.floor(i / rowsXI);
    const row = i % rowsXI;
    const cx = PAD + col * (colW + 20);
    const cy = y + row * rowH;

    roundRect(ctx, cx, cy, colW, rowH - 10, 16);
    ctx.fillStyle = COLOR.panel;
    ctx.fill();
    ctx.strokeStyle = COLOR.line;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    drawFlag(ctx, images.get(p.srcCode), d.countryColour(p.srcCode) ?? "#5B6472", cx + 12, cy + 12, rowH - 34);

    const textX = cx + 12 + (rowH - 34) + 14;
    const textMaxW = colW - (12 + (rowH - 34) + 14) - 60;
    ctx.font = "800 21px system-ui, sans-serif";
    ctx.fillStyle = COLOR.ink;
    ctx.fillText(fitText(ctx, p.name, textMaxW), textX, cy + 30);
    ctx.font = "500 15px system-ui, sans-serif";
    ctx.fillStyle = COLOR.slate;
    ctx.fillText(fitText(ctx, `${p.role} · ${p.srcLabel}`, textMaxW), textX, cy + 51);

    ctx.font = "900 22px system-ui, sans-serif";
    ctx.fillStyle = COLOR.accent;
    ctx.textAlign = "right";
    ctx.fillText(String(p.overall), cx + colW - 14, cy + (rowH - 10) / 2 + 8);
    ctx.textAlign = "left";
  });
  y += xiH + 34;

  // "MATCHES PLAYED" section
  ctx.font = "900 24px system-ui, sans-serif";
  ctx.fillStyle = COLOR.accent2;
  ctx.fillText("MATCHES PLAYED", PAD, y);
  y += 42;

  d.matches.forEach((m, i) => {
    const cy = y + i * matchRowH;
    roundRect(ctx, PAD, cy, W - PAD * 2, matchRowH - 10, 14);
    ctx.fillStyle = m.win ? "rgba(22,163,74,0.07)" : COLOR.panel;
    ctx.fill();
    ctx.strokeStyle = COLOR.line;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = "800 13px system-ui, sans-serif";
    ctx.fillStyle = COLOR.slate;
    ctx.fillText(m.stage.toUpperCase(), PAD + 18, cy + 24);

    ctx.font = "800 22px system-ui, sans-serif";
    ctx.fillStyle = COLOR.ink;
    const score = `${m.ourRuns} v ${m.theirRuns}`;
    ctx.fillText(score, PAD + 18, cy + 48);
    const scoreW = ctx.measureText(score).width;

    const flagSize = 26;
    drawFlag(ctx, images.get(m.oppCode), d.countryColour(m.oppCode) ?? "#5B6472", PAD + 18 + scoreW + 16, cy + 24, flagSize);

    ctx.font = "500 18px system-ui, sans-serif";
    ctx.fillStyle = COLOR.ink;
    const oppMaxW = W - PAD * 2 - (18 + scoreW + 16 + flagSize + 12) - 90;
    ctx.fillText(fitText(ctx, m.oppName, oppMaxW), PAD + 18 + scoreW + 16 + flagSize + 12, cy + 24 + flagSize - 6);

    const badge = m.win ? "W" : "L";
    ctx.font = "900 20px system-ui, sans-serif";
    const badgeW = 44;
    roundRect(ctx, W - PAD - 18 - badgeW, cy + (matchRowH - 10) / 2 - 20, badgeW, 40, 20);
    ctx.fillStyle = m.win ? "rgba(22,163,74,0.18)" : "rgba(225,29,72,0.18)";
    ctx.fill();
    ctx.fillStyle = m.win ? COLOR.win : COLOR.loss;
    ctx.textAlign = "center";
    ctx.fillText(badge, W - PAD - 18 - badgeW / 2, cy + (matchRowH - 10) / 2 + 7);
    ctx.textAlign = "left";
  });
  y += matchesH + 40;

  // Footer
  ctx.strokeStyle = COLOR.line;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  y += 40;
  ctx.font = "700 19px system-ui, sans-serif";
  ctx.fillStyle = COLOR.slate;
  ctx.textAlign = "center";
  ctx.fillText(`${d.modeName} · ${d.difficultyName} · ${d.styleName}`, W / 2, y);
  y += 30;
  ctx.font = "600 16px system-ui, sans-serif";
  ctx.fillText("Unbeaten XI — a fan-made cricket World Cup draft game", W / 2, y);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png");
  });
}

/** True when the platform can hand this image to its native share sheet. */
export function canShareFile(filename: string): boolean {
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  if (!nav.canShare) return false;
  try {
    return nav.canShare({ files: [new File([], filename, { type: "image/png" })] });
  } catch {
    return false;
  }
}

/** Hands the image to the native share sheet. Resolves quietly if the user cancels it. */
export async function shareImageFile(blob: Blob, filename: string, shareText: string): Promise<void> {
  const file = new File([blob], filename, { type: "image/png" });
  try {
    await navigator.share({ files: [file], title: "Unbeaten XI", text: shareText });
  } catch (e) {
    if ((e as Error)?.name !== "AbortError") throw e;
  }
}

/** Saves the image straight to the user's downloads. */
export function downloadImage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
