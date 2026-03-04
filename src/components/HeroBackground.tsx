import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

const VIDEO_SRC =
  "https://customer-cbeadsgr09pnsezs.cloudflarestream.com/257c7359efd4b4aaebcc03aa8fc78a36/manifest/video.m3u8";
const POSTER =
  "https://customer-cbeadsgr09pnsezs.cloudflarestream.com/257c7359efd4b4aaebcc03aa8fc78a36/thumbnails/thumbnail.jpg";

export default function HeroBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = VIDEO_SRC;
    } else if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.loadSource(VIDEO_SRC);
      hls.attachMedia(video);
    }

    const onPlaying = () => setPlaying(true);
    video.addEventListener("playing", onPlaying);

    return () => {
      video.removeEventListener("playing", onPlaying);
      hls?.destroy();
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* poster shown until video plays */}
      <img
        src={POSTER}
        alt=""
        aria-hidden
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
          playing ? "opacity-0" : "opacity-100"
        }`}
      />

      <video
        ref={videoRef}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
          playing ? "opacity-100" : "opacity-0"
        }`}
        autoPlay
        loop
        muted
        playsInline
        poster={POSTER}
      />

      {/* dark overlay */}
      <div className="absolute inset-0 bg-black/60" />
    </div>
  );
}
