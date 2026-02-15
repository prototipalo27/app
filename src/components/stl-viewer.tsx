"use client";

import { useEffect, useState, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import * as THREE from "three";

// ── Helpers ────────────────────────────────────────────

const STL_MIME_TYPES = ["model/stl", "application/vnd.ms-pki.stl"];
const OBJ_MIME_TYPES = ["model/obj", "application/x-tgif"];

export function isStlFile(nameOrMime: string): boolean {
  const lower = nameOrMime.toLowerCase();
  return STL_MIME_TYPES.includes(lower) || lower.endsWith(".stl");
}

export function isObjFile(nameOrMime: string): boolean {
  const lower = nameOrMime.toLowerCase();
  return OBJ_MIME_TYPES.includes(lower) || lower.endsWith(".obj");
}

export function is3DFile(nameOrMime: string): boolean {
  return isStlFile(nameOrMime) || isObjFile(nameOrMime);
}

// ── STL Model ──────────────────────────────────────────

function StlModel({ url }: { url: string }) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loader = new STLLoader();
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Error al descargar el archivo");
        return res.arrayBuffer();
      })
      .then((buffer) => {
        const geo = loader.parse(buffer);
        geo.center();
        geo.computeBoundingSphere();
        const scale = 2 / (geo.boundingSphere?.radius ?? 1);
        geo.scale(scale, scale, scale);
        geo.computeVertexNormals();
        setGeometry(geo);
      })
      .catch((err) => setError(err.message));
  }, [url]);

  if (error || !geometry) return null;

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#a0a0a0" metalness={0.3} roughness={0.6} />
    </mesh>
  );
}

// ── OBJ Model ──────────────────────────────────────────

function ObjModel({ url }: { url: string }) {
  const [group, setGroup] = useState<THREE.Group | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loader = new OBJLoader();
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Error al descargar el archivo");
        return res.text();
      })
      .then((text) => {
        const obj = loader.parse(text);

        // Center and auto-scale
        const box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());
        obj.position.sub(center);

        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2 / (maxDim || 1);
        obj.scale.setScalar(scale);

        // Apply default material to meshes without one
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (!child.material || (child.material as THREE.Material).type === "MeshBasicMaterial") {
              child.material = new THREE.MeshStandardMaterial({
                color: "#a0a0a0",
                metalness: 0.3,
                roughness: 0.6,
              });
            }
          }
        });

        setGroup(obj);
      })
      .catch((err) => setError(err.message));
  }, [url]);

  if (error || !group) return null;

  return <primitive object={group} />;
}

// ── ModelViewer (main exported component) ──────────────

interface ModelViewerProps {
  url: string;
  fileName: string;
}

export function ModelViewer({ url, fileName }: ModelViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isStl = isStlFile(fileName);

  return (
    <div className="relative h-[85vh] w-[85vw] max-w-4xl rounded-lg bg-zinc-900">
      {loading && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-green-500" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      <Canvas
        camera={{ position: [3, 3, 3], fov: 45 }}
        onCreated={() => setLoading(false)}
        onError={() => setError("Error al renderizar el modelo 3D")}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <directionalLight position={[-5, -5, -5]} intensity={0.3} />
        <Suspense fallback={null}>
          {isStl ? <StlModel url={url} /> : <ObjModel url={url} />}
        </Suspense>
        <OrbitControls enableDamping dampingFactor={0.1} />
      </Canvas>
    </div>
  );
}
