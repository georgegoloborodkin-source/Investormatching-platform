import { useState } from "react";
import { motion } from "framer-motion";
import Spline from "@splinetool/react-spline";
import type { Application } from "@splinetool/runtime";

const SPLINE_SCENE = "https://prod.spline.design/RY8CoZwe0ZoyVMJF/scene.splinecode";

export default function HeroSpline() {
  const [loaded, setLoaded] = useState(false);

  const handleLoad = (splineApp: Application) => {
    splineApp.setZoom(0.2);
    const canvas = splineApp.canvas as HTMLCanvasElement | undefined;
    if (canvas) canvas.style.pointerEvents = "none";
    setLoaded(true);
  };

  return (
    <motion.div
      style={{ pointerEvents: "none" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: loaded ? 1 : 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <Spline scene={SPLINE_SCENE} style={{ width: "100%", height: "100%" }} onLoad={handleLoad} />
    </motion.div>
  );
}
