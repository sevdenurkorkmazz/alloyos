import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Html, RoundedBox, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { STATUS_COLORS, STATUS_LABEL, deskPosition } from "../../lib/office";

/* ---------------- Characters (original procedural assets) ---------------- */

function HumanCharacter({ avatar = {}, working }) {
  const g = useRef();
  useFrame((state) => {
    if (!g.current) return;
    if (working) g.current.position.y = 0.02 * Math.sin(state.clock.elapsedTime * 6);
    else g.current.position.y = 0.02 * Math.sin(state.clock.elapsedTime * 1.2);
  });
  const skin = avatar.skinTone || "#e8b58f";
  const hair = avatar.hairColor || "#2b2b2b";
  const shirt = avatar.shirtColor || "#3B82F6";
  const style = avatar.hairStyle || "short";
  return (
    <group ref={g}>
      {/* torso */}
      <RoundedBox args={[0.5, 0.55, 0.35]} radius={0.12} smoothness={3} position={[0, 0.75, 0]} castShadow>
        <meshStandardMaterial color={shirt} roughness={0.7} />
      </RoundedBox>
      {/* neck */}
      <mesh position={[0, 1.08, 0]}><cylinderGeometry args={[0.08, 0.09, 0.12, 12]} /><meshStandardMaterial color={skin} /></mesh>
      {/* head */}
      <mesh position={[0, 1.28, 0]} castShadow><sphereGeometry args={[0.22, 24, 24]} /><meshStandardMaterial color={skin} roughness={0.6} /></mesh>
      {/* hair */}
      {style !== "bald" && (
        <mesh position={[0, 1.36, style === "long" ? -0.02 : 0]}>
          <sphereGeometry args={[style === "curly" ? 0.25 : 0.235, 20, 20, 0, Math.PI * 2, 0, Math.PI * (style === "long" ? 0.85 : 0.62)]} />
          <meshStandardMaterial color={hair} roughness={0.9} />
        </mesh>
      )}
      {avatar.facialHair === "beard" && (
        <mesh position={[0, 1.17, 0.13]}><sphereGeometry args={[0.15, 16, 16, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45]} /><meshStandardMaterial color={hair} /></mesh>
      )}
      {avatar.accessory === "glasses" && (
        <mesh position={[0, 1.29, 0.2]}><boxGeometry args={[0.32, 0.06, 0.02]} /><meshStandardMaterial color="#111" /></mesh>
      )}
      {avatar.accessory === "headphones" && (
        <mesh position={[0, 1.4, 0]}><torusGeometry args={[0.24, 0.03, 8, 24, Math.PI]} /><meshStandardMaterial color="#111" /></mesh>
      )}
      {/* arms resting on desk */}
      <mesh position={[0.28, 0.72, 0.18]} rotation={[0.4, 0, 0.2]}><capsuleGeometry args={[0.07, 0.3, 4, 8]} /><meshStandardMaterial color={shirt} /></mesh>
      <mesh position={[-0.28, 0.72, 0.18]} rotation={[0.4, 0, -0.2]}><capsuleGeometry args={[0.07, 0.3, 4, 8]} /><meshStandardMaterial color={shirt} /></mesh>
    </group>
  );
}

