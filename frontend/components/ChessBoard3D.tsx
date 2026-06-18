'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Starting position pieces
const PIECES: { row: number; col: number; type: string; color: 'white' | 'black' }[] = [
  { row: 0, col: 0, type: 'R', color: 'black' },
  { row: 0, col: 1, type: 'N', color: 'black' },
  { row: 0, col: 2, type: 'B', color: 'black' },
  { row: 0, col: 3, type: 'Q', color: 'black' },
  { row: 0, col: 4, type: 'K', color: 'black' },
  { row: 0, col: 5, type: 'B', color: 'black' },
  { row: 0, col: 6, type: 'N', color: 'black' },
  { row: 0, col: 7, type: 'R', color: 'black' },
  ...Array.from({ length: 8 }, (_, i) => ({ row: 1, col: i, type: 'P', color: 'black' as const })),
  ...Array.from({ length: 8 }, (_, i) => ({ row: 6, col: i, type: 'P', color: 'white' as const })),
  { row: 7, col: 0, type: 'R', color: 'white' },
  { row: 7, col: 1, type: 'N', color: 'white' },
  { row: 7, col: 2, type: 'B', color: 'white' },
  { row: 7, col: 3, type: 'Q', color: 'white' },
  { row: 7, col: 4, type: 'K', color: 'white' },
  { row: 7, col: 5, type: 'B', color: 'white' },
  { row: 7, col: 6, type: 'N', color: 'white' },
  { row: 7, col: 7, type: 'R', color: 'white' },
];

const PIECE_UNICODE: Record<string, { white: string; black: string }> = {
  K: { white: '♔', black: '♚' },
  Q: { white: '♕', black: '♛' },
  R: { white: '♖', black: '♜' },
  B: { white: '♗', black: '♝' },
  N: { white: '♘', black: '♞' },
  P: { white: '♙', black: '♟' },
};

