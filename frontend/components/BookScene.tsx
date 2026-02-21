"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Float, Environment } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import NotebookModel from "./NotebookModel";

export default function BookScene() {
  return (
    <Canvas
      shadows
      camera={{ position: [2.5, 3, 4], fov: 45 }}
      className="select-none"
    >
      {/* Soft base fill light */}
      <ambientLight intensity={0.15} />

      {/* Clean neutral main light */}
      <directionalLight
        position={[5, 6, 4]}
        intensity={1.2}
        castShadow
        color="#ffffff"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      {/* Subtle purple cyber accent light */}
      <directionalLight
        position={[-4, 2, -2]}
        intensity={0.6}
        color="#8b4fff"
      />

      {/* Soft cyan glow like the UI */}
      <pointLight
        position={[0, 1.5, 1]}
        intensity={0.6}
        color="#4da6ff"
      />

      {/* HDRI for realism (cool tone) */}
      <Environment preset="night" />

      {/* Floating animation */}
      <Float
        speed={1.2}
        rotationIntensity={0.6}
        floatIntensity={1.1}
      >
        <NotebookModel
          scale={0.92}
          rotation={[-0.1, -0.5, -0.25]}
          castShadow
        />
      </Float>

      {/* Postprocessing */}
      <EffectComposer>
        <Bloom
          intensity={0.8}        // overall strength
          luminanceThreshold={0.2} // only bloom bright areas
          luminanceSmoothing={0.25}
          radius={0.9}
        />
      </EffectComposer>

      <OrbitControls enableZoom={false} enablePan={false} />
    </Canvas>
  );
}
