import { useRef, useMemo, Suspense, useLayoutEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Html, RoundedBox, ContactShadows, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { STATUS_COLORS, STATUS_LABEL, deskPosition, MEETING_TABLE, MEETING_SEATS, WANDER_ZONE } from "../../lib/office";

const WALK_SPEED = 2.4;
const OFFICE_MODEL_URL = "/models/office_hq.glb";

/* ---------------- Imported office environment (user GLB) ---------------- */
function OfficeModel({ url }) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  useLayoutEffect(() => {
    cloned.updateMatrixWorld(true);
    cloned.traverse((o) => {
      if (o.isMesh && o.geometry) {
        o.geometry.computeBoundingBox();
        o.receiveShadow = true;
        o.castShadow = true;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (!m) return;
          if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
          m.envMapIntensity = 1.0;
          m.needsUpdate = true;
        });
      }
    });
    let box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const s = 30 / Math.max(size.x, size.z || 1);
    cloned.scale.multiplyScalar(isFinite(s) && s > 0 ? s : 1);
    cloned.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(cloned);
    const c = box.getCenter(new THREE.Vector3());
    cloned.position.x -= c.x;
    cloned.position.z -= c.z;
    cloned.position.y -= box.min.y;
  }, [cloned]);
  return <primitive object={cloned} />;
}
useGLTF.preload(OFFICE_MODEL_URL);

