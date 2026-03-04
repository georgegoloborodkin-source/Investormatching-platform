import Spline from "@splinetool/react-spline";

const SPLINE_SCENE = "https://prod.spline.design/RY8CoZwe0ZoyVMJF/scene.splinecode";

export default function HeroSpline() {
  return (
    <Spline scene={SPLINE_SCENE} style={{ width: "100%", height: "100%" }} />
  );
}
