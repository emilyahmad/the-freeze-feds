
import "./style.css";
import * as THREE from "three";

// Automatically load all face images
const faceFiles = import.meta.glob(
  "../assets/faces/*.{png,jpg,jpeg,webp}",
  {
    eager: true,
    query: "?url",
    import: "default"
  }
);

// --------------------------------------------------
// SCENE SETUP
// --------------------------------------------------

const scene = new THREE.Scene();
scene.background = new THREE.Color("#e8e8e8");

const VIEW_HEIGHT = 16;
const WORLD_BOTTOM = 12;
const WORLD_TOP = -13;

let viewWidth = VIEW_HEIGHT * window.innerWidth / window.innerHeight;

const camera = new THREE.OrthographicCamera(
  -viewWidth / 2,
  viewWidth / 2,
  VIEW_HEIGHT / 2,
  -VIEW_HEIGHT / 2,
  0.1,
  1000
);

camera.position.set(0, 18, 14);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

document.body.appendChild(renderer.domElement);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 1.5));

const sunlight = new THREE.DirectionalLight(0xffffff, 2);
sunlight.position.set(-5, 10, 8);
scene.add(sunlight);

// Ground
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({
    color: "#dedede",
    roughness: 1
  })
);

ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.03;
scene.add(ground);

// --------------------------------------------------
// SETTINGS
// --------------------------------------------------

const colours = [
  "#E76F51",
  "#E9C46A",
  "#2A9D8F",
  "#457B9D",
  "#9B5DE5",
  "#F15BB5",
  "#90BE6D",
  "#F4A261",
  "#577590"
];

const characters = [];

const randomBetween = (min, max) =>
  min + Math.random() * (max - min);

const randomColour = () =>
  colours[Math.floor(Math.random() * colours.length)];

// --------------------------------------------------
// FACE TEXTURE
// --------------------------------------------------

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function createFaceTexture(src) {
  const image = await loadImage(src);

  // Crop image into a square without stretching it
  const size = Math.min(image.width, image.height);

  const sx = (image.width - size) / 2;
  const sy = (image.height - size) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;

  const context = canvas.getContext("2d");

  context.drawImage(
    image,
    sx, sy, size, size,
    0, 0, 1024, 1024
  );

  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;

  // The front of a Three.js sphere is at U = 0.25.
  // Shift the texture so its centre faces forward.
  texture.offset.x = 0.25;

  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  return texture;
}

// --------------------------------------------------
// 3D BODY PARTS
// --------------------------------------------------

function createLimb(length, radius, material) {
  const group = new THREE.Group();

  const geometry = new THREE.CapsuleGeometry(
    radius,
    length - radius * 2,
    4,
    12
  );

  const mesh = new THREE.Mesh(geometry, material);

  // Pivot at the top of the limb
  mesh.position.y = -length / 2;

  group.add(mesh);

  return group;
}

// --------------------------------------------------
// CREATE 3D HEAD
// --------------------------------------------------

async function createMiiHead(faceUrl) {
  const texture = await createFaceTexture(faceUrl);

  const geometry = new THREE.SphereGeometry(
    1, 64, 48
  );

  // The face image is now the material of the entire sphere.
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.85
  });

  const head = new THREE.Mesh(geometry, material);

  // Mii-like oval proportions
  head.scale.set(0.72, 0.9, 0.58);

  return head;
}

// --------------------------------------------------
// CREATE CHARACTER
// --------------------------------------------------