function AiCharacter({ avatar = {}, working }) {
  const g = useRef();
  const body = avatar.bodyColor || "#00E599";
  useFrame((state) => {
    if (!g.current) return;
    g.current.rotation.y = working ? Math.sin(state.clock.elapsedTime * 3) * 0.15 : Math.sin(state.clock.elapsedTime * 0.6) * 0.05;
    g.current.position.y = 0.03 * Math.sin(state.clock.elapsedTime * (working ? 5 : 1.5));
  });
  return (
    <group ref={g}>
      <RoundedBox args={[0.5, 0.55, 0.35]} radius={0.14} smoothness={4} position={[0, 0.78, 0]} castShadow>
        <meshStandardMaterial color={body} metalness={0.5} roughness={0.3} emissive={body} emissiveIntensity={working ? 0.5 : 0.18} />
      </RoundedBox>
      {/* head */}
      <RoundedBox args={[0.4, 0.34, 0.34]} radius={0.1} smoothness={4} position={[0, 1.22, 0]} castShadow>
        <meshStandardMaterial color="#0e0e12" metalness={0.7} roughness={0.25} />
      </RoundedBox>
      {/* visor */}
      <mesh position={[0, 1.24, 0.18]}><boxGeometry args={[0.3, 0.12, 0.02]} />
        <meshStandardMaterial color={body} emissive={body} emissiveIntensity={working ? 1.6 : 0.8} toneMapped={false} /></mesh>
      {/* antenna */}
      {avatar.antenna !== false && (
        <group position={[0, 1.42, 0]}>
          <mesh><cylinderGeometry args={[0.015, 0.015, 0.16, 8]} /><meshStandardMaterial color="#555" /></mesh>
          <mesh position={[0, 0.11, 0]}><sphereGeometry args={[0.045, 12, 12]} />
            <meshStandardMaterial color={body} emissive={body} emissiveIntensity={1.5} toneMapped={false} /></mesh>
        </group>
      )}
    </group>
  );
}

/* ---------------- Desk ---------------- */
function Desk({ accent }) {
  return (
    <group>
      <mesh position={[0, 0.5, -0.55]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.06, 0.7]} /><meshStandardMaterial color="#3a3a42" roughness={0.6} />
      </mesh>
      {[[-0.6, -0.75], [0.6, -0.75], [-0.6, -0.35], [0.6, -0.35]].map((p, i) => (
        <mesh key={i} position={[p[0], 0.25, p[1]]}><boxGeometry args={[0.06, 0.5, 0.06]} /><meshStandardMaterial color="#26262c" /></mesh>
      ))}
      {/* monitor */}
      <mesh position={[0, 0.78, -0.78]}><boxGeometry args={[0.6, 0.36, 0.03]} /><meshStandardMaterial color="#101014" /></mesh>
      <mesh position={[0, 0.78, -0.765]}><boxGeometry args={[0.54, 0.3, 0.01]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.6} toneMapped={false} /></mesh>
      <mesh position={[0, 0.57, -0.78]}><boxGeometry args={[0.1, 0.12, 0.06]} /><meshStandardMaterial color="#101014" /></mesh>
      {/* chair */}
      <mesh position={[0, 0.42, 0.15]}><boxGeometry args={[0.44, 0.06, 0.44]} /><meshStandardMaterial color="#1c1c22" /></mesh>
      <mesh position={[0, 0.65, 0.35]}><boxGeometry args={[0.44, 0.4, 0.06]} /><meshStandardMaterial color="#1c1c22" /></mesh>
    </group>
  );
}

/* ---------------- Workstation (desk + character + status) ---------------- */
function Workstation({ emp, selected, onSelect }) {
  const pos = emp.desk || deskPosition(emp.desk_index || 0);
  const working = emp.status === "working";
  const isAi = emp.type === "ai";
  const accent = isAi ? (emp.avatar?.bodyColor || "#00E599") : (emp.avatar?.shirtColor || "#FF6B35");
  const statusColor = STATUS_COLORS[emp.status] || "#52525B";
  return (
    <group position={[pos.x, 0, pos.z]} onClick={(e) => { e.stopPropagation(); onSelect(emp); }}>
      <Desk accent={accent} />
      <group position={[0, 0, 0.15]}>
        {isAi ? <AiCharacter avatar={emp.avatar} working={working} /> : <HumanCharacter avatar={emp.avatar} working={working} />}
      </group>
      {/* status ring on floor */}
      <mesh position={[0, 0.02, 0.15]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.5, 32]} />
        <meshBasicMaterial color={statusColor} transparent opacity={selected ? 0.95 : 0.55} side={THREE.DoubleSide} />
      </mesh>
      {working && (
        <pointLight position={[0, 1.1, 0.3]} color={accent} intensity={2.2} distance={2.4} />
      )}
      {/* label */}
      <Html position={[0, 1.85, 0.15]} center distanceFactor={9} zIndexRange={[10, 0]}>
        <div className="pointer-events-none select-none flex flex-col items-center" style={{ width: 130 }}>
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
      <mesh castShadow>
        <boxGeometry args={[0.32, 0.22, 0.03]} />
        <meshStandardMaterial color="#faf7f0" emissive={color} emissiveIntensity={0.35} />
      </mesh>
      {/* flap */}
      <mesh position={[0, 0.02, 0.02]} rotation={[0, 0, 0]}>
        <coneGeometry args={[0.16, 0.12, 4]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} toneMapped={false} />
      </mesh>
      <pointLight color={color} intensity={2} distance={2} />
    </group>
  );
}

