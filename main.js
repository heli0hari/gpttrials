const canvas = document.querySelector('#app');
const statusEl = document.querySelector('#status');
const faceRow = document.querySelector('#faceRow');
const rotationValueEl = document.querySelector('#rotationValue');
const ctx = canvas.getContext('2d');

const FACE_COUNTS = Array.from({ length: 10 }, (_, i) => i + 3);
const POINT_COUNT = 1200;
const SCALE = 1.45;

let width = 0;
let height = 0;
let dpr = 1;

const camera = {
  yaw: 0.62,
  pitch: 0.35,
  distance: 7.8,
  focal: 860
};

const interaction = {
  dragging: false,
  x: 0,
  y: 0
};

const morph = {
  current: 1,
  target: 1,
  t: 1
};

const pointDirs = Array.from({ length: POINT_COUNT }, (_, i) => fibonacciDirection(i, POINT_COUNT));
const phaseJitter = Float32Array.from({ length: POINT_COUNT }, () => Math.random() * Math.PI * 2);
const shapes = FACE_COUNTS.map((faces) => buildShape(faces));

function buildShape(faceCount) {
  const normals = distributedNormals(faceCount);
  const points = new Float32Array(POINT_COUNT * 3);

  for (let i = 0; i < POINT_COUNT; i++) {
    const dir = pointDirs[i];
    const t = supportDistance(dir, normals, 1.2);
    points[i * 3] = dir[0] * t * SCALE;
    points[i * 3 + 1] = dir[1] * t * SCALE;
    points[i * 3 + 2] = dir[2] * t * SCALE;
  }

  return points;
}

function distributedNormals(count) {
  const result = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - (2 * i + 1) / count;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = i * 2.3999632297;
    result.push(normalize([Math.cos(theta) * r, y, Math.sin(theta) * r]));
  }
  return result;
}

function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
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
    const d = Math.max(1e-4, dir[0] * n[0] + dir[1] * n[1] + dir[2] * n[2]);
    minT = Math.min(minT, h / d);
  }
  return Math.max(0.1, minT);
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

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function morphPoint(i, out) {
  const a = shapes[morph.current];
  const b = shapes[morph.target];
  const mt = smoothstep(morph.t);
  out[0] = a[i] + (b[i] - a[i]) * mt;
  out[1] = a[i + 1] + (b[i + 1] - a[i + 1]) * mt;
  out[2] = a[i + 2] + (b[i + 2] - a[i + 2]) * mt;
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
    y: -y * scale + height * 0.52,
    scale,
    z
  };
}

function drawBackground(time) {
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#b4b8bf');
  bg.addColorStop(1, '#a8afb8');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(65, 72, 82, 0.12)';
  ctx.lineWidth = 1;
  const gridSpacing = 68;
  const shift = (time * 16) % gridSpacing;

  for (let x = -gridSpacing; x < width + gridSpacing; x += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(x + shift, height * 0.5);
    ctx.lineTo(x - 90 + shift, height);
    ctx.stroke();
  }

  for (let y = height * 0.56; y < height + gridSpacing; y += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y + shift * 0.35);
    ctx.lineTo(width, y + shift * 0.35);
    ctx.stroke();
  }
}

function draw(timeSec) {
  drawBackground(timeSec);

  const drawList = [];
  const tmp = [0, 0, 0];

  for (let i = 0; i < POINT_COUNT * 3; i += 3) {
    morphPoint(i, tmp);

    const pIdx = i / 3;
    const phase = timeSec * 1.8 + phaseJitter[pIdx];
    const pulse = 1 + Math.sin(phase) * 0.065;
    const wobble = Math.sin(phase * 0.57) * 0.05;

    const r = rotatePoint(tmp[0] * pulse, tmp[1] * (pulse + wobble), tmp[2] * pulse);
    const p = project(r[0], r[1], r[2]);
    if (!p) continue;

    drawList.push({
      x: p.x,
      y: p.y,
      z: p.z,
      radius: Math.max(1.5, (2.8 * p.scale) / 150),
      shade: 18 + Math.max(0, 45 - p.z * 7)
    });
  }

  drawList.sort((a, b) => a.z - b.z);
  for (const p of drawList) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(9, 14, 21, ${Math.min(0.86, 0.2 + p.shade / 100)})`;
    ctx.fill();
  }

  const currentAngle = ((camera.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  rotationValueEl.textContent = `${Math.round((currentAngle * 180) / Math.PI)}°`;
}

function renderFacePills() {
  faceRow.innerHTML = FACE_COUNTS.map((face, index) => {
    const active = index === morph.target ? 'active' : '';
    return `<span class="face-pill ${active}">${face}</span>`;
  }).join('');
}

function updateStatus(prefix = 'Active') {
  statusEl.textContent = `${prefix}: ${FACE_COUNTS[morph.target]} faces · Scroll to morph`;
  renderFacePills();
}

function animate(now) {
  if (morph.t < 1) {
    morph.t = Math.min(1, morph.t + 0.024);
    if (morph.t === 1) {
      updateStatus('Active');
    }
  }

  draw(now * 0.001);
  requestAnimationFrame(animate);
}

window.addEventListener('resize', resize);
window.addEventListener('contextmenu', (event) => event.preventDefault());

window.addEventListener('wheel', (event) => {
  event.preventDefault();
  const direction = Math.sign(event.deltaY);
  if (!direction) return;

  morph.current = morph.target;
  morph.target = (morph.target + (direction > 0 ? 1 : -1) + FACE_COUNTS.length) % FACE_COUNTS.length;
  morph.t = 0;
  updateStatus('Morphing');
}, { passive: false });

window.addEventListener('mousedown', (event) => {
  interaction.dragging = true;
  interaction.x = event.clientX;
  interaction.y = event.clientY;
});

window.addEventListener('mouseup', () => {
  interaction.dragging = false;
});

window.addEventListener('mouseleave', () => {
  interaction.dragging = false;
});

window.addEventListener('mousemove', (event) => {
  if (!interaction.dragging) return;
  const dx = event.clientX - interaction.x;
  const dy = event.clientY - interaction.y;
  interaction.x = event.clientX;
  interaction.y = event.clientY;
  camera.yaw += dx * 0.008;
  camera.pitch = Math.max(-1.35, Math.min(1.35, camera.pitch + dy * 0.008));
});

resize();
updateStatus('Active');
requestAnimationFrame(animate);
