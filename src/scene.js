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

// Walkable area, written in IMAGE PIXELS so it's easy to tune against the photo (use ?debug and click
// to read pixel coordinates). It covers both far sidewalks, the far crosswalk and the whole foreground
// intersection down to WALK_BOTTOM; corners are projected onto the ground plane (y = 0). People pick
// random spots inside it, so it must stay below the horizon (~y 330 px) and should stay convex-ish.
export const WALK_BOTTOM = 760;           // lowest feet position in px: lower on the image = people come closer to the camera
export const NEAR_BIAS = 1.1;             // 1 = destinations spread evenly down the image; higher = more people near the camera
const WALK_AREA = [[0, 405], [300, 398], [640, 400], [1060, 400], [1380, 398], [1672, 405], [1672, WALK_BOTTOM], [0, WALK_BOTTOM]];

const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ray = new THREE.Raycaster();

/** Image pixel → point on the ground plane. */
export function imgToGround(camera, px, py) {
  ray.setFromCamera(new THREE.Vector2(px / IMG_W * 2 - 1, 1 - py / IMG_H * 2), camera);
  const p = new THREE.Vector3();
  return ray.ray.intersectPlane(ground, p) ? p : null;
}

const inPoly = (poly, x, y) => {             // even-odd point-in-polygon
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/** The walkable area on the ground: containment, clamping, and random spots to walk to. */
export function buildWalkArea(camera) {
  const ground = WALK_AREA.map(([x, y]) => imgToGround(camera, x, y));
  const poly = ground.map((p) => [p.x, p.z]);
  const xs = WALK_AREA.map((p) => p[0]), ys = WALK_AREA.map((p) => p[1]);
  const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const contains = (p, margin = 0) => inPoly(poly, p.x, p.z) && (margin === 0 || distToEdge(p) >= margin);
  const nearestOnEdge = (p) => {
    let best = null, bd = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, az] = poly[j], [bx, bz] = poly[i], ex = bx - ax, ez = bz - az;
      const t = Math.max(0, Math.min(1, ((p.x - ax) * ex + (p.z - az) * ez) / (ex * ex + ez * ez)));
      const x = ax + ex * t, z = az + ez * t, d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bd) { bd = d; best = [x, z]; }
    }
    return { x: best[0], z: best[1], d: Math.sqrt(bd) };
  };
  const distToEdge = (p) => nearestOnEdge(p).d;
  return {
    ground, contains,
    /** Pull a point that has been pushed outside back onto the edge (in place). */
    clamp(p) { if (!inPoly(poly, p.x, p.z)) { const e = nearestOnEdge(p); p.x = e.x; p.z = e.z; } return p; },
    /** Random spot, spread over the IMAGE (not the ground) and biased toward its bottom (NEAR_BIAS), so the
     *  foreground near the camera gets most of them. */
    randomPoint() {
      for (let k = 0; k < 50; k++) {
        const x = box[0] + Math.random() * (box[2] - box[0]), y = box[1] + Math.random() ** (1 / NEAR_BIAS) * (box[3] - box[1]);
        if (inPoly(WALK_AREA, x, y)) { const p = imgToGround(camera, x, y); if (p) return p; }
      }
      return ground[ground.length - 1].clone().lerp(ground[ground.length - 2], 0.5);
    },
    /** Random spot min..max metres away in any direction, inside the area (falls back to anywhere). */
    randomNear(from, min, max) {
      for (let k = 0; k < 16; k++) {
        const a = Math.random() * Math.PI * 2, d = min + Math.random() * (max - min);
        const p = new THREE.Vector3(from.x + Math.sin(a) * d, 0, from.z + Math.cos(a) * d);
        if (contains(p, 0.4)) return p;
      }
      return this.randomPoint();
    },
  };
}

/** ?debug overlay: ground grid and the walkable area's outline. */
export function drawDebug(scene, area) {
  const grid = new THREE.GridHelper(60, 60, 0xff00ff, 0xffffff);
  grid.position.z = -20; grid.material.transparent = true; grid.material.opacity = 0.35;
  scene.add(grid);
  const dot = new THREE.SphereGeometry(0.15, 12, 8), red = new THREE.MeshBasicMaterial({ color: 0xff2255 });
  for (const p of area.ground) { const m = new THREE.Mesh(dot, red); m.position.copy(p); scene.add(m); }
  const pts = [...area.ground, area.ground[0]].map((p) => p.clone().setY(0.02));
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffee00 })));
}