async function createCharacter(src, index) {
  const character = new THREE.Group();

  const bodyColour = randomColour();

  const skinMaterial = new THREE.MeshStandardMaterial({
    color: "#f2c9ad",
    roughness: 0.85
  });

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColour,
    roughness: 0.8
  });

  const shoeMaterial = new THREE.MeshStandardMaterial({
    color: "#292929"
  });

  // HEAD
  const head = await createMiiHead(src);

  head.position.y = 1.65;
  character.add(head);

  // NECK
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.15, 0.22, 16),
    skinMaterial
  );

  neck.position.y = 1.0;
  character.add(neck);

  // TORSO
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 0.55, 8, 16),
    bodyMaterial
  );

  torso.position.y = 0.72;
  character.add(torso);

  // ARMS
  const leftArm = createLimb(0.72, 0.105, bodyMaterial);
  const rightArm = createLimb(0.72, 0.105, bodyMaterial);

  leftArm.position.set(-0.36, 0.95, 0);
  rightArm.position.set(0.36, 0.95, 0);

  character.add(leftArm, rightArm);

  // HANDS
  function addHand(arm) {
    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 16, 16),
      skinMaterial
    );

    hand.position.set(0, -0.72, 0);
    arm.add(hand);
  }

  addHand(leftArm);
  addHand(rightArm);

  // LEGS
  const leftLeg = createLimb(
    0.65, 0.13, shoeMaterial
  );

  const rightLeg = createLimb(
    0.65, 0.13, shoeMaterial
  );

  leftLeg.position.set(-0.16, 0.42, 0);
  rightLeg.position.set(0.16, 0.42, 0);

  character.add(leftLeg, rightLeg);

  // SHOES
  function addShoe(leg) {
    const shoe = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 16, 12),
      shoeMaterial
    );

    shoe.scale.set(1, 0.65, 1.5);
    shoe.position.set(0, -0.65, 0.08);

    leg.add(shoe);
  }

  addShoe(leftLeg);
  addShoe(rightLeg);

  // CHARACTER DATA
  character.userData = {
    name: src.split("/").pop().replace(/\.[^/.]+$/, ""),
    speed: randomBetween(1.1, 2.0),

    // Angle relative to straight down-screen movement
    angle: randomBetween(-0.55, 0.55),

    animation: randomBetween(0, Math.PI * 2),

    leftArm,
    rightArm,
    leftLeg,
    rightLeg
  };

  spawnCharacter(character);

  scene.add(character);

  return character;
}

// --------------------------------------------------
// SPAWN CHARACTERS ABOVE THE SCREEN
// --------------------------------------------------

function spawnCharacter(character) {
  const margin = 1.5;

  // Random horizontal starting position
  character.position.x = randomBetween(
    -viewWidth / 2 + margin,
    viewWidth / 2 - margin
  );

  // Start above the visible frame
  character.position.z = WORLD_TOP - randomBetween(0, 5);

  character.position.y = 0;

  const data = character.userData;

  // Different downward angles
  data.angle = randomBetween(-0.55, 0.55);

  // Different walking speeds
  data.speed = randomBetween(1.1, 2.0);

  // Randomize walking cycle
  data.animation = randomBetween(0, Math.PI * 2);
}

// --------------------------------------------------
// WALKING ANIMATION AND MOVEMENT
// --------------------------------------------------

function updateCharacter(character, delta) {
  const data = character.userData;

  data.animation += delta * data.speed * 7;

  // Every character walks generally towards the camera,
  // which corresponds to the bottom of the screen.
  const dx = Math.sin(data.angle);
  const dz = Math.cos(data.angle);

  character.position.x += dx * data.speed * delta;
  character.position.z += dz * data.speed * delta;

  // Face the direction of travel
  character.rotation.y = data.angle;

  // Walking animation
  const legSwing = Math.sin(data.animation) * 0.55;
  const armSwing = Math.sin(data.animation + Math.PI) * 0.4;

  data.leftLeg.rotation.x = legSwing;
  data.rightLeg.rotation.x = -legSwing;

  data.leftArm.rotation.x = armSwing;
  data.rightArm.rotation.x = -armSwing;

  // Subtle body bounce
  character.position.y =
    Math.abs(Math.sin(data.animation * 2)) * 0.04;

  // Walk completely off the bottom before respawning
  if (character.position.z > WORLD_BOTTOM) {
    spawnCharacter(character);
  }
}

// --------------------------------------------------
// ANIMATION LOOP
// --------------------------------------------------

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);

  for (const character of characters) {
    updateCharacter(character, delta);
  }

  renderer.render(scene, camera);
}

// --------------------------------------------------
// INITIALIZE
// --------------------------------------------------

async function start() {
  const sources = Object.values(faceFiles);

  if (sources.length === 0) {
    console.error("No face images found in assets/faces!");
    return;
  }

  const loaded = await Promise.all(
    sources.map(async (src, index) => {
      try {
        return await createCharacter(src, index);
      } catch (error) {
        console.error("Could not load character:", src, error);
        return null;
      }
    })
  );

  characters.push(...loaded.filter(Boolean));

  animate();
}

// --------------------------------------------------
// WINDOW RESIZE
// --------------------------------------------------

window.addEventListener("resize", () => {
  viewWidth = VIEW_HEIGHT * window.innerWidth / window.innerHeight;

  camera.left = -viewWidth / 2;
  camera.right = viewWidth / 2;
  camera.top = VIEW_HEIGHT / 2;
  camera.bottom = -VIEW_HEIGHT / 2;

  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
});

start();