/* ---------------- Room ---------------- */
function Room() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[26, 26]} /><meshStandardMaterial color="#101014" roughness={0.9} />
      </mesh>
      <gridHelper args={[26, 26, "#1e1e26", "#17171d"]} position={[0, 0.01, 0]} />
      {/* back wall */}
      <mesh position={[0, 3, -9]} receiveShadow><boxGeometry args={[26, 6, 0.2]} /><meshStandardMaterial color="#0d0d11" /></mesh>
      <mesh position={[-13, 3, 0]} receiveShadow><boxGeometry args={[0.2, 6, 26]} /><meshStandardMaterial color="#0d0d11" /></mesh>
      {/* neon accent strip along the base of the back wall */}
      <mesh position={[0, 0.06, -8.85]}><boxGeometry args={[24, 0.05, 0.02]} /><meshStandardMaterial color="#00E599" emissive="#00E599" emissiveIntensity={1.1} toneMapped={false} /></mesh>
      {/* meeting table zone (right) */}
      <group position={[8.5, 0, -1]}>
        <mesh position={[0, 0.45, 0]} castShadow><cylinderGeometry args={[1.3, 1.3, 0.08, 24]} /><meshStandardMaterial color="#3a3a42" /></mesh>
        <mesh position={[0, 0.22, 0]}><cylinderGeometry args={[0.12, 0.18, 0.45, 12]} /><meshStandardMaterial color="#26262c" /></mesh>
      </group>
      {/* plants */}
      {[[-11, -6], [-11, 5], [10, 6]].map((p, i) => (
        <group key={i} position={[p[0], 0, p[1]]}>
          <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.22, 0.28, 0.5, 12]} /><meshStandardMaterial color="#2a2a30" /></mesh>
          <mesh position={[0, 0.75, 0]}><sphereGeometry args={[0.45, 12, 12]} /><meshStandardMaterial color="#1f6b45" roughness={1} /></mesh>
        </group>
      ))}
    </group>
  );
}

/* ---------------- Scene root ---------------- */
export default function OfficeScene({ employees = [], envelopes = [], onRemoveEnvelope, selectedId, onSelect }) {
  return (
    <Canvas shadows camera={{ position: [0, 9, 13], fov: 42 }} dpr={[1, 1.7]} gl={{ antialias: true }}>
      <color attach="background" args={["#09090B"]} />
      <fog attach="fog" args={["#09090B", 18, 40]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[6, 12, 6]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
      <Environment preset="city" />

      <Room />
      {employees.map((emp) => (
        <Workstation key={emp.id} emp={emp} selected={selectedId === emp.id} onSelect={onSelect} />
      ))}
      {envelopes.map((env) => (
        <Envelope key={env.key} from={env.from} to={env.to} color={env.color} onDone={() => onRemoveEnvelope(env.key)} />
      ))}

      <ContactShadows position={[0, 0.02, 0]} opacity={0.5} scale={30} blur={2.4} far={10} />
      <OrbitControls
        enablePan
        maxPolarAngle={Math.PI / 2.15}
        minDistance={5}
        maxDistance={22}
        target={[0, 0.8, -1]}
      />
    </Canvas>
  );
}
