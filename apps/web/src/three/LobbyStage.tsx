import type { PlayerView } from "@brain-rizz/shared";
import { ContactShadows } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";
import { avatarColor } from "../ui/components/PlayerChip";

/**
 * Sân khấu 3D ở sảnh chờ. Avatar hiện là khối capsule đơn giản (placeholder);
 * giai đoạn 2 thay bằng model .glb low-poly (xem docs/05-assets-guide.md).
 */
function Avatar({ player, x }: { player: PlayerView; x: number }) {
  const ref = useRef<Mesh>(null);
  const phase = x * 1.7;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    // Người đã sẵn sàng thì nhún nhảy, người chưa sẵn sàng thì thở nhẹ.
    ref.current.position.y = player.ready
      ? 0.75 + Math.abs(Math.sin(t * 4 + phase)) * 0.35
      : 0.75 + Math.sin(t * 1.5 + phase) * 0.04;
  });

  return (
    <mesh ref={ref} position={[x, 0.75, 0]} castShadow>
      <capsuleGeometry args={[0.35, 0.6, 8, 16]} />
      <meshStandardMaterial
        color={avatarColor(player.colorIndex)}
        roughness={0.6}
        transparent={!player.connected}
        opacity={player.connected ? 1 : 0.35}
      />
    </mesh>
  );
}

export default function LobbyStage({ players }: { players: PlayerView[] }) {
  const spacing = 1.1;
  const offset = ((players.length - 1) * spacing) / 2;

  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 2.2, 6], fov: 40 }} gl={{ antialias: true }}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 5, 4]} intensity={1.4} />
      {players.map((p, i) => (
        <Avatar key={p.id} player={p} x={i * spacing - offset} />
      ))}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <circleGeometry args={[6, 48]} />
        <meshStandardMaterial color="#2c2752" />
      </mesh>
      <ContactShadows position={[0, 0.01, 0]} opacity={0.5} scale={10} blur={2.5} far={3} />
    </Canvas>
  );
}
