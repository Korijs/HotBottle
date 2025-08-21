"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function Scene({ getIsStill }: { getIsStill: () => boolean }) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Capture the ref in a local var so cleanup uses the same node
    const mountNode = mountRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#000000");

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.set(0, 1.2, 3.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountNode.appendChild(renderer.domElement);

    const resize = () => {
      const w = mountNode.clientWidth || window.innerWidth;
      const h = mountNode.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    // Lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x202020, 0.9);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(3, 4, 2);
    scene.add(dir);

    // Ground
    const groundGeom = new THREE.PlaneGeometry(20, 20);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1, metalness: 0 });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1;
    scene.add(ground);

    // Bottle
    const points: THREE.Vector2[] = [];
    const profile: Array<[number, number]> = [
      [0.0, -0.9],
      [0.25, -0.9],
      [0.32, -0.8],
      [0.36, -0.6],
      [0.40, -0.2],
      [0.36,  0.2],
      [0.30,  0.35],
      [0.20,  0.55],
      [0.16,  0.75],
      [0.16,  0.95],
      [0.14,  1.05],
      [0.14,  1.25],
      [0.20,  1.25],
    ];
    for (const [x, y] of profile) points.push(new THREE.Vector2(x, y));

    const bottleGeom = new THREE.LatheGeometry(points, 96);
    const bottleMat = new THREE.MeshPhysicalMaterial({
      color: 0x73c1ff,
      roughness: 0.2,
      metalness: 0.0,
      transmission: 0.88,
      thickness: 0.25,
      ior: 1.45,
      envMapIntensity: 1.0,
    });
    const bottle = new THREE.Mesh(bottleGeom, bottleMat);
    scene.add(bottle);

    const labelGeom = new THREE.CylinderGeometry(0.33, 0.33, 0.25, 64, 1, true);
    const labelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, transparent: true, opacity: 0.12 });
    const label = new THREE.Mesh(labelGeom, labelMat);
    label.position.y = 0.05;
    label.rotation.y = Math.PI * 0.17;
    scene.add(label);

    let raf: number | null = null;
    const clock = new THREE.Clock();

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      if (getIsStill()) {
        bottle.rotation.y += 0.005;
        bottle.position.y = Math.sin(t * 1.0) * 0.03;
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);

      // Dispose in reverse-ish order
      labelGeom.dispose();
      labelMat.dispose();
      bottleGeom.dispose();
      bottleMat.dispose();
      groundGeom.dispose();
      groundMat.dispose();
      renderer.dispose();

      if (mountNode.contains(renderer.domElement)) {
        mountNode.removeChild(renderer.domElement);
      }
    };
  }, [getIsStill]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}
