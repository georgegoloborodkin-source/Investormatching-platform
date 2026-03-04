import Spline from "@splinetool/react-spline";
import type { Application } from "@splinetool/runtime";

const SPLINE_SCENE = "https://prod.spline.design/RY8CoZwe0ZoyVMJF/scene.splinecode";

export default function HeroSpline() {
  const handleLoad = (splineApp: Application) => {
    splineApp.setZoom(0.2);
    const canvas = splineApp.canvas as HTMLCanvasElement | undefined;
    if (canvas) {
      canvas.style.pointerEvents = "none";
    }
  };

  return (
    <div style={{ pointerEvents: "none" }}>
      <Spline scene={SPLINE_SCENE} style={{ width: "100%", height: "100%" }} onLoad={handleLoad} />
    </div>
  );
}
