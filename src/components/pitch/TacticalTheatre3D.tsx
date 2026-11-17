import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type {
  CameraPreset,
  OverlayVisibility,
  PlayerNode,
  TacticalEdge,
  TacticalSnapshot,
} from '../../types/tactical';
import { areKitColorsClose, liftHexLuminance } from '../common/FootballMotifs';
import {
  CAMERA_PRESETS,
  PITCH_LENGTH_3D,
  PITCH_WIDTH_3D,
  canonicalToWorld3D,
} from './pitchCoords';

interface TacticalTheatre3DProps {
  snapshot: TacticalSnapshot;
  awaySnapshot?: TacticalSnapshot | null;
  homeColor?: string;
  awayColor?: string;
  flipDirection?: boolean;
  cameraPreset: CameraPreset;
  cameraRequestTick: number;
  overlays: OverlayVisibility;
  isPlaying: boolean;
  speed: number;
  selectedPlayerId: string | null;
  selectedEdgeIndex: number | null;
  onSelectPlayer: (player: PlayerNode | null, teamSide: 'home' | 'away') => void;
  onSelectEdge: (edge: TacticalEdge | null, index: number | null) => void;
  mismatchZones?: Array<{
    id: string;
    title: string;
    zone: { x1: number; y1: number; x2: number; y2: number };
    evidence_tag: string;
  }>;
  isSoftwareGl: boolean;
  onWebglContextLost: () => void;
  introActive?: boolean;
}

// Reusable scratch objects to prevent GC allocations inside useFrame
const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _vTarget = new THREE.Vector3();

function createTurfTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const stripes = 12;
  const sw = canvas.width / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#1A5E4B' : '#154F3E';
    ctx.fillRect(i * sw, 0, sw, canvas.height);
  }

  // Subtle organic turf grain
  ctx.fillStyle = 'rgba(255,255,255,0.018)';
  for (let i = 0; i < 2400; i++) {
    const x = (i * 97) % canvas.width;
    const y = (i * 53) % canvas.height;
    ctx.fillRect(x, y, 2, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function createNumberDiscTexture(num: number, colorHex: string, isAway: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#141E28';
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(64, 64, 52, 0, Math.PI * 2);
  ctx.stroke();

  if (isAway) {
    ctx.fillStyle = colorHex;
    ctx.fillRect(57, 14, 14, 10);
  }

  ctx.fillStyle = '#F4F7F5';
  ctx.font = '700 46px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(num), 64, 67);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createNameplateTexture(label: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 64);

  ctx.fillStyle = 'rgba(20, 30, 40, 0.92)';
  ctx.beginPath();
  ctx.roundRect(14, 10, 228, 44, 12);
  ctx.fill();

  ctx.strokeStyle = 'rgba(248, 250, 252, 0.22)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '600 24px "DM Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label.slice(0, 14), 128, 33);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function SceneEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();
    return () => {
      envTex.dispose();
      scene.environment = null;
    };
  }, [gl, scene]);
  return null;
}