function createPieceTexture(symbol: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);
  ctx.font = 'bold 80px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillText(symbol, 66, 66);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(symbol, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export default function ChessBoard3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);

  // Drag rotation state
  const isDragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const rotY = useRef(0.3);          // current Y rotation (horizontal spin)
  const rotX = useRef(-0.22);        // current X rotation (vertical tilt)
  const velY = useRef(0);            // inertia velocity Y
  const velX = useRef(0);            // inertia velocity X

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    // ── Scene ─────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    // Very light fog so board stays visible
    scene.fog = new THREE.FogExp2(0x050810, 0.035);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 7.5, 11);
    camera.lookAt(0, 0.5, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.6;
    mount.appendChild(renderer.domElement);

    // ── Lighting ─────────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0xffffff, 3.0);
    scene.add(ambient);

    const topLight = new THREE.SpotLight(0xdfb75c, 10);
    topLight.position.set(0, 14, 4);
    topLight.angle = Math.PI / 3.5;
    topLight.penumbra = 0.5;
    topLight.castShadow = true;
    topLight.shadow.mapSize.set(2048, 2048);
    scene.add(topLight);

    const frontLight = new THREE.DirectionalLight(0xfff8e7, 4.0);
    frontLight.position.set(0, 6, 12);
    scene.add(frontLight);

    const rimLight1 = new THREE.PointLight(0x4a6fe8, 5, 28);
    rimLight1.position.set(-9, 5, -2);
    scene.add(rimLight1);

    const rimLight2 = new THREE.PointLight(0x8c4ae8, 4.5, 28);
    rimLight2.position.set(9, 5, -2);
    scene.add(rimLight2);

    // ── Board Group ───────────────────────────────────────────────
    const boardGroup = new THREE.Group();
    scene.add(boardGroup);

    // Base
    const baseGeo = new THREE.BoxGeometry(8.8, 0.3, 8.8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1a0e05, roughness: 0.4, metalness: 0.6 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -0.15;
    base.receiveShadow = true;
    boardGroup.add(base);

    // Gold border
    const borderGeo = new THREE.BoxGeometry(9.3, 0.26, 9.3);
    const borderMat = new THREE.MeshStandardMaterial({ color: 0xb8860b, roughness: 0.25, metalness: 0.9 });
    const border = new THREE.Mesh(borderGeo, borderMat);
    border.position.y = -0.13;
    boardGroup.add(border);

    // Squares
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xf0d9b5, roughness: 0.65, metalness: 0.0 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x3d6b50, roughness: 0.55, metalness: 0.1 });

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const isLight = (row + col) % 2 === 0;
        const geo = new THREE.BoxGeometry(1, 0.08, 1);
        const mesh = new THREE.Mesh(geo, isLight ? lightMat : darkMat);
        mesh.position.set(col - 3.5, 0.04, row - 3.5);
        mesh.receiveShadow = true;
        boardGroup.add(mesh);
      }
    }

    // Chess pieces
    const pieceTextures = new Map<string, THREE.CanvasTexture>();

    PIECES.forEach(({ row, col, type, color }) => {
      const symbol = PIECE_UNICODE[type][color];
      if (!pieceTextures.has(symbol)) {
        pieceTextures.set(symbol, createPieceTexture(symbol));
      }
      const tex = pieceTextures.get(symbol)!;

      const isKingOrQueen = type === 'K' || type === 'Q';
      const h = isKingOrQueen ? 0.9 : type === 'R' ? 0.7 : type === 'P' ? 0.45 : 0.65;
      const r = type === 'P' ? 0.18 : 0.21;

      const geo = new THREE.CylinderGeometry(r * 0.68, r, h, 16);
      const mat = new THREE.MeshStandardMaterial({
        color: color === 'white' ? 0xf0e8d8 : 0x2a1f0f,
        roughness: 0.28,
        metalness: 0.45,
      });
      const piece = new THREE.Mesh(geo, mat);
      piece.position.set(col - 3.5, h / 2 + 0.08, row - 3.5);
      piece.castShadow = true;

      const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(0.55, 0.55, 0.55);
      sprite.position.set(col - 3.5, h + 0.18, row - 3.5);

      boardGroup.add(piece);
      boardGroup.add(sprite);
    });

    // Particles
    const particleCount = 50;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 18;
      positions[i * 3 + 1] = Math.random() * 8 - 1;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 18;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({ color: 0xdfb75c, size: 0.05, transparent: true, opacity: 0.55, sizeAttenuation: true });
    scene.add(new THREE.Points(particleGeo, particleMat));

    // ── Drag / Touch Controls ────────────────────────────────────
    const onPointerDown = (e: PointerEvent) => {
      isDragging.current = true;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      velY.current = 0;
      velX.current = 0;
      mount.style.cursor = 'grabbing';
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      // accumulate velocity for inertia
      velY.current = dx * 0.012;
      velX.current = dy * 0.008;
      rotY.current += dx * 0.012;
      rotX.current += dy * 0.008;
      // clamp X so board doesn't flip fully upside down
      rotX.current = Math.max(-Math.PI / 2.2, Math.min(0.4, rotX.current));
      lastPointer.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = () => {
      isDragging.current = false;
      mount.style.cursor = 'grab';
    };

    mount.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // ── Resize ───────────────────────────────────────────────────
    const handleResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    // ── Animation ────────────────────────────────────────────────
    let clock = 0;

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      clock += 0.008;

      if (!isDragging.current) {
        // Auto slow spin when idle
        rotY.current += 0.003;
        // Apply inertia and decay
        velY.current *= 0.92;
        velX.current *= 0.92;
        rotY.current += velY.current;
        rotX.current += velX.current;
        rotX.current = Math.max(-Math.PI / 2.2, Math.min(0.4, rotX.current));
      }

      boardGroup.rotation.y = rotY.current;
      boardGroup.rotation.x = rotX.current;
      // Subtle float
      boardGroup.position.y = Math.sin(clock) * 0.08;

      // Particle drift
      const pos = particleGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        pos[i * 3 + 1] += 0.005;
        if (pos[i * 3 + 1] > 7) pos[i * 3 + 1] = -1;
      }
      particleGeo.attributes.position.needsUpdate = true;

      // Rim light pulse
      rimLight1.intensity = 5 + Math.sin(clock * 1.5) * 0.8;
      rimLight2.intensity = 4.5 + Math.cos(clock * 1.3) * 0.8;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameRef.current);
      mount.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      pieceTextures.forEach(t => t.dispose());
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="w-full h-full"
      style={{ cursor: 'grab', minHeight: 400, touchAction: 'none' }}
    />
  );
}
