import Spline from "@splinetool/react-spline";

const SPLINE_SCENE = "https://prod.spline.design/0vFifcps3sXeyeOT/scene.splinecode";

export default function HeroSpline() {
  return (
    <div className="absolute inset-0 z-0">
      <Spline scene={SPLINE_SCENE} />
    </div>
  );
}