/* ---------------- Heads ---------------- */
function HumanHead({ avatar = {} }) {
  const skin = avatar.skinTone || "#e8b58f";
  const hair = avatar.hairColor || "#2b2b2b";
  const style = avatar.hairStyle || "short";
  return (
    <group position={[0, 1.15, 0]}>
      <mesh castShadow><sphereGeometry args={[0.23, 24, 24]} /><meshStandardMaterial color={skin} roughness={0.55} /></mesh>
      {style !== "bald" && (
        <mesh position={[0, 0.08, style === "long" ? -0.02 : 0]}>
          <sphereGeometry args={[style === "curly" ? 0.26 : 0.245, 20, 20, 0, Math.PI * 2, 0, Math.PI * (style === "long" ? 0.9 : 0.62)]} />
          <meshStandardMaterial color={hair} roughness={0.95} />
        </mesh>
      )}
      {avatar.facialHair === "beard" && (
        <mesh position={[0, -0.11, 0.14]}><sphereGeometry args={[0.16, 16, 16, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45]} /><meshStandardMaterial color={hair} /></mesh>
      )}
      {/* eyes */}
      <mesh position={[0.08, 0.02, 0.2]}><sphereGeometry args={[0.03, 10, 10]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
      <mesh position={[-0.08, 0.02, 0.2]}><sphereGeometry args={[0.03, 10, 10]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
      {avatar.accessory === "glasses" && (
        <mesh position={[0, 0.02, 0.21]}><boxGeometry args={[0.32, 0.06, 0.02]} /><meshStandardMaterial color="#111" /></mesh>
      )}
      {avatar.accessory === "headphones" && (
        <mesh position={[0, 0.12, 0]}><torusGeometry args={[0.25, 0.035, 8, 24, Math.PI]} /><meshStandardMaterial color="#111" /></mesh>
      )}
    </group>
  );
}

function AiHead({ avatar = {}, working }) {
  const body = avatar.bodyColor || "#00E599";
  return (
    <group position={[0, 1.16, 0]}>
      <RoundedBox args={[0.42, 0.36, 0.36]} radius={0.12} smoothness={4} castShadow>
        <meshStandardMaterial color="#0e0e12" metalness={0.7} roughness={0.22} />
      </RoundedBox>
      <mesh position={[0, 0.01, 0.19]}><boxGeometry args={[0.3, 0.13, 0.02]} />
        <meshStandardMaterial color={body} emissive={body} emissiveIntensity={working ? 1.8 : 0.9} toneMapped={false} /></mesh>
      {avatar.antenna !== false && (
        <group position={[0, 0.22, 0]}>
          <mesh><cylinderGeometry args={[0.015, 0.015, 0.16, 8]} /><meshStandardMaterial color="#555" /></mesh>
          <mesh position={[0, 0.11, 0]}><sphereGeometry args={[0.045, 12, 12]} />
            <meshStandardMaterial color={body} emissive={body} emissiveIntensity={1.6} toneMapped={false} /></mesh>
        </group>
      )}
    </group>
  );
}

/* ---------------- Movable person ---------------- */
function Person({ emp, mode, target, home, facePoint, selected, onSelect, bubble }) {
  const root = useRef();       // world position group
  const inner = useRef();      // vertical (sit) offset
  const legL = useRef();
  const legR = useRef();
  const pos = useRef(new THREE.Vector3(home.x, 0, home.z));
  const wander = useRef({ target: new THREE.Vector3(home.x, 0, home.z), next: 0 });
  const isAi = emp.type === "ai";
  const accent = isAi ? (emp.avatar?.bodyColor || "#00E599") : (emp.avatar?.shirtColor || "#FF6B35");
  const shirt = isAi ? "#1b1b22" : (emp.avatar?.shirtColor || "#3B82F6");
  const legColor = isAi ? "#26262c" : "#2b2f3a";

  useFrame((state, delta) => {
    if (!root.current) return;
    const now = state.clock.elapsedTime;
    let tx = home.x, tz = home.z;
    let wantSit = false, faceMode = "desk";

    if (mode === "meeting") { tx = target.x; tz = target.z; wantSit = true; faceMode = "point"; }
    else if (mode === "talk") { tx = target.x; tz = target.z; wantSit = false; faceMode = "point"; }
    else if (mode === "work") { tx = home.x; tz = home.z; wantSit = true; faceMode = "desk"; }
    else { // idle -> wander
      const w = wander.current;
      const arrivedW = Math.hypot(pos.current.x - w.target.x, pos.current.z - w.target.z) < 0.15;
      if (now > w.next && arrivedW) {
        if (Math.random() < 0.6) {
          w.target.set(
            WANDER_ZONE.minX + Math.random() * (WANDER_ZONE.maxX - WANDER_ZONE.minX),
            0,
            WANDER_ZONE.minZ + Math.random() * (WANDER_ZONE.maxZ - WANDER_ZONE.minZ)
          );
        } else { w.target.set(home.x, 0, home.z); }
        w.next = now + 3 + Math.random() * 5;
      }
      tx = w.target.x; tz = w.target.z; wantSit = false; faceMode = "travel";
    }

    // move
    const dx = tx - pos.current.x, dz = tz - pos.current.z;
    const dist = Math.hypot(dx, dz);
    const walking = dist > 0.12;
    if (walking) {
      const step = Math.min(WALK_SPEED * delta, dist);
      pos.current.x += (dx / dist) * step;
      pos.current.z += (dz / dist) * step;
    }
    root.current.position.x = pos.current.x;
    root.current.position.z = pos.current.z;

    // rotation
    let ry = root.current.rotation.y;
    if (walking) ry = Math.atan2(dx, dz);
    else if (faceMode === "desk") ry = Math.PI;
    else if (faceMode === "point" && facePoint) ry = Math.atan2(facePoint.x - pos.current.x, facePoint.z - pos.current.z);
    root.current.rotation.y += (ry - root.current.rotation.y) * Math.min(1, delta * 10);

    // sit / stand + legs
    const sitting = wantSit && !walking;
    if (inner.current) {
      const targetY = sitting ? -0.34 : 0;
      inner.current.position.y += (targetY - inner.current.position.y) * Math.min(1, delta * 8);
    }
    const swing = walking ? Math.sin(now * 9) * 0.5 : 0;
    const bend = sitting ? 1.35 : 0;
    if (legL.current) legL.current.rotation.x += ((bend + swing) - legL.current.rotation.x) * Math.min(1, delta * 12);
    if (legR.current) legR.current.rotation.x += ((bend - swing) - legR.current.rotation.x) * Math.min(1, delta * 12);
  });

  const statusColor = STATUS_COLORS[emp.status] || "#52525B";
  const working = emp.status === "working";

  return (
    <group ref={root} onClick={(e) => { e.stopPropagation(); onSelect(emp); }}>
      <group ref={inner}>
        {/* torso */}
        <RoundedBox args={[0.5, 0.55, 0.34]} radius={0.16} smoothness={4} position={[0, 0.72, 0]} castShadow>
          <meshStandardMaterial color={shirt} roughness={0.6} metalness={isAi ? 0.5 : 0}
            emissive={isAi ? accent : "#000"} emissiveIntensity={isAi ? (working ? 0.4 : 0.15) : 0} />
        </RoundedBox>
        {isAi ? <AiHead avatar={emp.avatar} working={working} /> : <HumanHead avatar={emp.avatar} />}
        {/* arms */}
        <mesh position={[0.31, 0.72, 0.05]} rotation={[0.2, 0, 0.15]}><capsuleGeometry args={[0.075, 0.32, 4, 8]} /><meshStandardMaterial color={shirt} metalness={isAi ? 0.4 : 0} /></mesh>
        <mesh position={[-0.31, 0.72, 0.05]} rotation={[0.2, 0, -0.15]}><capsuleGeometry args={[0.075, 0.32, 4, 8]} /><meshStandardMaterial color={shirt} metalness={isAi ? 0.4 : 0} /></mesh>
        {/* legs (pivot at hip y=0.45) */}
        <group ref={legL} position={[0.13, 0.45, 0]}>
          <mesh position={[0, -0.22, 0]}><capsuleGeometry args={[0.08, 0.32, 4, 8]} /><meshStandardMaterial color={legColor} /></mesh>
        </group>
        <group ref={legR} position={[-0.13, 0.45, 0]}>
          <mesh position={[0, -0.22, 0]}><capsuleGeometry args={[0.08, 0.32, 4, 8]} /><meshStandardMaterial color={legColor} /></mesh>
        </group>
      </group>

      {/* status ring */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.34, 0.42, 32]} />
        <meshBasicMaterial color={statusColor} transparent opacity={selected ? 0.95 : 0.5} side={THREE.DoubleSide} />
      </mesh>
      {working && <pointLight position={[0, 1.2, 0.3]} color={accent} intensity={1.8} distance={2.2} />}

      {/* label */}
      <Html position={[0, 1.75, 0]} center distanceFactor={9} zIndexRange={[10, 0]}>
        <div className="pointer-events-none select-none flex flex-col items-center" style={{ width: 140 }}>
          {bubble && (
            <div className="glass rounded-lg px-2 py-1 mb-1 text-[10px] text-white whitespace-nowrap animate-fade-up" style={{ borderColor: accent }}>
              💬 {bubble}
            </div>
          )}
          <div className="glass rounded-md px-2 py-1 flex items-center gap-1.5" style={{ borderColor: selected ? accent : undefined }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
            <span className="text-[11px] font-medium text-white whitespace-nowrap">{emp.name}</span>
            <span className="text-[8px] font-mono px-1 rounded" style={{ color: accent, border: `1px solid ${accent}55` }}>{isAi ? "AI" : "H"}</span>
          </div>
          <div className="mt-0.5 font-mono text-[8px]" style={{ color: statusColor }}>{STATUS_LABEL[emp.status] || "Idle"}</div>
        </div>
      </Html>
    </group>
  );
}

/* ---------------- Desk (static) ---------------- */
function Desk({ pos, accent }) {
  return (
    <group position={[pos.x, 0, pos.z]}>
      <mesh position={[0, 0.5, -0.55]} castShadow receiveShadow><boxGeometry args={[1.4, 0.06, 0.7]} /><meshStandardMaterial color="#3a3a42" roughness={0.6} /></mesh>
      {[[-0.6, -0.75], [0.6, -0.75], [-0.6, -0.35], [0.6, -0.35]].map((p, i) => (
        <mesh key={i} position={[p[0], 0.25, p[1]]}><boxGeometry args={[0.06, 0.5, 0.06]} /><meshStandardMaterial color="#26262c" /></mesh>
      ))}
      <mesh position={[0, 0.78, -0.78]}><boxGeometry args={[0.6, 0.36, 0.03]} /><meshStandardMaterial color="#101014" /></mesh>
      <mesh position={[0, 0.78, -0.765]}><boxGeometry args={[0.54, 0.3, 0.01]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.6} toneMapped={false} /></mesh>
      <mesh position={[0, 0.42, 0.15]}><boxGeometry args={[0.44, 0.06, 0.44]} /><meshStandardMaterial color="#1c1c22" /></mesh>
      <mesh position={[0, 0.65, 0.35]}><boxGeometry args={[0.44, 0.4, 0.06]} /><meshStandardMaterial color="#1c1c22" /></mesh>
    </group>
  );
}

/* ---------------- Meeting room ---------------- */
function MeetingRoom({ active }) {
  const glow = active ? "#8B5CF6" : "#2a2a30";
  return (
    <group>
      {/* zone carpet */}
      <mesh position={[MEETING_TABLE.x, 0.015, MEETING_TABLE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.6, 4.2]} />
        <meshStandardMaterial color="#15151b" roughness={1} emissive={active ? "#8B5CF6" : "#000"} emissiveIntensity={active ? 0.12 : 0} />
      </mesh>
      <mesh position={[MEETING_TABLE.x, 0.02, MEETING_TABLE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.25, 2.35, 48]} />
        <meshBasicMaterial color={glow} transparent opacity={active ? 0.9 : 0.4} side={THREE.DoubleSide} />
      </mesh>
      {/* sign */}
      <Html position={[MEETING_TABLE.x, 2.2, MEETING_TABLE.z - 2]} center distanceFactor={11}>
        <div className="glass rounded-md px-2.5 py-1 whitespace-nowrap flex items-center gap-1.5" style={{ borderColor: active ? "#8B5CF6" : undefined }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: active ? "#8B5CF6" : "#52525B", boxShadow: active ? "0 0 8px #8B5CF6" : "none" }} />
          <span className="text-[11px] font-medium text-white">Meeting Room</span>
        </div>
      </Html>
    </group>
  );
}

/* ---------------- Flying envelope ---------------- */
function Envelope({ from, to, color, onDone }) {
  const ref = useRef();
  const start = useRef(performance.now());
  const duration = 2200;
  const curve = useMemo(() => {
    const a = new THREE.Vector3(from.x, 1.1, from.z + 0.2);
    const c = new THREE.Vector3(to.x, 1.1, to.z + 0.2);
    const mid = new THREE.Vector3((from.x + to.x) / 2, 3.4, (from.z + to.z) / 2);
    return new THREE.QuadraticBezierCurve3(a, mid, c);
  }, [from, to]);
  useFrame(() => {
    if (!ref.current) return;
    const t = Math.min((performance.now() - start.current) / duration, 1);
    const p = curve.getPoint(t);
    ref.current.position.copy(p);
    const tan = curve.getTangent(t);
    ref.current.rotation.y = Math.atan2(tan.x, tan.z);
    ref.current.rotation.z = Math.sin(t * Math.PI * 4) * 0.3;
    if (t >= 1) onDone();
  });
  return (
    <group ref={ref}>
      <mesh castShadow><boxGeometry args={[0.32, 0.22, 0.03]} /><meshStandardMaterial color="#faf7f0" emissive={color} emissiveIntensity={0.35} /></mesh>
      <mesh position={[0, 0.02, 0.02]}><coneGeometry args={[0.16, 0.12, 4]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} toneMapped={false} /></mesh>
      <pointLight color={color} intensity={2} distance={2} />
    </group>
  );
}

/* ---------------- Fallback floor (under imported model) ---------------- */
function BaseFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[60, 60]} /><meshStandardMaterial color="#0c0c10" roughness={1} />
    </mesh>
  );
}

