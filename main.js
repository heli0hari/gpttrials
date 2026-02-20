const canvas = document.querySelector('#app');
const statusEl = document.querySelector('#status');
const ctx = canvas.getContext('2d');

const PHI = (1 + Math.sqrt(5)) / 2;
const POINT_COUNT = 900;
const SPACING = 2.8;
const SHAPE_NAMES = ['Cube', 'Octahedron', 'Dodecahedron', 'Icosahedron'];

let width = 0;
let height = 0;
let dpr = 1;
let shapeCount = 1;

const camera = {
  yaw: 0.55,
  pitch: 0.45,
  distance: 7.5,
  focal: 700
};

const rotation = {
  dragging: false,
  lastX: 0,
  lastY: 0
};

const morph = {
  current: 0,
  target: 0,
  t: 1
};

const planeSets = {
  cube: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1]
  ],
  octahedron: [
    [1, 1, 1],
    [1, 1, -1],
    [1, -1, 1],
    [-1, 1, 1]
  ].map(normalize),
  dodecahedron: [
    [0, 1, PHI],
    [0, 1, -PHI],
    [1, PHI, 0],
    [1, -PHI, 0],
    [PHI, 0, 1],
    [PHI, 0, -1]
  ].map(normalize),
  icosahedron: [
    [1, 1, 1],
    [0, 1 / PHI, PHI],
    [1 / PHI, PHI, 0],
    [PHI, 0, 1 / PHI],
    [0, 1 / PHI, -PHI],
    [1 / PHI, -PHI, 0],
    [PHI, 0, -1 / PHI]
  ].map(normalize)
};

const shapeClouds = [
  buildPointCloud(planeSets.cube, 1.25),
  buildPointCloud(planeSets.octahedron, 1.65),
  buildPointCloud(planeSets.dodecahedron, 1.85),
  buildPointCloud(planeSets.icosahedron, 1.75)
];

function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function buildPointCloud(normals, planeDistance) {
  const points = new Float32Array(POINT_COUNT * 3);

  for (let i = 0; i < POINT_COUNT; i++) {
    const dir = fibonacciDirection(i, POINT_COUNT);
    const t = supportDistance(dir, normals, planeDistance);
    points[i * 3] = dir[0] * t;
    points[i * 3 + 1] = dir[1] * t;
    points[i * 3 + 2] = dir[2] * t;
  }

  return points;
}

function fibonacciDirection(i, n) {
  const y = 1 - (2 * i + 1) / n;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = i * 2.3999632297;
  return [Math.cos(theta) * r, y, Math.sin(theta) * r];
}

function supportDistance(dir, normals, h) {
  let minT = Infinity;
  for (const n of normals) {
    const d = Math.abs(dir[0] * n[0] + dir[1] * n[1] + dir[2] * n[2]);
    if (d > 1e-6) {
      minT = Math.min(minT, h / d);
    }
  }
  return Number.isFinite(minT) ? minT : 0;
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function setStatus(text) {
  statusEl.textContent = text;
}

function shapeLabel(index) {
  return SHAPE_NAMES[index] ?? 'Shape';
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function morphPoint(i, out) {
  const from = shapeClouds[morph.current];
  const to = shapeClouds[morph.target];
  const mt = smoothstep(morph.t);
  out[0] = from[i] + (to[i] - from[i]) * mt;
  out[1] = from[i + 1] + (to[i + 1] - from[i + 1]) * mt;
  out[2] = from[i + 2] + (to[i + 2] - from[i + 2]) * mt;
}

function rotatePoint(x, y, z) {
  const cp = Math.cos(camera.pitch);
  const sp = Math.sin(camera.pitch);
  const cy = Math.cos(camera.yaw);
  const sy = Math.sin(camera.yaw);

  const x1 = x * cy - z * sy;
  const z1 = x * sy + z * cy;
  const y2 = y * cp - z1 * sp;
  const z2 = y * sp + z1 * cp;
  return [x1, y2, z2];
}

function project(x, y, z) {
  const depth = z + camera.distance;
  if (depth <= 0.001) return null;
  const scale = camera.focal / depth;
  return {
    x: x * scale + width * 0.5,
    y: -y * scale + height * 0.56,
    depth,
    scale
  };
}

function draw() {
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createRadialGradient(width * 0.5, height * 0.3, 20, width * 0.5, height * 0.6, width * 0.9);
  gradient.addColorStop(0, '#111827');
  gradient.addColorStop(1, '#030712');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const drawList = [];
  const tmp = [0, 0, 0];

  for (let s = 0; s < shapeCount; s++) {
    const offsetX = (s - (shapeCount - 1) / 2) * SPACING;
    for (let i = 0; i < POINT_COUNT * 3; i += 3) {
      morphPoint(i, tmp);
      const r = rotatePoint(tmp[0] + offsetX, tmp[1], tmp[2]);
      const p = project(r[0], r[1], r[2]);
      if (!p) continue;
      drawList.push({
        x: p.x,
        y: p.y,
        z: r[2],
        radius: Math.max(1.2, 2.8 * p.scale / 140),
        hue: ((s * 35 + i * 0.03) % 360 + 360) % 360,
        light: Math.max(42, Math.min(78, 58 + r[1] * 5 - r[2] * 3))
      });
    }
  }

  drawList.sort((a, b) => a.z - b.z);

  for (const p of drawList) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${p.hue}, 88%, ${p.light}%, 0.86)`;
    ctx.fill();
  }
}

function animate() {
  if (morph.t < 1) {
    morph.t = Math.min(1, morph.t + 0.03);
    if (morph.t === 1) {
      setStatus(`Shapes: ${shapeCount} | Active form: ${shapeLabel(morph.target)}`);
    }
  }
  draw();
  requestAnimationFrame(animate);
}

window.addEventListener('resize', resize);
window.addEventListener('contextmenu', (event) => event.preventDefault());
window.addEventListener('wheel', (event) => {
  event.preventDefault();
  const direction = Math.sign(event.deltaY);
  if (!direction) return;
  morph.current = morph.target;
  morph.target = (morph.target + (direction > 0 ? 1 : -1) + shapeClouds.length) % shapeClouds.length;
  morph.t = 0;
  setStatus(`Shapes: ${shapeCount} | Morphing: ${shapeLabel(morph.current)} → ${shapeLabel(morph.target)}`);
}, { passive: false });

window.addEventListener('mousedown', (event) => {
  if (event.button === 1) {
    rotation.dragging = true;
    rotation.lastX = event.clientX;
    rotation.lastY = event.clientY;
  } else if (event.button === 0) {
    shapeCount = Math.min(12, shapeCount + 1);
    setStatus(`Shapes: ${shapeCount} | Active form: ${shapeLabel(morph.target)}`);
  } else if (event.button === 2) {
    shapeCount = Math.max(1, shapeCount - 1);
    setStatus(`Shapes: ${shapeCount} | Active form: ${shapeLabel(morph.target)}`);
  }
});

window.addEventListener('mousemove', (event) => {
  if (!rotation.dragging) return;
  const dx = event.clientX - rotation.lastX;
  const dy = event.clientY - rotation.lastY;
  rotation.lastX = event.clientX;
  rotation.lastY = event.clientY;
  camera.yaw += dx * 0.008;
  camera.pitch = Math.max(-1.35, Math.min(1.35, camera.pitch + dy * 0.008));
});

window.addEventListener('mouseup', (event) => {
  if (event.button === 1) {
    rotation.dragging = false;
  }
});

resize();
setStatus(`Shapes: ${shapeCount} | Active form: ${shapeLabel(morph.target)}`);
animate();
