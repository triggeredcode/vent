/**
 * The SWEAT gym buddy: Quaternius' CC0 "RobotExpressive" (see public/models/CREDITS.md) rendered with three.js
 * in a transparent canvas. Clips from the file drive idle / wave / thumbs-up / no; the workout (jumping jacks)
 * is procedural, layered on top of the idle clip by rotating bones in model space, so its tempo and
 * amplitude can follow the caller's voice exactly. This module is loaded lazily (dynamic import) so
 * three.js is only fetched when the SWEAT scene is on screen.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export const MODEL_URL = "/models/robot-expressive.glb";

export type BotMode = "warm" | "work" | "talk" | "rest" | "pause" | "slump";

export interface Drive {
  mode: BotMode;
  /** Phase of the current jumping jack, 0–1 (0 = standing, feet together). Held at 0 when not working. */
  rep: number;
  /** 0–1 workout intensity (how loud the caller is). */
  effort: number;
  /** 0–1: arms shake-out after a burst of reps. */
  shake: number;
  /** VENT's own speech loudness 0–1. */
  voice: number;
}

export interface GymBot {
  render: (dt: number, drive: Drive) => void;
  resize: (width: number, height: number) => void;
  /** Flick a few sweat drops off the brow. */
  sweat: (power: number) => void;
  dispose: () => void;
}

export interface BotOptions {
  /** Draw with a fixed pose and no idle clip (used for the static cover render). */
  still?: boolean;
  /** Fraction of the canvas height the standing bot should fill (default 0.7). */
  fill?: number;
}

/** Sports-poster palette. */
const COBALT = new THREE.Color("#2747ff");
const HOT = new THREE.Color("#ff3d8b");
const BONE_WHITE = new THREE.Color("#eef0f6");
const INK = new THREE.Color("#16171c");
const DROP = new THREE.Color("#8fdcff");

const DEG = Math.PI / 180;
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const damp = (current: number, target: number, rate: number, dt: number) => current + (target - current) * (1 - Math.exp(-rate * dt));

const AX = new THREE.Vector3(1, 0, 0);
const AY = new THREE.Vector3(0, 1, 0);
const AZ = new THREE.Vector3(0, 0, 1);
const MX = new THREE.Vector3();
const MZ = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _pq = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

/** Rotate a bone about an axis given in *scene* space, around the bone's own origin. */
function turn(bone: THREE.Object3D | undefined, axis: THREE.Vector3, angle: number) {
  if (!bone || !bone.parent || Math.abs(angle) < 1e-5) return;
  bone.parent.getWorldQuaternion(_pq);
  _q.setFromAxisAngle(axis, angle);
  // local' = parent⁻¹ · R · parent · local
  const delta = _pq.clone().invert().multiply(_q).multiply(_pq);
  bone.quaternion.premultiply(delta);
}

function softShadowTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(10,12,30,0.55)");
  gradient.addColorStop(0.45, "rgba(10,12,30,0.28)");
  gradient.addColorStop(1, "rgba(10,12,30,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface Drop { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }

export async function createGymBot(canvas: HTMLCanvasElement, options: BotOptions = {}): Promise<GymBot> {
  const fill = options.fill ?? 0.64;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: !!options.still });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envMap = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  scene.environment = envMap;
  scene.environmentIntensity = 0.35;

  // Key (warm, front-left-high), rim (lime/pink kick from behind), soft fill from the lime "floor".
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9e83a, 0.45));
  const key = new THREE.DirectionalLight(0xfff3e4, 2.4);
  key.position.set(-2.5, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff6fae, 2.2);
  rim.position.set(3.5, 3, -4);
  scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xd8ff5a, 1.6);
  rim2.position.set(-4, 2, -3);
  scene.add(rim2);

  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);

  const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
  const model = gltf.scene;
  scene.add(model);
  model.rotation.y = -0.2; // a slight three-quarter turn reads as 3D without hiding the jacks

  // Restyle the three flat materials: cobalt shell, bright white joints, ink visor — glossy toy plastic.
  const owned = new Set<THREE.Material>();
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const standard = material as THREE.MeshStandardMaterial;
      if (owned.has(standard)) continue;
      owned.add(standard);
      if (standard.name === "Main") standard.color.copy(COBALT);
      else if (standard.name === "Grey") standard.color.copy(BONE_WHITE);
      else if (standard.name === "Black") standard.color.copy(INK);
      standard.metalness = standard.name === "Black" ? 0.2 : 0.05;
      standard.roughness = standard.name === "Black" ? 0.25 : 0.38;
    }
  });

  // GLTFLoader sanitizes node names for animation binding ("UpperArm.L" → "UpperArmL").
  const bone = (name: string) => model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name)) as THREE.Object3D | undefined;
  const bones = {
    body: bone("Body"), neck: bone("Neck"), head: bone("Head"), headEnd: bone("Head_end"),
    armL: bone("UpperArm.L"), armR: bone("UpperArm.R"), foreL: bone("LowerArm.L"), foreR: bone("LowerArm.R"),
    legL: bone("UpperLeg.L"), legR: bone("UpperLeg.R"), shinL: bone("LowerLeg.L"), shinR: bone("LowerLeg.R"),
    ankleL: bone("LowerLeg.L_end"), ankleR: bone("LowerLeg.R_end"),
    footL: bone("Foot.L"), footR: bone("Foot.R"),
  };
  const faces: THREE.Mesh[] = [];
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh && mesh.morphTargetDictionary && "Angry" in mesh.morphTargetDictionary) faces.push(mesh);
  });
  const morph = (name: string, value: number) => {
    for (const face of faces) {
      const index = face.morphTargetDictionary?.[name];
      if (face.morphTargetInfluences && index !== undefined) face.morphTargetInfluences[index] = value;
    }
  };
  // Everything the procedural layer touches is reset to its rest transform every frame before the clips
  // apply, so additive turns never accumulate on bones the current clip doesn't key.
  const touched = Object.values(bones).filter((b): b is THREE.Object3D => !!b);
  const rest = touched.map((b) => ({ b, q: b.quaternion.clone(), p: b.position.clone() }));
  const resetBones = () => rest.forEach(({ b, q, p }) => { b.quaternion.copy(q); b.position.copy(p); });

  // Measure the standing bot in its idle pose so framing works whatever the file's units are.
  const mixer = new THREE.AnimationMixer(model);
  const clips = new Map(gltf.animations.map((clip) => [clip.name, clip]));
  const action = (name: string) => {
    const clip = clips.get(name);
    return clip ? mixer.clipAction(clip) : null;
  };
  const idle = action("Idle");
  idle?.play();
  mixer.update(0.5);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const height = box.max.y - box.min.y;
  const floorY = box.min.y;
  const centreX = (box.min.x + box.max.x) / 2;

  // Accessories: the white trim round the head becomes a hot-pink sweatband; pink wristbands ride the forearms.
  const accessoryMaterial = new THREE.MeshStandardMaterial({ color: HOT, roughness: 0.55, metalness: 0, name: "Sweatband" });
  const geometries: THREE.BufferGeometry[] = [];
  for (const face of faces) {
    if (!Array.isArray(face.material) && face.material.name === "Grey") face.material = accessoryMaterial;
  }
  for (const fore of [bones.foreL, bones.foreR]) {
    if (!fore) continue;
    // Wristband sits ~70% of the way down the forearm; rings are oriented along the bone's own Y axis.
    const scale = fore.getWorldScale(_w).x || 1;
    const band = new THREE.TorusGeometry(height * 0.035 / scale, height * 0.012 / scale, 12, 36);
    geometries.push(band);
    const mesh = new THREE.Mesh(band, accessoryMaterial);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = height * 0.075 / scale;
    fore.add(mesh);
  }

  // Soft contact shadow.
  const shadowTexture = softShadowTexture();
  const shadowGeometry = new THREE.PlaneGeometry(1, 1);
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, toneMapped: false });
  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(centreX, floorY + 0.002, 0);
  shadow.renderOrder = -1;
  scene.add(shadow);

  // Sweat drops.
  const dropGeometry = new THREE.SphereGeometry(height * 0.018, 12, 10);
  const dropMaterial = new THREE.MeshPhysicalMaterial({ color: DROP, roughness: 0.05, metalness: 0, transmission: 0, clearcoat: 1, emissive: DROP, emissiveIntensity: 0.25 });
  const drops: Drop[] = [];
  const dropPool: THREE.Mesh[] = Array.from({ length: 10 }, () => {
    const mesh = new THREE.Mesh(dropGeometry, dropMaterial);
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  });

  // Framing: the standing bot fills `fill` of the canvas height, feet a little above the bottom edge,
  // camera slightly above chest height so the floor shadow reads as a thin ellipse.
  let aspect = 1;
  const frame = () => {
    camera.aspect = aspect;
    const view = height / fill;
    const distance = view / (2 * Math.tan((camera.fov * DEG) / 2));
    const lookY = floorY + view / 2 - view * 0.05;
    camera.position.set(centreX, lookY + view * 0.12, distance);
    camera.lookAt(centreX, lookY, 0);
    camera.updateProjectionMatrix();
  };
  frame();

  // Clip state.
  let base: THREE.AnimationAction | null = idle;
  let mode: BotMode | null = null;
  const fadeTo = (name: string, { loop = true, speed = 1, fade = 0.35 } = {}) => {
    const next = action(name);
    if (!next) return null;
    next.reset();
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = !loop;
    next.timeScale = speed;
    next.setEffectiveWeight(1);
    next.play();
    if (base && base !== next) base.crossFadeTo(next, fade, false);
    base = next;
    return next;
  };
  let oneShot: THREE.AnimationAction | null = null;
  mixer.addEventListener("finished", (event) => {
    if (event.action === oneShot) {
      oneShot = null;
      fadeTo("Idle", { fade: 0.45 });
    }
  });

  const enter = (next: BotMode) => {
    mode = next;
    if (next === "warm") fadeTo("Wave", { speed: 0.9 });
    else if (next === "talk") oneShot = fadeTo("ThumbsUp", { loop: false, fade: 0.25 });
    else if (next === "slump") oneShot = fadeTo("No", { loop: false, speed: 0.8 });
    else fadeTo("Idle", { speed: next === "rest" ? 1.6 : next === "pause" ? 0.55 : 1 });
  };

  // Smoothed procedural layers.
  let time = 0;
  let jack = 0; // weight of the workout layer
  let lean = 0; // catch-breath lean (thinking)
  let nod = 0;
  let angry = 0;
  let surprised = 0;
  let sad = 0;
  let hop = 0;
  let disposed = false;

  const pinFeet = (before: [THREE.Vector3, THREE.Vector3]) => {
    model.updateMatrixWorld(true);
    ([[bones.ankleL, bones.footL, before[0]], [bones.ankleR, bones.footR, before[1]]] as const).forEach(([ankle, foot, was]) => {
      if (!ankle || !foot || !foot.parent) return;
      const now = ankle.getWorldPosition(_v);
      const shift = _w.copy(now).sub(was);
      const footWorld = foot.getWorldPosition(new THREE.Vector3()).add(shift);
      // Keep the soles on the floor (hop is applied to the whole model afterwards).
      foot.position.copy(foot.parent.worldToLocal(footWorld));
    });
  };

  const pose = (drive: Drive, dt: number) => {
    const t = time;
    const work = drive.mode === "work";
    jack = damp(jack, work ? 1 : 0, 6, dt);
    lean = damp(lean, drive.mode === "rest" ? 1 : drive.mode === "slump" ? 0.6 : 0, 3, dt);

    // Jumping jack: open = 0 (together) → 1 (star) → 0. Arms lead slightly, legs follow.
    const u = drive.rep;
    const open = 0.5 - 0.5 * Math.cos(u * Math.PI * 2);
    const amp = jack * (0.82 + drive.effort * 0.18);
    const armAngle = open * amp * (118 + drive.effort * 14) * DEG; // a wide V: the big head stays clear
    const legAngle = open * amp * (15 + drive.effort * 5) * DEG;
    const hopTarget = jack * (Math.abs(Math.sin(u * Math.PI * 2)) * (0.035 + drive.effort * 0.04)) * height;
    hop = options.still ? hopTarget : damp(hop, hopTarget, 30, dt);

    MX.copy(AX).applyQuaternion(model.quaternion);
    MZ.copy(AZ).applyQuaternion(model.quaternion);
    model.updateMatrixWorld(true);
    const before: [THREE.Vector3, THREE.Vector3] = [
      bones.ankleL?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3(),
      bones.ankleR?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3(),
    ];

    // Lean (thinking: hands-on-hips breathing / error: slump), counter-rotating the legs so they stay planted.
    const breath = Math.sin(t * Math.PI * 2 / (drive.mode === "rest" ? 0.9 : 3.2));
    const leanAngle = lean * (14 + breath * 2.5) * DEG;
    turn(bones.body, MX, leanAngle);
    turn(bones.legL, MX, -leanAngle);
    turn(bones.legR, MX, -leanAngle);
    turn(bones.armL, MX, -lean * 8 * DEG);
    turn(bones.armR, MX, -lean * 8 * DEG);

    // Arms up the sides (left arm is on +X, the bot faces +Z), forearms bend a touch mid-swing.
    const shake = drive.shake * Math.sin(t * 34) * 7 * DEG;
    turn(bones.armL, MZ, armAngle + shake);
    turn(bones.armR, MZ, -armAngle - shake);
    const bend = -Math.sin(open * Math.PI) * amp * 12 * DEG;
    turn(bones.foreL, MZ, bend);
    turn(bones.foreR, MZ, -bend);
    turn(bones.legL, MZ, legAngle);
    turn(bones.legR, MZ, -legAngle);
    // Knees soak up the landing.
    const knee = jack * (1 - Math.abs(Math.sin(u * Math.PI * 2))) * (u > 0.02 && u < 0.98 ? 1 : 0) * 10 * DEG;
    turn(bones.shinL, MX, knee);
    turn(bones.shinR, MX, knee);

    // Head: nods while VENT talks, drops when slumped, tips back on the strain.
    nod = damp(nod, drive.mode === "talk" ? drive.voice : 0, 14, dt);
    turn(bones.neck, MX, nod * 9 * DEG * Math.sin(t * 7) + lean * 10 * DEG - open * jack * 6 * DEG);

    pinFeet(before);
    model.position.y = hop;

    // Faces: determined while working, open-mouthed panting when resting, a grin + mouth while talking.
    angry = damp(angry, work && (drive.rep > 0 || drive.effort > 0.05) ? 0.2 + drive.effort * 0.6 : 0, 5, dt);
    surprised = damp(surprised, drive.mode === "talk" ? clamp(drive.voice * 1.1) * 0.7 : drive.mode === "rest" ? 0.25 + 0.15 * (breath + 1) / 2 : 0, 16, dt);
    sad = damp(sad, drive.mode === "slump" ? 0.85 : drive.mode === "pause" ? 0.2 : 0, 4, dt);
    morph("Angry", angry);
    morph("Surprised", surprised);
    morph("Sad", sad);

    const lift = hop / height;
    shadow.scale.setScalar(height * (0.62 + open * jack * 0.22) * (1 - lift * 2.2));
    shadowMaterial.opacity = clamp(1 - lift * 5);
  };

  const sweat = (power: number) => {
    if (!bones.headEnd) return;
    const head = bones.headEnd.getWorldPosition(new THREE.Vector3());
    const count = 1 + Math.round(power * 3);
    for (let index = 0; index < count; index += 1) {
      const mesh = dropPool.find((m) => !m.visible);
      if (!mesh) return;
      const side = index % 2 ? 1 : -1;
      mesh.visible = true;
      mesh.position.set(head.x + side * height * 0.12, head.y - height * 0.08, head.z + height * 0.02);
      drops.push({ mesh, life: 1, vel: new THREE.Vector3(side * height * (0.5 + Math.random() * 0.7), height * (0.6 + Math.random() * 0.6), height * 0.2 * Math.random()) });
    }
  };

  const render = (dt: number, drive: Drive) => {
    if (disposed) return;
    time += dt;
    if (drive.mode !== mode) enter(drive.mode);
    resetBones();
    mixer.update(options.still ? 0 : dt);
    pose(drive, dt);
    for (let index = drops.length - 1; index >= 0; index -= 1) {
      const drop = drops[index];
      drop.vel.y -= height * 4.2 * dt;
      drop.mesh.position.addScaledVector(drop.vel, dt);
      drop.life -= dt * 1.3;
      const s = clamp(drop.life * 2);
      // Teardrop: stretch along the direction of travel.
      drop.mesh.scale.set(s, s * (1.15 + Math.min(1, drop.vel.length() / height) * 0.35), s);
      drop.mesh.quaternion.setFromUnitVectors(AY, _v.copy(drop.vel).normalize());
      if (drop.life <= 0 || drop.mesh.position.y < floorY) {
        drop.mesh.visible = false;
        drops.splice(index, 1);
      }
    }
    renderer.render(scene, camera);
  };

  return {
    render,
    resize: (width, h) => {
      if (width < 2 || h < 2) return;
      renderer.setSize(width, h, false);
      aspect = width / h;
      frame();
    },
    sweat,
    dispose: () => {
      disposed = true;
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      model.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh) mesh.geometry.dispose();
      });
      owned.forEach((material) => material.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      [accessoryMaterial, shadowMaterial, dropMaterial].forEach((material) => material.dispose());
      shadowGeometry.dispose();
      shadowTexture.dispose();
      dropGeometry.dispose();
      envMap.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