/* ---------------- Scene root ---------------- */
export default function OfficeScene({ employees = [], envelopes = [], onRemoveEnvelope, selectedId, onSelect, meetingSeats = {}, conversations = [] }) {
  const meetingActive = Object.keys(meetingSeats).length > 0;

  // resolve per-employee mode
  const resolved = employees.map((emp) => {
    const home = emp.desk || deskPosition(emp.desk_index || 0);
    const homeSeat = { x: home.x, z: home.z + 0.9 };  // seat in front of desk
    let mode = "idle", target = homeSeat, facePoint = null, bubble = null;

    if (meetingSeats[emp.id] !== undefined) {
      const seat = MEETING_SEATS[meetingSeats[emp.id]] || MEETING_SEATS[0];
      mode = "meeting"; target = { x: seat.x, z: seat.z + (seat.z < MEETING_TABLE.z ? 0.1 : -0.1) };
      facePoint = MEETING_TABLE;
    } else {
      const conv = conversations.find((c) => c.a === emp.id || c.b === emp.id);
      if (conv) {
        mode = "talk";
        const isA = conv.a === emp.id;
        target = { x: conv.mid.x + (isA ? -0.55 : 0.55), z: conv.mid.z };
        facePoint = { x: conv.mid.x + (isA ? 0.55 : -0.55), z: conv.mid.z };
        bubble = "…";
      } else if (emp.status === "working" || emp.status === "waiting") {
        mode = "work"; target = homeSeat;
      } else {
        mode = "idle"; target = homeSeat;
      }
    }
    return { emp, home: homeSeat, mode, target, facePoint, bubble };
  });

  return (
    <Canvas shadows camera={{ position: [2, 9, 14], fov: 44 }} dpr={[1, 1.7]}
      gl={{ antialias: true, toneMappingExposure: 1.15 }}>
      <color attach="background" args={["#1e2530"]} />
      <fog attach="fog" args={["#1e2530", 30, 66]} />
      <ambientLight intensity={0.85} />
      <hemisphereLight args={["#ffffff", "#2a303c", 0.7]} />
      <directionalLight position={[8, 16, 8]} intensity={1.3} castShadow shadow-mapSize={[2048, 2048]} />
      <directionalLight position={[-8, 10, -6]} intensity={0.5} color="#cfd6ff" />
      <Environment preset="city" environmentIntensity={1.0} />

      <BaseFloor />
      <Suspense fallback={null}>
        <OfficeModel url={OFFICE_MODEL_URL} />
      </Suspense>
      <MeetingRoom active={meetingActive} />

      {resolved.map(({ emp, home, mode, target, facePoint, bubble }) => (
        <Person key={emp.id} emp={emp} home={home} mode={mode} target={target}
          facePoint={facePoint} bubble={bubble} selected={selectedId === emp.id} onSelect={onSelect} />
      ))}

      {envelopes.map((env) => (
        <Envelope key={env.key} from={env.from} to={env.to} color={env.color} onDone={() => onRemoveEnvelope(env.key)} />
      ))}

      <ContactShadows position={[0, 0.02, 0]} opacity={0.45} scale={34} blur={2.6} far={12} />
      <OrbitControls enablePan maxPolarAngle={Math.PI / 2.15} minDistance={5} maxDistance={26} target={[1, 0.8, 0]} />
    </Canvas>
  );
}
