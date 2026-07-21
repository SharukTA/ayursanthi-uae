"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Float,
  OrbitControls,
  Text,
} from "@react-three/drei";
import * as THREE from "three";

/**
 * AyurvedicBottle — procedural 3D bottle.
 * Cap lifts + rotates open and closes on a loop.
 */
function AyurvedicBottle({ accent = "#156c6b" }) {
  const capRef = useRef();
  const bottleRef = useRef();
  const liquidRef = useRef();
  const [phase, setPhase] = useState(0);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    // Phase: 0..1 open, 1..2 hold, 2..3 close, 3..5 hold closed
    const cycle = 5;
    const local = t % cycle;
    let openness = 0;
    if (local < 1) openness = local;
    else if (local < 2) openness = 1;
    else if (local < 3) openness = 1 - (local - 2);
    else openness = 0;

    const eased = openness < 0.5
      ? 2 * openness * openness
      : 1 - Math.pow(-2 * openness + 2, 2) / 2;

    if (capRef.current) {
      capRef.current.position.y = 1.55 + eased * 1.1;
      capRef.current.rotation.y = eased * Math.PI * 0.8;
      capRef.current.rotation.z = eased * 0.15;
    }
    if (bottleRef.current) {
      bottleRef.current.rotation.y = t * 0.25;
    }
    if (liquidRef.current) {
      liquidRef.current.material.emissiveIntensity =
        0.35 + Math.sin(t * 2) * 0.08 + eased * 0.4;
    }
    setPhase(eased);
  });

  return (
    <group ref={bottleRef} position={[0, -0.3, 0]}>
      {/* Floor disc / shadow catcher */}

      {/* Bottle body — tall cylinder, glass amber */}
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[0.78, 0.85, 2.4, 64]} />
        <meshPhysicalMaterial
          color="#3a1f0a"
          roughness={0.18}
          metalness={0.05}
          transmission={0.75}
          thickness={0.6}
          ior={1.5}
          clearcoat={0.6}
          clearcoatRoughness={0.15}
          attenuationColor="#7a3a10"
          attenuationDistance={1.1}
        />
      </mesh>

      {/* Liquid inside — slightly smaller cylinder, warmer color */}
      <mesh ref={liquidRef} position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.72, 0.78, 1.9, 64]} />
        <meshStandardMaterial
          color="#b45309"
          roughness={0.35}
          metalness={0.1}
          emissive="#92400e"
          emissiveIntensity={0.35}
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* Label band — paper-like ring */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.86, 0.86, 1.0, 64, 1, true]} />
        <meshStandardMaterial
          color="#fef3c7"
          roughness={0.85}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Label text — front */}
      <Text
        position={[0, 0.2, 0.88]}
        fontSize={0.18}
        color={accent}
        anchorX="center"
        anchorY="middle"
        font={undefined}
      >
        AYURSANTHI
      </Text>
      <Text
        position={[0, -0.05, 0.88]}
        fontSize={0.085}
        color="#451a03"
        anchorX="center"
        anchorY="middle"
      >
        WELLNESS · 100% NATURAL
      </Text>
      <Text
        position={[0, -0.28, 0.88]}
        fontSize={0.07}
        color="#78350f"
        anchorX="center"
        anchorY="middle"
      >
        Ayurvedic Herbal Tonic
      </Text>

      {/* Neck — narrower cylinder */}
      <mesh position={[0, 1.35, 0]}>
        <cylinderGeometry args={[0.45, 0.55, 0.32, 32]} />
        <meshPhysicalMaterial
          color="#3a1f0a"
          roughness={0.18}
          transmission={0.7}
          thickness={0.4}
          ior={1.5}
          attenuationColor="#7a3a10"
          attenuationDistance={1.1}
        />
      </mesh>

      {/* Bottle rim */}
      <mesh position={[0, 1.52, 0]}>
        <torusGeometry args={[0.45, 0.04, 16, 64]} />
        <meshStandardMaterial color="#1f1306" roughness={0.5} metalness={0.6} />
      </mesh>

      {/* Cap — lifts and rotates */}
      <group ref={capRef} position={[0, 1.55, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.48, 0.48, 0.38, 32]} />
          <meshStandardMaterial
            color={accent}
            roughness={0.32}
            metalness={0.55}
          />
        </mesh>
        {/* Cap top knurl ring */}
        <mesh position={[0, 0.21, 0]}>
          <torusGeometry args={[0.46, 0.03, 12, 32]} />
          <meshStandardMaterial
            color={accent}
            roughness={0.4}
            metalness={0.7}
          />
        </mesh>
        {/* Cap top emblem */}
        <mesh position={[0, 0.21, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.04, 32]} />
          <meshStandardMaterial color="#fde68a" roughness={0.3} metalness={0.4} />
        </mesh>
      </group>

      {/* Floating "aroma" particles emerging when open */}
      {phase > 0.3 && (
        <group>
          {[0, 1, 2, 3, 4].map((i) => {
            const offset = i * 0.6;
            return (
              <mesh
                key={i}
                position={[
                  Math.sin(offset + phase * 4) * 0.35,
                  2.4 + phase * 0.4 + i * 0.18,
                  Math.cos(offset + phase * 4) * 0.35,
                ]}
              >
                <sphereGeometry args={[0.045 + i * 0.012, 16, 16]} />
                <meshStandardMaterial
                  color="#b0dcd9"
                  emissive="#2c8987"
                  emissiveIntensity={0.8}
                  transparent
                  opacity={Math.max(0, phase - i * 0.15)}
                />
              </mesh>
            );
          })}
        </group>
      )}
    </group>
  );
}

