import * as THREE from 'three';

// The background photo. Everything 3D is positioned so it lines up with this image.
export const IMG_W = 1672, IMG_H = 941;

// Camera matched to the photo by eye: eye height in metres, a slight downward pitch so the
// horizon lands at the street's vanishing point (about y = 330 px), and a vertical field of view.
export const CAM_HEIGHT = 1.6, CAM_PITCH_DEG = 8, CAM_FOV = 50;

export function setupCamera() {
  const camera = new THREE.PerspectiveCamera(CAM_FOV, IMG_W / IMG_H, 0.1, 200);
  camera.position.set(0, CAM_HEIGHT, 0);
  camera.rotation.set(THREE.MathUtils.degToRad(-CAM_PITCH_DEG), 0, 0); // looking down the street (−z)
  camera.updateMatrixWorld();
  return camera;
}

// Walk graph, written in IMAGE PIXELS so it's easy to tune against the photo (use ?debug and click
// to read pixel coordinates). Each node is projected onto the ground plane (y = 0).
//   A–B and D–E: far sidewalks · B–M1–M2–D: far crosswalk · B–G–H and D–I–J: side crosswalks
//   H–K–J: across the intersection (jaywalkers)
const NODES = {
  A: [70, 410],   B: [300, 404],  M1: [640, 410], M2: [1060, 410], D: [1380, 404], E: [1600, 412],
  G: [250, 480],  H: [340, 555],  I: [1430, 480], J: [1330, 555],  K: [840, 515],
};
const EDGES = [['A', 'B'], ['B', 'M1'], ['M1', 'M2'], ['M2', 'D'], ['D', 'E'],
  ['B', 'G'], ['G', 'H'], ['D', 'I'], ['I', 'J'], ['H', 'K'], ['K', 'J']];

const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ray = new THREE.Raycaster();

/** Image pixel → point on the ground plane. */
export function imgToGround(camera, px, py) {
  ray.setFromCamera(new THREE.Vector2(px / IMG_W * 2 - 1, 1 - py / IMG_H * 2), camera);
  const p = new THREE.Vector3();
  return ray.ray.intersectPlane(ground, p) ? p : null;
}

export function buildWalkGraph(camera) {
  const names = Object.keys(NODES);
  const nodes = names.map((n) => imgToGround(camera, ...NODES[n]));
  const idx = Object.fromEntries(names.map((n, i) => [n, i]));
  const edges = EDGES.map(([a, b]) => [idx[a], idx[b]]);
  const adj = nodes.map(() => []);
  for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
  return { names, nodes, edges, adj };
}

/** ?debug overlay: ground grid, nodes and edges. */
export function drawDebug(scene, graph) {
  const grid = new THREE.GridHelper(60, 60, 0xff00ff, 0xffffff);
  grid.position.z = -20; grid.material.transparent = true; grid.material.opacity = 0.35;
  scene.add(grid);
  const dot = new THREE.SphereGeometry(0.15, 12, 8), red = new THREE.MeshBasicMaterial({ color: 0xff2255 });
  for (const p of graph.nodes) { const m = new THREE.Mesh(dot, red); m.position.copy(p); scene.add(m); }
  const pts = graph.edges.flatMap(([a, b]) => [graph.nodes[a], graph.nodes[b]]);
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffee00 })));
}
