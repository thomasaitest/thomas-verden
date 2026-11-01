/** Prefer custom sleek hover-cars; Kenney GLBs available as optional fallback. */
import * as THREE from 'three';
import { buildCar, CAR_AVATAR_SCALE, CAR_SEAT_Y } from './vehicles.ts';

export async function buildGltfCar(carId: string): Promise<THREE.Group> {
  // Custom futuristic geometry — matches concept better than Kenney toy cars
  const g = buildCar(carId);
  g.userData.seatY = CAR_SEAT_Y;
  g.userData.avatarScale = CAR_AVATAR_SCALE;
  // soft under-glow already in buildCar
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return g;
}

export function mountDriverInCar(car: THREE.Group, avatar: THREE.Object3D) {
  const seatY = (car.userData.seatY as number) ?? CAR_SEAT_Y;
  const scale = (car.userData.avatarScale as number) ?? CAR_AVATAR_SCALE;
  avatar.scale.setScalar(scale);
  avatar.position.set(0, seatY, 0.05);
  avatar.rotation.set(0, 0, 0);
  car.add(avatar);
}

export { CAR_AVATAR_SCALE, CAR_SEAT_Y };
