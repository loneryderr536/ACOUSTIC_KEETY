"use client";

import QRCode from "react-qr-code";

const BOT_USERNAME = "AcoustickittyBot";
const BOT_URL = `https://t.me/${BOT_USERNAME}`;
const BOT_WEB_URL = `https://web.telegram.org/k/#@${BOT_USERNAME}`;

type Props = {
  size?: number;
  caption?: string;
  compact?: boolean;
};

export function BotQR({
  size = 160,
  caption = "Scan with phone camera",
  compact = false,
}: Props) {
  return (
    <div className={`inline-flex flex-col items-center ${compact ? "gap-2" : "gap-3"}`}>
      <div
        className="bg-white p-3"
        style={{ border: "1px solid var(--ak-ink)" }}
      >
        <QRCode
          value={BOT_URL}
          size={size}
          style={{ height: "auto", maxWidth: "100%", width: "100%", display: "block" }}
          level="M"
          bgColor="#ffffff"
          fgColor="#1a1814"
        />
      </div>
      <div
        className="flex flex-col items-center text-center"
        style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase" }}
      >
        <span style={{ color: "var(--ak-ink3)" }}>{caption}</span>
        <span className="mt-1" style={{ color: "var(--ak-ink3)" }}>
          on desktop:{" "}
          <a
            href={BOT_WEB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:opacity-70 transition-opacity"
            style={{ color: "var(--ak-ink)" }}
          >
            open in telegram web
          </a>
        </span>
      </div>
    </div>
  );
}