function PitchSurface() {
  const { gl } = useThree();
  const turfTexture = useMemo(
    () => createTurfTexture(gl.capabilities.getMaxAnisotropy()),
    [gl],
  );

  useEffect(() => () => turfTexture.dispose(), [turfTexture]);

  const halfL = PITCH_LENGTH_3D / 2;
  const halfW = PITCH_WIDTH_3D / 2;
  const lineY = 0.015;

  // Pitch line geometry builder
  const linesGeometry = useMemo(() => {
    const pts: number[] = [];
    const addSeg = (x1: number, z1: number, x2: number, z2: number) => {
      pts.push(x1, lineY, z1, x2, lineY, z2);
    };
    const addRect = (x1: number, z1: number, x2: number, z2: number) => {
      addSeg(x1, z1, x2, z1);
      addSeg(x2, z1, x2, z2);
      addSeg(x2, z2, x1, z2);
      addSeg(x1, z2, x1, z1);
    };

    // Outer boundary & halfway line
    addRect(-halfL, -halfW, halfL, halfW);
    addSeg(0, -halfW, 0, halfW);

    // Center circle
    const cSegs = 48;
    const cRad = 1.83;
    for (let i = 0; i < cSegs; i++) {
      const a1 = (i / cSegs) * Math.PI * 2;
      const a2 = ((i + 1) / cSegs) * Math.PI * 2;
      addSeg(Math.cos(a1) * cRad, Math.sin(a1) * cRad, Math.cos(a2) * cRad, Math.sin(a2) * cRad);
    }

    // Left & right penalty boxes (16.5m x 40.3m scaled by 0.2)
    const boxL = 3.3;
    const boxHalfW = 4.03;
    addRect(-halfL, -boxHalfW, -halfL + boxL, boxHalfW);
    addRect(halfL - boxL, -boxHalfW, halfL, boxHalfW);

    // 6-yard boxes
    const sixL = 1.1;
    const sixHalfW = 1.83;
    addRect(-halfL, -sixHalfW, -halfL + sixL, sixHalfW);
    addRect(halfL - sixL, -sixHalfW, halfL, sixHalfW);

    // Penalty arcs
    for (let i = 0; i < 20; i++) {
      const a1 = -0.92 + (i / 20) * 1.84;
      const a2 = -0.92 + ((i + 1) / 20) * 1.84;
      addSeg(-halfL + 2.2 + Math.cos(a1) * cRad, Math.sin(a1) * cRad, -halfL + 2.2 + Math.cos(a2) * cRad, Math.sin(a2) * cRad);
      addSeg(halfL - 2.2 - Math.cos(a1) * cRad, Math.sin(a1) * cRad, halfL - 2.2 - Math.cos(a2) * cRad, Math.sin(a2) * cRad);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, [halfL, halfW]);

  useEffect(() => () => linesGeometry.dispose(), [linesGeometry]);

  return (
    <group>
      {/* Stadium outer surround apron */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[36, 26]} />
        <meshStandardMaterial color="#141E28" roughness={0.92} metalness={0.08} />
      </mesh>

      {/* Main mowed pitch */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[PITCH_LENGTH_3D, PITCH_WIDTH_3D]} />
        <meshStandardMaterial map={turfTexture} roughness={0.82} metalness={0.04} />
      </mesh>

      {/* Pitch vector line markings */}
      <lineSegments geometry={linesGeometry}>
        <lineBasicMaterial color="#9AEAC4" transparent opacity={0.95} />
      </lineSegments>

      {/* Center spot & corner flags */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, lineY, 0]}>
        <circleGeometry args={[0.13, 16]} />
        <meshBasicMaterial color="#63E6A5" />
      </mesh>

      {[
        [-halfL, -halfW],
        [-halfL, halfW],
        [halfL, -halfW],
        [halfL, halfW],
      ].map(([cx, cz], idx) => (
        <group key={`flag-${idx}`} position={[cx, 0, cz]}>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
            <meshStandardMaterial color="#F8FAFC" />
          </mesh>
          <mesh position={[0.08, 0.44, 0]}>
            <boxGeometry args={[0.16, 0.11, 0.015]} />
            <meshBasicMaterial color="#FBBF24" />
          </mesh>
        </group>
      ))}

      {/* Stadium Corner Floodlight Pylons */}
      {[
        [-halfL - 2.6, -halfW - 2.2],
        [-halfL - 2.6, halfW + 2.2],
        [halfL + 2.6, -halfW - 2.2],
        [halfL + 2.6, halfW + 2.2],
      ].map(([fx, fz], idx) => (
        <group key={`flood-${idx}`} position={[fx, 0, fz]}>
          <mesh position={[0, 2.2, 0]}>
            <cylinderGeometry args={[0.07, 0.12, 4.4, 8]} />
            <meshStandardMaterial color="#1E293B" metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[0, 4.4, 0]}>
            <boxGeometry args={[0.65, 0.35, 0.18]} />
            <meshBasicMaterial color="#FEF3C7" />
          </mesh>
        </group>
      ))}

      {/* 3D Goals */}
      {[-1, 1].map((side) => {
        const gx = side * halfL;
        const postX = gx + side * 0.25;
        return (
          <group key={side} position={[gx, 0, 0]}>
            <mesh position={[0, 0.35, -0.73]}>
              <cylinderGeometry args={[0.035, 0.035, 0.7, 10]} />
              <meshStandardMaterial color="#F8FAFC" roughness={0.25} metalness={0.7} />
            </mesh>
            <mesh position={[0, 0.35, 0.73]}>
              <cylinderGeometry args={[0.035, 0.035, 0.7, 10]} />
              <meshStandardMaterial color="#F8FAFC" roughness={0.25} metalness={0.7} />
            </mesh>
            <mesh position={[0, 0.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.035, 0.035, 1.49, 10]} />
              <meshStandardMaterial color="#F8FAFC" roughness={0.25} metalness={0.7} />
            </mesh>
            <mesh position={[postX - gx, 0.34, 0]}>
              <boxGeometry args={[0.5, 0.68, 1.44]} />
              <meshBasicMaterial color="#9AEAC4" wireframe transparent opacity={0.28} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

interface CompositePlayerTokenProps {
  player: PlayerNode;
  targetX: number;
  targetZ: number;
  color: string;
  isAway: boolean;
  isSelected: boolean;
  isPlaying: boolean;
  speed: number;
  onSelect: () => void;
}

const CompositePlayerToken: React.FC<CompositePlayerTokenProps> = ({
  player,
  targetX,
  targetZ,
  color,
  isAway,
  isSelected,
  isPlaying,
  speed,
  onSelect,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const initialized = useRef(false);

  const ringColor = liftHexLuminance(color, 0.25);
  const badgeTex = useMemo(
    () => createNumberDiscTexture(player.shirt_number, ringColor, isAway),
    [player.shirt_number, ringColor, isAway],
  );
  const nameTex = useMemo(
    () => createNameplateTexture(player.short_name),
    [player.short_name],
  );

  useEffect(() => {
    return () => {
      badgeTex.dispose();
      nameTex.dispose();
    };
  }, [badgeTex, nameTex]);

  useFrame((_, delta) => {
    const grp = groupRef.current;
    if (!grp) return;
    if (!initialized.current) {
      grp.position.set(targetX, 0, targetZ);
      initialized.current = true;
      return;
    }
    const dt = Math.min(0.05, delta) * (isPlaying ? speed : 1.0);
    const lambda = 6.5;
    grp.position.x = THREE.MathUtils.damp(grp.position.x, targetX, lambda, dt);
    grp.position.z = THREE.MathUtils.damp(grp.position.z, targetZ, lambda, dt);

    if (ringRef.current) {
      const targetScale = isSelected ? 1.24 : 1.0;
      ringRef.current.scale.x = THREE.MathUtils.damp(ringRef.current.scale.x, targetScale, 8, dt);
      ringRef.current.scale.y = THREE.MathUtils.damp(ringRef.current.scale.y, targetScale, 8, dt);
    }
  });

  const isOut = player.status === 'UNAVAILABLE';
  const nodeOpacity = isOut ? 0.42 : 1.0;

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={() => {
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
    >
      {/* 1. Grounded contact shadow disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
        <circleGeometry args={[0.48, 24]} />
        <meshBasicMaterial color="#02050A" transparent opacity={0.55} depthWrite={false} />
      </mesh>

      {/* 2. Luminous outer tactical selection ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <ringGeometry args={[0.36, 0.46, 28]} />
        <meshBasicMaterial
          color={isSelected ? '#63E6A5' : isOut ? '#F87171' : ringColor}
          transparent
          opacity={isSelected ? 0.96 : 0.85}
        />
      </mesh>

      {/* 3. Twin football boots / stance base */}
      <mesh position={[-0.10, 0.07, 0]}>
        <boxGeometry args={[0.13, 0.12, 0.18]} />
        <meshStandardMaterial color="#0F172A" roughness={0.5} metalness={0.3} transparent={isOut} opacity={nodeOpacity} />
      </mesh>
      <mesh position={[0.10, 0.07, 0]}>
        <boxGeometry args={[0.13, 0.12, 0.18]} />
        <meshStandardMaterial color="#0F172A" roughness={0.5} metalness={0.3} transparent={isOut} opacity={nodeOpacity} />
      </mesh>

      {/* 4. Sculpted team-colored football jersey torso & shoulders */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.25, 0.20, 0.26, 20]} />
        <meshStandardMaterial
          color={isOut ? '#F87171' : color}
          roughness={0.42}
          metalness={0.18}
          transparent={isOut}
          opacity={nodeOpacity}
        />
      </mesh>
      {/* Jersey shoulder sleeves */}
      <mesh position={[-0.24, 0.30, 0]} rotation={[0, 0, 0.4]}>
        <cylinderGeometry args={[0.07, 0.07, 0.16, 12]} />
        <meshStandardMaterial color={isOut ? '#F87171' : color} roughness={0.45} transparent={isOut} opacity={nodeOpacity} />
      </mesh>
      <mesh position={[0.24, 0.30, 0]} rotation={[0, 0, -0.4]}>
        <cylinderGeometry args={[0.07, 0.07, 0.16, 12]} />
        <meshStandardMaterial color={isOut ? '#F87171' : color} roughness={0.45} transparent={isOut} opacity={nodeOpacity} />
      </mesh>

      {/* 5. Character Head & Top Shirt-Number Emblem Disc */}
      <mesh position={[0, 0.46, 0]}>
        <sphereGeometry args={[0.125, 18, 18]} />
        <meshStandardMaterial color="#E2E8F0" roughness={0.35} metalness={0.15} transparent={isOut} opacity={nodeOpacity} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.39, 0.24]}>
        <circleGeometry args={[0.18, 20]} />
        <meshBasicMaterial map={badgeTex} transparent opacity={nodeOpacity} />
      </mesh>

      {/* 6. Crisp billboard nameplate */}
      <sprite position={[0, 0.78, 0]} scale={[1.42, 0.355, 1]}>
        <spriteMaterial map={nameTex} transparent depthTest={false} />
      </sprite>
    </group>
  );
};

interface TacticalEdge3DProps {
  fromPos: [number, number];
  toPos: [number, number];
  edge: TacticalEdge;
  isSelected: boolean;
  isPlaying: boolean;
  speed: number;
  onSelect: () => void;
}

const TacticalEdge3D: React.FC<TacticalEdge3DProps> = ({
  fromPos,
  toPos,
  edge,
  isSelected,
  isPlaying,
  speed,
  onSelect,
}) => {
  const particleRef = useRef<THREE.Mesh>(null);
  const progressRef = useRef(0);

  const curve = useMemo(() => {
    const p0 = new THREE.Vector3(fromPos[0], 0.18, fromPos[1]);
    const p2 = new THREE.Vector3(toPos[0], 0.18, toPos[1]);
    const mid = p0.clone().add(p2).multiplyScalar(0.5);
    mid.y += edge.type === 'pass' ? 0.52 : 0.22;
    return new THREE.QuadraticBezierCurve3(p0, mid, p2);
  }, [fromPos[0], fromPos[1], toPos[0], toPos[1], edge.type]);

  const tubeGeo = useMemo(
    () => new THREE.TubeGeometry(curve, 24, isSelected ? 0.055 : 0.034, 8, false),
    [curve, isSelected],
  );

  useEffect(() => () => tubeGeo.dispose(), [tubeGeo]);

  useFrame((_, delta) => {
    if (!particleRef.current || !isPlaying || edge.type !== 'pass') return;
    progressRef.current = (progressRef.current + Math.min(0.05, delta) * 0.55 * speed) % 1.0;
    curve.getPointAt(progressRef.current, _vA);
    particleRef.current.position.copy(_vA);
  });

  const color =
    edge.type === 'press'
      ? '#F87171'
      : edge.type === 'rest_defense'
      ? '#63E6A5'
      : '#7DD3FC';

  return (
    <group>
      <mesh
        geometry={tubeGeo}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.85 : 0.35}
          transparent
          opacity={isSelected ? 0.95 : 0.72}
          roughness={0.3}
        />
      </mesh>
      {edge.type === 'pass' && (
        <mesh ref={particleRef} position={[fromPos[0], 0.18, fromPos[1]]} rotation={[0.4, 0.6, 0]}>
          <icosahedronGeometry args={[0.13, 1]} />
          <meshStandardMaterial color="#FFFFFF" emissive="#63E6A5" emissiveIntensity={0.28} roughness={0.25} />
        </mesh>
      )}
    </group>
  );
};

interface CameraRigProps {
  preset: CameraPreset;
  requestTick: number;
  introActive: boolean;
  isSoftwareGl: boolean;
}

const CameraRig: React.FC<CameraRigProps> = ({ preset, requestTick, introActive, isSoftwareGl }) => {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const animatingRef = useRef(true);
  const lastPresetRef = useRef(`${preset}-${requestTick}`);

  useEffect(() => {
    lastPresetRef.current = `${preset}-${requestTick}`;
    animatingRef.current = true;
  }, [preset, requestTick]);

  useFrame((_, delta) => {
    if (!animatingRef.current || !controlsRef.current) return;
    const cfg = CAMERA_PRESETS[preset];
    const targetPos = introActive ? [0, 17, 21] : cfg.position;
    _vA.set(targetPos[0], targetPos[1], targetPos[2]);
    _vB.set(cfg.target[0], cfg.target[1], cfg.target[2]);

    const dt = Math.min(0.05, delta);
    const lambda = 4.2;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, _vA.x, lambda, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, _vA.y, lambda, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, _vA.z, lambda, dt);

    const t = controlsRef.current.target;
    _vTarget.set(
      THREE.MathUtils.damp(t.x, _vB.x, lambda, dt),
      THREE.MathUtils.damp(t.y, _vB.y, lambda, dt),
      THREE.MathUtils.damp(t.z, _vB.z, lambda, dt),
    );
    controlsRef.current.target.copy(_vTarget);
    controlsRef.current.update();

    if (camera.position.distanceTo(_vA) < 0.04 && t.distanceTo(_vB) < 0.04) {
      animatingRef.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping={!isSoftwareGl}
      dampingFactor={0.07}
      minDistance={6}
      maxDistance={28}
      minPolarAngle={0.06}
      maxPolarAngle={Math.PI / 2.15}
      onStart={() => {
        animatingRef.current = false;
      }}
    />
  );
}

export const TacticalTheatre3D: React.FC<TacticalTheatre3DProps> = ({
  snapshot,
  awaySnapshot,
  homeColor = '#7DD3FC',
  awayColor = '#F87171',
  flipDirection = false,
  cameraPreset,
  cameraRequestTick,
  overlays,
  isPlaying,
  speed,
  selectedPlayerId,
  selectedEdgeIndex,
  onSelectPlayer,
  onSelectEdge,
  mismatchZones = [],
  isSoftwareGl,
  onWebglContextLost,
  introActive = false,
}) => {
  const safeHomeColor = liftHexLuminance(homeColor, 0.24);
  const rawAwayVisible = liftHexLuminance(awayColor, 0.24);
  const safeAwayColor = areKitColorsClose(safeHomeColor, rawAwayVisible)
    ? areKitColorsClose(safeHomeColor, '#F87171')
      ? '#7DD3FC'
      : '#F87171'
    : rawAwayVisible;

  const playerCoords = useMemo(() => {
    const map = new Map<string, [number, number]>();
    snapshot.players.forEach((p) => {
      map.set(p.id, canonicalToWorld3D(p.x, p.y, flipDirection));
    });
    return map;
  }, [snapshot.players, flipDirection]);

  useEffect(() => {
    return () => {
      document.body.style.cursor = 'default';
    };
  }, []);

  const awayCoords = useMemo(() => {
    const map = new Map<string, [number, number]>();
    awaySnapshot?.players.forEach((p) => {
      map.set(p.id, canonicalToWorld3D(p.x, p.y, !flipDirection));
    });
    return map;
  }, [awaySnapshot, flipDirection]);

  // Defensive compactness polygon geometry
  const compactnessGeo = useMemo(() => {
    if (!overlays.compactness) return null;
    const z = snapshot.zones.find((zn) => zn.type === 'compactness' && zn.player_ids?.length);
    if (!z || !z.player_ids) return null;
    const pts = z.player_ids
      .map((pid) => playerCoords.get(pid))
      .filter((v): v is [number, number] => Boolean(v));
    if (pts.length < 3) return null;

    // Sort radially around centroid so triangle fan never self-intersects
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const sorted = [...pts].sort((a, b) => Math.atan2(a[1] - cz, a[0] - cx) - Math.atan2(b[1] - cz, b[0] - cx));

    const verts: number[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const p1 = sorted[i];
      const p2 = sorted[(i + 1) % sorted.length];
      verts.push(cx, 0.032, cz, p1[0], 0.032, p1[1], p2[0], 0.032, p2[1]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    return geo;
  }, [overlays.compactness, snapshot.zones, playerCoords]);

  useEffect(() => () => compactnessGeo?.dispose(), [compactnessGeo]);

  return (
    <div className="w-full h-full relative rounded-xl overflow-hidden bg-[#0D131A]">
      <Canvas
        dpr={isSoftwareGl ? 1 : [1, 1.75]}
        camera={{ position: CAMERA_PRESETS.broadcast.position, fov: 42, near: 0.2, far: 120 }}
        gl={{
          antialias: !isSoftwareGl,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.08,
        }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            onWebglContextLost();
          });
        }}
        onPointerMissed={() => {
          onSelectPlayer(null, 'home');
          onSelectEdge(null, null);
        }}
      >
        <color attach="background" args={['#0D131A']} />
        <fog attach="fog" args={['#0D131A', 30, 68]} />

        <SceneEnvironment />
        <hemisphereLight args={['#CBD5E1', '#122E26', 0.92]} />
        <directionalLight position={[12, 18, 10]} intensity={1.55} color="#FFF4D6" />
        <directionalLight position={[-14, 12, -10]} intensity={0.62} color="#7DD3FC" />

        <PitchSurface />

        {/* Half-space, Rest-Defense, Press-Trap, and Manager Clash Mismatch Overlays */}
        {snapshot.zones.map((z) => {
          if (z.x1 === undefined || z.y1 === undefined || z.x2 === undefined || z.y2 === undefined) return null;
          if (z.type === 'half_space' && !overlays.halfSpaces) return null;
          if (z.type === 'rest_defense' && !overlays.restDefense) return null;
          if (z.type === 'press_trap' && !overlays.pressing) return null;
          const [wx1, wz1] = canonicalToWorld3D(z.x1, z.y1, flipDirection);
          const [wx2, wz2] = canonicalToWorld3D(z.x2, z.y2, flipDirection);
          const cx = (wx1 + wx2) / 2;
          const cz = (wz1 + wz2) / 2;
          const sx = Math.abs(wx2 - wx1);
          const sz = Math.abs(wz2 - wz1);
          const col = z.type === 'press_trap' ? '#F87171' : z.type === 'rest_defense' ? '#63E6A5' : '#7DD3FC';
          return (
            <mesh key={z.id} rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.028, cz]}>
              <planeGeometry args={[sx, sz]} />
              <meshBasicMaterial color={col} transparent opacity={0.14} depthWrite={false} />
            </mesh>
          );
        })}

        {mismatchZones.map((mm) => {
          const [wx1, wz1] = canonicalToWorld3D(mm.zone.x1, mm.zone.y1, flipDirection);
          const [wx2, wz2] = canonicalToWorld3D(mm.zone.x2, mm.zone.y2, flipDirection);
          return (
            <mesh
              key={mm.id}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[(wx1 + wx2) / 2, 0.036, (wz1 + wz2) / 2]}
            >
              <planeGeometry args={[Math.abs(wx2 - wx1), Math.abs(wz2 - wz1)]} />
              <meshBasicMaterial color="#63E6A5" transparent opacity={0.18} depthWrite={false} />
            </mesh>
          );
        })}

        {compactnessGeo && (
          <mesh geometry={compactnessGeo}>
            <meshBasicMaterial color={safeHomeColor} transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        )}

        {/* Tactical Edges */}
        {snapshot.edges.map((edge, idx) => {
          if ((edge.type === 'pass' || edge.type === 'overlap') && !overlays.passing) return null;
          if ((edge.type === 'press' || edge.type === 'cover') && !overlays.pressing) return null;
          if (edge.type === 'rest_defense' && !overlays.restDefense) return null;
          const pFrom = playerCoords.get(edge.from);
          const pTo = playerCoords.get(edge.to);
          if (!pFrom || !pTo) return null;
          return (
            <TacticalEdge3D
              key={`${edge.from}-${edge.to}-${idx}`}
              fromPos={pFrom}
              toPos={pTo}
              edge={edge}
              isSelected={selectedEdgeIndex === idx}
              isPlaying={isPlaying}
              speed={speed}
              onSelect={() => onSelectEdge(edge, idx)}
            />
          );
        })}

        {/* Home / Primary 11 Players */}
        {snapshot.players.map((p) => {
          const pos = playerCoords.get(p.id) || [0, 0];
          return (
            <CompositePlayerToken
              key={p.id}
              player={p}
              targetX={pos[0]}
              targetZ={pos[1]}
              color={safeHomeColor}
              isAway={false}
              isSelected={selectedPlayerId === p.id}
              isPlaying={isPlaying}
              speed={speed}
              onSelect={() => onSelectPlayer(p, 'home')}
            />
          );
        })}

        {/* Optional Away 11 Players (Manager vs Manager shared pitch) */}
        {awaySnapshot?.players.map((p) => {
          const pos = awayCoords.get(p.id) || [0, 0];
          return (
            <CompositePlayerToken
              key={p.id}
              player={p}
              targetX={pos[0]}
              targetZ={pos[1]}
              color={safeAwayColor}
              isAway={true}
              isSelected={selectedPlayerId === p.id}
              isPlaying={isPlaying}
              speed={speed}
              onSelect={() => onSelectPlayer(p, 'away')}
            />
          );
        })}

        <CameraRig
          preset={cameraPreset}
          requestTick={cameraRequestTick}
          introActive={introActive}
          isSoftwareGl={isSoftwareGl}
        />
      </Canvas>
    </div>
  );
};
