"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export default function Scene({ getIsStill }: { getIsStill: () => boolean }) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const mountNode = mountRef.current;

    // --- Scene / Camera / Renderer ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(55, 1, 0.01, 1000);
    camera.position.set(0, 0.75, 2.75);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountNode.appendChild(renderer.domElement);

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    // --- Controls ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);

    // --- Lights ---
    const ambient = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(3, 4, 2);
    scene.add(dir);

    // --- Ground (subtle) ---
    const groundGeom = new THREE.PlaneGeometry(20, 20);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1, metalness: 0 });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1;
    scene.add(ground);

    // --- Placeholder cube (so you see *something* immediately) ---
    const placeholderGeom = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const placeholderMat = new THREE.MeshNormalMaterial();
    const placeholder = new THREE.Mesh(placeholderGeom, placeholderMat);
    placeholder.position.set(0, -0.9, 0);
    scene.add(placeholder);

    // --- Fit camera to object helper ---
    const fitCameraToObject = (obj: THREE.Object3D, offset = 1.2) => {
      const box = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      controls.target.copy(center);

      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = (camera.fov * Math.PI) / 180;
      let dist = (maxDim / 2) / Math.tan(fov / 2);
      dist *= offset;

      const dirVec = new THREE.Vector3(0.5, 0.5, 1).normalize();
      camera.position.copy(center).addScaledVector(dirVec, dist);

      camera.near = Math.max(0.01, dist / 100);
      camera.far = dist * 100;
      camera.updateProjectionMatrix();
      controls.update();
    };

    // --- Load GLB (with DRACO) ---
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    draco.setDecoderConfig({ type: "js" });
    loader.setDRACOLoader(draco);

    let model: THREE.Group | null = null;
    let baseY = -1;

    const centerScaleAndFloor = (obj: THREE.Object3D, desiredMaxDim = 1.8) => {
      const box = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      obj.position.sub(center);

      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const scale = desiredMaxDim / maxDim;
      obj.scale.setScalar(scale);

      const newBox = new THREE.Box3().setFromObject(obj);
      const yMin = newBox.min.y;
      obj.position.y += (-1 - yMin);
      baseY = obj.position.y;
    };

    loader.load(
      "/lhs.glb",
      (gltf) => {
        model = gltf.scene;

        // Make sure materials draw (even if source used alpha/culling)
        model.traverse((n) => {
          if (n instanceof THREE.Mesh) {
            const mat = n.material;
            if (Array.isArray(mat)) {
              mat.forEach((m) => {
                if (m instanceof THREE.Material) {
                  (m as THREE.MeshStandardMaterial).transparent = false;
                  (m as THREE.MeshStandardMaterial).opacity = 1;
                  (m as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
                }
              });
            } else if (mat instanceof THREE.Material) {
              (mat as THREE.MeshStandardMaterial).transparent = false;
              (mat as THREE.MeshStandardMaterial).opacity = 1;
              (mat as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
            }
          }
        });

        scene.add(model);
        centerScaleAndFloor(model, 1.8);
        fitCameraToObject(model, 1.2);

        // Remove placeholder
        scene.remove(placeholder);
        placeholderGeom.dispose();
        placeholderMat.dispose();
      },
      undefined,
      (err) => {
        console.error("Failed to load /lhs.glb", err);
      }
    );

    // --- Animate ---
    let raf: number | null = null;
    const clock = new THREE.Clock();

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      if (model) {
        if (getIsStill()) {
          model.rotation.y += 0.005;
          model.position.y = baseY + Math.sin(t * 1.0) * 0.03;
        } else {
          model.position.y = baseY;
        }
      } else {
        placeholder.rotation.y += 0.01;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // --- Cleanup ---
    const disposeTexture = (t?: THREE.Texture | null) => { if (t) t.dispose(); };
    const disposeMaterial = (mat: THREE.Material) => {
      if (mat instanceof THREE.MeshStandardMaterial) {
        disposeTexture(mat.map);
        disposeTexture(mat.normalMap);
        disposeTexture(mat.roughnessMap);
        disposeTexture(mat.metalnessMap);
        disposeTexture(mat.aoMap);
        disposeTexture(mat.emissiveMap);
        disposeTexture(mat.bumpMap);
        disposeTexture(mat.displacementMap);
        disposeTexture(mat.alphaMap);
        disposeTexture(mat.envMap as THREE.Texture | null);
        if (mat instanceof THREE.MeshPhysicalMaterial) {
          disposeTexture(mat.clearcoatMap);
          disposeTexture(mat.clearcoatNormalMap);
          disposeTexture(mat.clearcoatRoughnessMap);
          disposeTexture(mat.iridescenceMap);
          disposeTexture(mat.iridescenceThicknessMap);
          disposeTexture(mat.sheenColorMap);
          disposeTexture(mat.sheenRoughnessMap);
          disposeTexture(mat.transmissionMap);
          disposeTexture(mat.thicknessMap);
          disposeTexture(mat.specularIntensityMap);
          disposeTexture(mat.specularColorMap);
        }
      } else if (mat instanceof THREE.MeshBasicMaterial) {
        disposeTexture(mat.map);
        disposeTexture(mat.alphaMap);
        disposeTexture(mat.envMap as THREE.Texture | null);
      }
      mat.dispose();
    };
    const disposeObject = (obj: THREE.Object3D) => {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose?.();
          const m = child.material;
          if (Array.isArray(m)) m.forEach(disposeMaterial);
          else if (m) disposeMaterial(m as THREE.Material);
        }
      });
    };

    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      controls.dispose();

      if (model) {
        scene.remove(model);
        disposeObject(model);
        model = null;
      }

      scene.remove(placeholder);
      placeholderGeom.dispose();
      placeholderMat.dispose();

      groundGeom.dispose();
      groundMat.dispose();
      renderer.dispose();

      if (mountNode.contains(renderer.domElement)) {
        mountNode.removeChild(renderer.domElement);
      }
    };
  }, [getIsStill]);

  // Full-viewport canvas
  return <div ref={mountRef} style={{ position: "fixed", inset: 0 }} />;
}
