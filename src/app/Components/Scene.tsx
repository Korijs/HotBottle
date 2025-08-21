"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default function Scene({ getIsStill }: { getIsStill: () => boolean }) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const mountNode = mountRef.current;

    // Scene, camera, renderer
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
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(3, 4, 2);
    dir.castShadow = false;
    scene.add(dir);

    // Ground
    const groundGeom = new THREE.PlaneGeometry(20, 20);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1, metalness: 0 });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1;
    scene.add(ground);

    // ---- Load your GLB model ----
    const loader = new GLTFLoader();
    let model: THREE.Object3D | null = null;

    const centerAndScale = (obj: THREE.Object3D, desiredMaxDim = 1.8) => {
      const box = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const scale = desiredMaxDim / maxDim;

      // Center at origin
      const center = new THREE.Vector3();
      box.getCenter(center);
      obj.position.sub(center.multiplyScalar(scale));

      // Put on the floor (y = -1 plane)
      const newBox = new THREE.Box3().setFromObject(obj);
      const yMin = newBox.min.y;
      obj.position.y += (-1 - yMin); // shift so bottom sits at y = -1

      obj.scale.setScalar(scale);
    };

    // Optional: if your model is sideways, tweak its base rotation here
    const baseRotationY = 0; // e.g. Math.PI/2 if needed

    loader.load(
      "/lhs.glb",
      (gltf) => {
        model = gltf.scene;
        model.traverse((n) => {
          if ((n as THREE.Mesh).isMesh) {
            const mesh = n as THREE.Mesh;
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            // Ensure standard PBR material works with our lights
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((m) => (m as THREE.Material).needsUpdate = true);
            } else if (mesh.material) {
              (mesh.material as THREE.Material).needsUpdate = true;
            }
          }
        });

        model.rotation.y = baseRotationY;
        scene.add(model);
        centerAndScale(model);
      },
      undefined,
      (err) => {
        console.error("Failed to load lhs.glb", err);
      }
    );

    // Animate
    let raf: number | null = null;
    const clock = new THREE.Clock();

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      if (getIsStill() && model) {
        model.rotation.y += 0.005;
        // gentle bob for a touch of life, applied to whole model
        model.position.y = -1 + Math.sin(t * 1.0) * 0.03;
      }

      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
const disposeTexture = (t?: THREE.Texture | null) => { if (t) t.dispose(); };

const disposeMaterial = (mat: THREE.Material) => {
  if (mat instanceof THREE.MeshStandardMaterial) {
    // common PBR maps
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

    // extras for Physical (extends Standard)
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
  // Fallback: for other material types we just dispose the material itself.
  mat.dispose();
};

const disposeObject = (obj: THREE.Object3D) => {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      // geometry
      mesh.geometry?.dispose?.();
      // materials (array or single)
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(disposeMaterial);
      } else if (mesh.material) {
        disposeMaterial(mesh.material as THREE.Material);
      }
    }
  });
};

      if (model) {
        scene.remove(model);
        disposeObject(model);
        model = null;
      }

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