/**
 * Floating decorative leaves around the bottle for ambience.
 */
function FloatingLeaf({ position, rotation, color = "#156c6b" }) {
  return (
    <Float speed={1.4} rotationIntensity={1.2} floatIntensity={1.5}>
      <mesh position={position} rotation={rotation}>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial
          color={color}
          roughness={0.6}
          metalness={0.1}
          emissive={color}
          emissiveIntensity={0.15}
        />
      </mesh>
    </Float>
  );
}

export function Bottle3D({
  className = "",
  accent = "#156c6b",
  interactive = true,
  height = "100%",
}) {
  const [isMobile, setIsMobile] = useState(false);
  const [inView, setInView] = useState(true);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px), (pointer: coarse)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  // Pause the render loop when the bottle is off-screen.
  // Saves significant CPU/GPU on pages where the bottle scrolls out of view.
  useEffect(() => {
    if (!wrapperRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.05, rootMargin: "100px" }
    );
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  // On mobile we want a much cheaper render:
  //   - DPR capped at 1.25 (instead of up to 2x)
  //   - shadows off
  //   - orbit controls disabled (avoids accidental drags while scrolling)
  //   - environment swapped for a cheaper preset
  const mobile = isMobile;

  return (
    <div ref={wrapperRef} className={`relative ${className}`} style={{ height }}>
      <Canvas
        shadows={!mobile}
        camera={{ position: [0, 0.8, 5], fov: 38 }}
        dpr={mobile ? [1, 1.25] : [1, 2]}
        gl={{ antialias: !mobile, alpha: true, powerPreference: "high-performance" }}
        frameloop={inView ? "always" : "never"}
      >
        <Suspense fallback={null}>
          <color attach="background" args={[0, 0, 0, 0]} />
          <ambientLight intensity={0.5} />
          <directionalLight
            position={[4, 6, 4]}
            intensity={1.2}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <pointLight position={[-3, 2, -3]} intensity={0.6} color="#80c4c1" />
          <pointLight position={[3, -1, 3]} intensity={0.4} color="#2c8987" />

          <AyurvedicBottle accent={accent} />

          <FloatingLeaf position={[-2.1, 0.6, 0.5]} rotation={[0.4, 0.2, 0.1]} />
          <FloatingLeaf
            position={[2.0, 1.2, -0.4]}
            rotation={[-0.3, 0.5, 0.2]}
            color="#1e7775"
          />
          <FloatingLeaf
            position={[-1.5, -1.0, 1.2]}
            rotation={[0.2, -0.3, 0.4]}
            color="#4ea7a4"
          />
          <FloatingLeaf
            position={[1.8, -1.2, 0.8]}
            rotation={[-0.5, 0.1, 0.3]}
            color="#80c4c1"
          />

          <ContactShadows
            position={[0, -1.65, 0]}
            opacity={0.5}
            scale={8}
            blur={2.4}
            far={3}
          />
          <Environment preset="warehouse" />

          {interactive && !mobile && (
            <OrbitControls
              enableZoom={false}
              enablePan={false}
              minPolarAngle={Math.PI / 3}
              maxPolarAngle={Math.PI / 1.8}
              autoRotate={false}
            />
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}
