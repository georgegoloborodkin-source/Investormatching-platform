import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Stars } from "@react-three/drei";
import * as THREE from "three";

/* ─── Particle network: nodes + connections ─── */
function ParticleNetwork() {
  const meshRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);

  const COUNT = 120;
  const SPREAD = 8;
  const CONNECTION_DIST = 2.2;

  const { positions, colors, linePositions, lineColors } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const palette = [
      [0.48, 0.22, 0.99], // purple
      [0.97, 0.48, 0.32], // orange
      [0.23, 0.51, 0.96], // blue
      [0.93, 0.28, 0.6],  // pink
      [0.08, 0.72, 0.65], // teal
    ];

    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * SPREAD;
      pos[i * 3 + 1] = (Math.random() - 0.5) * SPREAD;
      pos[i * 3 + 2] = (Math.random() - 0.5) * SPREAD * 0.6;
      const c = palette[Math.floor(Math.random() * palette.length)];
      col[i * 3] = c[0];
      col[i * 3 + 1] = c[1];
      col[i * 3 + 2] = c[2];
    }

    const lines: number[] = [];
    const lCol: number[] = [];
    for (let i = 0; i < COUNT; i++) {
      for (let j = i + 1; j < COUNT; j++) {
        const dx = pos[i * 3] - pos[j * 3];
        const dy = pos[i * 3 + 1] - pos[j * 3 + 1];
        const dz = pos[i * 3 + 2] - pos[j * 3 + 2];
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) < CONNECTION_DIST) {
          lines.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
          lines.push(pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]);
          lCol.push(col[i * 3], col[i * 3 + 1], col[i * 3 + 2]);
          lCol.push(col[j * 3], col[j * 3 + 1], col[j * 3 + 2]);
        }
      }
    }

    return {
      positions: pos,
      colors: col,
      linePositions: new Float32Array(lines),
      lineColors: new Float32Array(lCol),
    };
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.04;
      meshRef.current.rotation.x = Math.sin(t * 0.02) * 0.1;
    }
    if (linesRef.current) {
      linesRef.current.rotation.y = t * 0.04;
      linesRef.current.rotation.x = Math.sin(t * 0.02) * 0.1;
    }
  });

  return (
    <group>
      {/* Nodes */}
      <points ref={meshRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.06} vertexColors transparent opacity={0.9} sizeAttenuation />
      </points>

      {/* Connections */}
      {linePositions.length > 0 && (
        <lineSegments ref={linesRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
            <bufferAttribute attach="attributes-color" args={[lineColors, 3]} />
          </bufferGeometry>
          <lineBasicMaterial vertexColors transparent opacity={0.12} />
        </lineSegments>
      )}
    </group>
  );
}

/* ─── Floating glowing orbs ─── */
function GlowOrbs() {
  const orbs = useMemo(() => {
    const items = [];
    const palette = ["#7b39fc", "#f87b52", "#3b82f6", "#ec4899", "#14b8a6"];
    for (let i = 0; i < 6; i++) {
      items.push({
        pos: [(Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3 - 1] as [number, number, number],
        scale: 0.15 + Math.random() * 0.25,
        color: palette[i % palette.length],
        speed: 0.5 + Math.random() * 1.5,
        floatRange: 0.3 + Math.random() * 0.5,
      });
    }
    return items;
  }, []);

  return (
    <>
      {orbs.map((o, i) => (
        <Float key={i} speed={o.speed} floatIntensity={o.floatRange} rotationIntensity={0.2}>
          <mesh position={o.pos}>
            <sphereGeometry args={[o.scale, 24, 24]} />
            <meshBasicMaterial color={o.color} transparent opacity={0.25} />
          </mesh>
        </Float>
      ))}
    </>
  );
}

/* ─── Main exported scene ─── */
export default function Hero3DScene() {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.3} />
        <ParticleNetwork />
        <GlowOrbs />
        <Stars radius={80} depth={60} count={1500} factor={3} saturation={0.5} fade speed={0.5} />
      </Canvas>
    </div>
  );
}
