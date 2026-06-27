"use client";
import { useRef, useState } from "react";
import { Camera, RotateCcw, AlertCircle } from "lucide-react";
import { useI18n } from "@/i18n";

interface Props {
  value: string | null; // data URL
  onChange: (dataUrl: string | null) => void;
}

// Downscale to keep payloads small (works on 2G + fits offline storage).
function downscale(source: CanvasImageSource, w: number, h: number, max = 640): string {
  const scale = Math.min(1, max / Math.max(w, h));
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  c.getContext("2d")!.drawImage(source, 0, 0, cw, ch);
  return c.toDataURL("image/jpeg", 0.7);
}

export function PhotoCapture({ value, onChange }: Props) {
  const { t } = useI18n();
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
    } catch {
      // Permission denied or no camera API → fall back to the OS file/camera picker.
      setError(t("intake.permCam"));
      fileRef.current?.click();
    }
  }

  function snap() {
    const v = videoRef.current;
    if (!v) return;
    onChange(downscale(v, v.videoWidth, v.videoHeight));
    stop();
  }

  function stop() {
    streamRef.current?.getTracks().forEach((tk) => tk.stop());
    streamRef.current = null;
    setStreaming(false);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => onChange(downscale(img, img.width, img.height));
    img.src = URL.createObjectURL(file);
  }

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      {value ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="captured" className="h-40 w-40 rounded-xl object-cover border border-slate-200" />
          <button type="button" onClick={() => onChange(null)} className="absolute -top-2 -right-2 bg-white border rounded-full p-1.5 shadow" aria-label="retake">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      ) : streaming ? (
        <div className="space-y-2">
          <video ref={videoRef} playsInline muted className="h-48 w-full rounded-xl bg-black object-cover" />
          <div className="flex gap-2">
            <button type="button" onClick={snap} className="btn-primary flex-1">
              <Camera className="h-5 w-5" /> {t("intake.capturePhoto")}
            </button>
            <button type="button" onClick={stop} className="btn-ghost">
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={startCamera} className="btn-ghost w-full border-dashed py-6">
          <Camera className="h-5 w-5" /> {t("intake.capturePhoto")}
        </button>
      )}
      {error && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-700">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </p>
      )}
    </div>
  );
}
