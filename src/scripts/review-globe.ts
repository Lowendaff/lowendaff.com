import {
  decodeGeographicArc,
  globePoint,
  layoutGlobeLabels,
  type GlobeLabelAnchor,
  unwrapGeographicLine,
  unwrapLandRing,
} from '../lib/globe-geometry';
import type { ReviewPlace } from '../lib/review-map';
import { onThemeChange } from '../lib/ui-client';

type Place = Pick<ReviewPlace, 'id' | 'city' | 'latitude' | 'longitude'> & {
  count: number;
};

type Vec3 = [number, number, number];
type LinearRgb = [number, number, number];

const MIN_DISTANCE = 1.65;
const MAX_DISTANCE = 5.2;
const MIN_POLAR = 0.07;
const MAX_POLAR = Math.PI - 0.07;
const ROTATE_SPEED = 0.55;
const ZOOM_SPEED = 0.7;
const DAMPING_FACTOR = 0.09;

function srgbToLinearChannel(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgbChannel(c: number): number {
  return c <= 0.0031308
    ? c * 12.92
    : 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055;
}

let colorProbeCtx: CanvasRenderingContext2D | null | undefined;

function parseCssLinearColor(raw: string): LinearRgb {
  const s = raw.trim();
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    let r = 0;
    let g = 0;
    let b = 0;
    if (hex.length === 3 || hex.length === 4) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length >= 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
    return [
      srgbToLinearChannel(r / 255),
      srgbToLinearChannel(g / 255),
      srgbToLinearChannel(b / 255),
    ];
  }
  const rgbMatch = s.match(
    /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)/i,
  );
  if (rgbMatch) {
    return [
      srgbToLinearChannel(Number(rgbMatch[1]) / 255),
      srgbToLinearChannel(Number(rgbMatch[2]) / 255),
      srgbToLinearChannel(Number(rgbMatch[3]) / 255),
    ];
  }
  if (colorProbeCtx === undefined) {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    colorProbeCtx = c.getContext('2d', { willReadFrequently: true });
  }
  if (colorProbeCtx) {
    colorProbeCtx.clearRect(0, 0, 1, 1);
    colorProbeCtx.fillStyle = s;
    colorProbeCtx.fillRect(0, 0, 1, 1);
    const [r, g, b] = colorProbeCtx.getImageData(0, 0, 1, 1).data;
    return [
      srgbToLinearChannel(r / 255),
      srgbToLinearChannel(g / 255),
      srgbToLinearChannel(b / 255),
    ];
  }
  return [0, 0, 0];
}

function lerpColor(a: LinearRgb, b: LinearRgb, t: number): LinearRgb {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function colorToStyle(c: LinearRgb): string {
  const r = Math.min(
    255,
    Math.max(0, Math.round(linearToSrgbChannel(c[0]) * 255)),
  );
  const g = Math.min(
    255,
    Math.max(0, Math.round(linearToSrgbChannel(c[1]) * 255)),
  );
  const b = Math.min(
    255,
    Math.max(0, Math.round(linearToSrgbChannel(c[2]) * 255)),
  );
  return `rgb(${r},${g},${b})`;
}

function vecLength(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

function vecLengthSq(v: Vec3): number {
  return v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
}

function vecNormalize(v: Vec3): Vec3 {
  const len = vecLength(v) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function vecDot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function vecSetLength(v: Vec3, len: number): Vec3 {
  const scale = len / (vecLength(v) || 1);
  return [v[0] * scale, v[1] * scale, v[2] * scale];
}

function rotateAroundY(v: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}

function vecToSpherical(v: Vec3): {
  radius: number;
  phi: number;
  theta: number;
} {
  const radius = vecLength(v);
  if (radius === 0) return { radius: 0, phi: 0, theta: 0 };
  const phi = Math.acos(Math.max(-1, Math.min(1, v[1] / radius)));
  const theta = Math.atan2(v[0], v[2]);
  return { radius, phi, theta };
}

function sphericalToVec(radius: number, phi: number, theta: number): Vec3 {
  const sinPhiRadius = Math.sin(phi) * radius;
  return [
    sinPhiRadius * Math.sin(theta),
    Math.cos(phi) * radius,
    sinPhiRadius * Math.cos(theta),
  ];
}

function writeLookAtOrigin(out: Float32Array, eye: Vec3) {
  const [zx, zy, zz] = vecNormalize(eye);
  // up = (0, 1, 0), so cross(up, z) = (zz, 0, -zx)
  let xx = zz;
  let xy = 0;
  let xz = -zx;
  const xLen = Math.hypot(xx, xz) || 1;
  xx /= xLen;
  xz /= xLen;
  // y = cross(z, x)
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  out[0] = xx;
  out[4] = xy;
  out[8] = xz;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[1] = yx;
  out[5] = yy;
  out[9] = yz;
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[2] = zx;
  out[6] = zy;
  out[10] = zz;
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[3] = 0;
  out[7] = 0;
  out[11] = 0;
  out[15] = 1;
}

function writePerspective(
  out: Float32Array,
  fovDeg: number,
  aspect: number,
  near: number,
  far: number,
) {
  const f = 1 / Math.tan((fovDeg * Math.PI) / 360);
  const nf = 1 / (near - far);
  out.fill(0);
  out[0] = f / (aspect || 1);
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
}

function buildSphereMesh(widthSegments: number, heightSegments: number) {
  const vertexCount = (widthSegments + 1) * (heightSegments + 1);
  const vertices = new Float32Array(vertexCount * 5);
  const indices = new Uint16Array(widthSegments * heightSegments * 6);
  let vOffset = 0;
  for (let iy = 0; iy <= heightSegments; iy++) {
    const v = iy / heightSegments;
    const lat = 90 - v * 180;
    for (let ix = 0; ix <= widthSegments; ix++) {
      const u = ix / widthSegments;
      const lon = -180 + u * 360;
      const [x, y, z] = globePoint(lat, lon, 1);
      vertices[vOffset++] = x;
      vertices[vOffset++] = y;
      vertices[vOffset++] = z;
      vertices[vOffset++] = u;
      vertices[vOffset++] = v;
    }
  }
  let iOffset = 0;
  const stride = widthSegments + 1;
  for (let iy = 0; iy < heightSegments; iy++) {
    for (let ix = 0; ix < widthSegments; ix++) {
      const p00 = iy * stride + ix;
      const p10 = p00 + 1;
      const p01 = p00 + stride;
      const p11 = p01 + 1;
      indices[iOffset++] = p00;
      indices[iOffset++] = p01;
      indices[iOffset++] = p10;
      indices[iOffset++] = p10;
      indices[iOffset++] = p01;
      indices[iOffset++] = p11;
    }
  }
  return { vertices, indices };
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('无法创建着色器');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || 'Shader compile error';
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
}

export async function createReviewGlobe(
  root: HTMLElement,
  initialPlaces: Place[],
  onSelect: (id: string) => void,
) {
  const viewport = root.querySelector<HTMLElement>('[data-globe-viewport]')!;
  const stage = root.querySelector<HTMLElement>('[data-globe-scene]')!;
  const stageBox =
    root.querySelector<HTMLElement>('.atlas-globe-stage') ?? viewport;
  const markerLayer = root.querySelector<HTMLElement>('[data-globe-markers]')!;
  const coordinateLabel = root.querySelector<HTMLElement>(
    '[data-globe-coordinates]',
  )!;

  const canvas = document.createElement('canvas');
  canvas.style.touchAction = 'none';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    '交互式测评地球，可使用方向键旋转，加减键缩放，Home 键复位',
  );
  canvas.setAttribute('aria-describedby', 'globe-instructions');

  const glAttrs: WebGLContextAttributes = {
    antialias: true,
    alpha: true,
    depth: true,
    stencil: false,
    powerPreference: 'low-power',
  };
  const gl =
    (canvas.getContext('webgl2', glAttrs) as WebGLRenderingContext | null) ||
    (canvas.getContext('webgl', glAttrs) as WebGLRenderingContext | null);
  if (!gl) {
    throw new Error('当前浏览器无法初始化 WebGL');
  }

  viewport.append(canvas);

  let land: number[][][][];
  let borders: number[][][];
  try {
    const response = await fetch('/globe/geography-50m.json', {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('无法加载地理轮廓');
    const geography = (await response.json()) as {
      scale?: number;
      land: (number[][] | number[])[][];
      borders: (number[][] | number[])[];
    };
    land = geography.land.map((polygon) =>
      polygon.map((ring) =>
        unwrapLandRing(decodeGeographicArc(ring, geography.scale)),
      ),
    );
    borders = geography.borders.map((line) =>
      unwrapGeographicLine(decodeGeographicArc(line, geography.scale)),
    );
  } catch (error) {
    canvas.remove();
    throw error;
  }

  const maxTexSize = (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) || 2048;
  const atlas = document.createElement('canvas');
  atlas.width = Math.min(4096, maxTexSize);
  atlas.height = atlas.width / 2;
  const lineScale = atlas.width / 2048;
  const context = atlas.getContext('2d');
  if (!context) {
    canvas.remove();
    throw new Error('无法绘制地理轮廓');
  }

  const vertShader = compileShader(
    gl,
    gl.VERTEX_SHADER,
    `attribute vec3 aPos;
     attribute vec2 aUv;
     uniform mat4 uView;
     uniform mat4 uProj;
     varying vec2 vUv;
     varying vec3 vNormal;
     varying vec3 vView;
     void main() {
       vUv = aUv;
       vec4 p = uView * vec4(aPos, 1.0);
       vNormal = mat3(uView) * aPos;
       vView = -p.xyz;
       gl_Position = uProj * p;
     }`,
  );
  const fragShader = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    `precision mediump float;
     uniform sampler2D uAtlas;
     varying vec2 vUv;
     varying vec3 vNormal;
     varying vec3 vView;
     vec3 srgbToLinear(vec3 c) {
       return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
     }
     vec3 linearToSrgb(vec3 c) {
       return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
     }
     void main() {
       vec3 texel = texture2D(uAtlas, vUv).rgb;
       vec3 linear = srgbToLinear(texel);
       float facing = max(0.0, dot(normalize(vNormal), normalize(vView)));
       vec3 shaded = linear * (0.82 + 0.18 * smoothstep(0.0, 0.85, facing));
       gl_FragColor = vec4(linearToSrgb(shaded), 1.0);
     }`,
  );
  const program = gl.createProgram()!;
  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);
  gl.deleteShader(vertShader);
  gl.deleteShader(fragShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || 'Program link error';
    gl.deleteProgram(program);
    canvas.remove();
    throw new Error(info);
  }

  const aPosLoc = gl.getAttribLocation(program, 'aPos');
  const aUvLoc = gl.getAttribLocation(program, 'aUv');
  const uViewLoc = gl.getUniformLocation(program, 'uView');
  const uProjLoc = gl.getUniformLocation(program, 'uProj');
  const uAtlasLoc = gl.getUniformLocation(program, 'uAtlas');

  const { vertices, indices } = buildSphereMesh(96, 64);
  const indexCount = indices.length;
  const vbo = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const ibo = gl.createBuffer()!;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const anisoExt =
    gl.getExtension('EXT_texture_filter_anisotropic') ||
    gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
  if (anisoExt) {
    const maxAniso =
      (gl.getParameter(anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number) || 1;
    gl.texParameterf(
      gl.TEXTURE_2D,
      anisoExt.TEXTURE_MAX_ANISOTROPY_EXT,
      Math.min(4, maxAniso),
    );
  }

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.clearColor(0, 0, 0, 0);

  let textureDirty = true;

  // Coastlines and shared country borders use one topology and live site tokens.
  function paintTheme() {
    const css = getComputedStyle(root);
    const token = (name: string) =>
      parseCssLinearColor(css.getPropertyValue(name));
    const ocean = token('--raised');
    const borderToken = token('--border');
    const mutedToken = token('--muted');
    const landColor = lerpColor(borderToken, token('--accent'), 0.12);
    const grid = lerpColor(ocean, borderToken, 0.38);
    const coast = lerpColor(landColor, mutedToken, 0.45);
    const boundary = lerpColor(landColor, mutedToken, 0.72);

    context!.fillStyle = colorToStyle(ocean);
    context!.fillRect(0, 0, atlas.width, atlas.height);
    context!.lineWidth = 0.7 * lineScale;
    context!.strokeStyle = colorToStyle(grid);
    context!.beginPath();
    for (let lon = -180; lon <= 180; lon += 30) {
      const x = ((lon + 180) / 360) * atlas.width;
      context!.moveTo(x, 0);
      context!.lineTo(x, atlas.height);
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = ((90 - lat) / 180) * atlas.height;
      context!.moveTo(0, y);
      context!.lineTo(atlas.width, y);
    }
    context!.stroke();
    context!.fillStyle = colorToStyle(landColor);
    context!.strokeStyle = colorToStyle(coast);
    context!.lineWidth = 0.85 * lineScale;
    for (const offset of [-atlas.width, 0, atlas.width])
      for (const polygon of land) {
        context!.beginPath();
        for (const ring of polygon) {
          ring.forEach(([longitude, latitude], index) => {
            const x = ((longitude + 180) / 360) * atlas.width + offset;
            const y = ((90 - latitude) / 180) * atlas.height;
            if (!index) context!.moveTo(x, y);
            else context!.lineTo(x, y);
          });
          context!.closePath();
        }
        context!.fill('evenodd');
        context!.stroke();
      }
    // Shared arcs are drawn once, without closing open borders or adding state lines.
    context!.strokeStyle = colorToStyle(boundary);
    context!.lineWidth = 0.8 * lineScale;
    context!.lineJoin = 'round';
    context!.lineCap = 'round';
    context!.beginPath();
    for (const offset of [-atlas.width, 0, atlas.width])
      for (const line of borders)
        line.forEach(([longitude, latitude], index) => {
          const x = ((longitude + 180) / 360) * atlas.width + offset;
          const y = ((90 - latitude) / 180) * atlas.height;
          if (!index) context!.moveTo(x, y);
          else context!.lineTo(x, y);
        });
    context!.stroke();
    textureDirty = true;
    requestDraw();
  }

  const baseHalfTan = Math.tan((40 * Math.PI) / 360);
  let cameraFov = 40;
  let cameraAspect = 1;
  const viewMatrix = new Float32Array(16);
  const projMatrix = new Float32Array(16);
  writePerspective(projMatrix, cameraFov, cameraAspect, 0.1, 30);

  let home = initialPlaces[0] ?? { latitude: 20, longitude: 25 };
  const homeDistance = () => (stageBox.clientWidth < 500 ? 3.8 : 3.4);
  let cameraPos: Vec3 = globePoint(
    home.latitude,
    home.longitude,
    homeDistance(),
  );

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let enableDamping = !reducedMotion.matches;
  let deltaTheta = 0;
  let deltaPhi = 0;
  let scaleFactor = 1;

  function clearInertia() {
    deltaTheta = 0;
    deltaPhi = 0;
    scaleFactor = 1;
  }

  function applyOrbitStep(damping: boolean): boolean {
    if (
      Math.abs(deltaTheta) < 1e-6 &&
      Math.abs(deltaPhi) < 1e-6 &&
      Math.abs(scaleFactor - 1) < 1e-6
    ) {
      deltaTheta = 0;
      deltaPhi = 0;
      scaleFactor = 1;
      return false;
    }
    const sph = vecToSpherical(cameraPos);
    if (damping) {
      sph.theta += deltaTheta * DAMPING_FACTOR;
      sph.phi += deltaPhi * DAMPING_FACTOR;
      deltaTheta *= 1 - DAMPING_FACTOR;
      deltaPhi *= 1 - DAMPING_FACTOR;
    } else {
      sph.theta += deltaTheta;
      sph.phi += deltaPhi;
      deltaTheta = 0;
      deltaPhi = 0;
    }
    sph.phi = Math.max(MIN_POLAR, Math.min(MAX_POLAR, sph.phi));
    sph.radius = Math.max(
      MIN_DISTANCE,
      Math.min(MAX_DISTANCE, sph.radius * scaleFactor),
    );
    scaleFactor = 1;
    cameraPos = sphericalToVec(sph.radius, sph.phi, sph.theta);
    return (
      damping && (Math.abs(deltaTheta) >= 1e-5 || Math.abs(deltaPhi) >= 1e-5)
    );
  }

  let frame = 0;
  let visible = true;
  let disposed = false;
  let pointer: { x: number; y: number; overAction: boolean } | undefined;
  let paused = false;
  let keyboardNavigation = false;
  const pointers = new Set<number>();
  const activeCanvasPointers = new Map<number, { x: number; y: number }>();
  let previousPinchDist = 0;
  let previousFrame: number | undefined;
  let spinVelocity = 0;
  let holdUntil = 0;
  let holdTimer = 0;
  // Gentle, clearly perceptible planetary drift (~95s per full revolution).
  const spinRate = (Math.PI * 2) / 95;
  let flight:
    | {
        start: number;
        duration: number;
        fromLat: number;
        fromLon: number;
        deltaLat: number;
        deltaLon: number;
        fromDistance: number;
        toDistance: number;
        arcLift: number;
      }
    | undefined;
  let selectedId = '';
  let hoveredId = '';
  let markers: {
    button: HTMLButtonElement;
    position: Vec3;
    normal: Vec3;
    place: Place;
    label: HTMLSpanElement;
    labelWidth: number;
    labelHeight: number;
    prevAnchor?: GlobeLabelAnchor;
  }[] = [];

  const events = new AbortController();
  const zoomButtons = [
    ...root.querySelectorAll<HTMLButtonElement>('[data-globe-zoom]'),
  ];

  onThemeChange(() => paintTheme(), events.signal);
  paintTheme();

  function cancelGuidedMotion() {
    flight = undefined;
    holdUntil = 0;
    window.clearTimeout(holdTimer);
  }

  canvas.addEventListener(
    'pointerdown',
    (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      cancelGuidedMotion();
      activeCanvasPointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      canvas.setPointerCapture(event.pointerId);
      if (activeCanvasPointers.size === 2) {
        const [a, b] = [...activeCanvasPointers.values()];
        previousPinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
      requestDraw();
    },
    { signal: events.signal },
  );

  canvas.addEventListener(
    'pointermove',
    (event) => {
      const prev = activeCanvasPointers.get(event.pointerId);
      if (!prev) return;
      const next = { x: event.clientX, y: event.clientY };
      activeCanvasPointers.set(event.pointerId, next);
      const clientH = Math.max(1, canvas.clientHeight || viewport.clientHeight);
      if (activeCanvasPointers.size === 1) {
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const factor = (2 * Math.PI * ROTATE_SPEED) / clientH;
        deltaTheta -= dx * factor;
        deltaPhi -= dy * factor;
        requestDraw();
      } else if (activeCanvasPointers.size === 2) {
        const [a, b] = [...activeCanvasPointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (previousPinchDist > 0 && dist > 0) {
          scaleFactor *= Math.pow(previousPinchDist / dist, ZOOM_SPEED);
          requestDraw();
        }
        previousPinchDist = dist;
      }
    },
    { signal: events.signal },
  );

  const releaseCanvasPointer = (event: PointerEvent) => {
    if (!activeCanvasPointers.delete(event.pointerId)) return;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    if (activeCanvasPointers.size < 2) previousPinchDist = 0;
    requestDraw();
  };
  canvas.addEventListener('pointerup', releaseCanvasPointer, {
    signal: events.signal,
  });
  canvas.addEventListener('pointercancel', releaseCanvasPointer, {
    signal: events.signal,
  });

  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      cancelGuidedMotion();
      const step = Math.pow(0.95, ZOOM_SPEED);
      if (event.deltaY < 0) scaleFactor *= step;
      else if (event.deltaY > 0) scaleFactor /= step;
      requestDraw();
    },
    { passive: false, signal: events.signal },
  );

  function pointerOverGlobe() {
    if (!pointer) return false;
    if (pointer.overAction) return true;
    const stageBounds = stageBox.getBoundingClientRect();
    const bounds = viewport.getBoundingClientRect();
    const rawRadius =
      bounds.height /
      (2 *
        Math.tan((cameraFov * Math.PI) / 360) *
        Math.sqrt(Math.max(0.04, vecLengthSq(cameraPos) - 1)));
    const maxStageRadius = Math.max(
      80,
      Math.floor(Math.min(stageBounds.width, stageBounds.height) / 2 - 8),
    );
    const radius = Math.min(rawRadius, maxStageRadius);
    const x = pointer.x - stageBounds.left - stageBounds.width / 2;
    const y = pointer.y - stageBounds.top - stageBounds.height / 2;
    return (
      pointer.x >= stageBounds.left &&
      pointer.x <= stageBounds.right &&
      pointer.y >= stageBounds.top &&
      pointer.y <= stageBounds.bottom &&
      x * x + y * y <= radius * radius
    );
  }

  function vectorToLatLon(vec: Vec3) {
    const dir = vecNormalize(vec);
    const lat = (Math.asin(Math.max(-1, Math.min(1, dir[1]))) * 180) / Math.PI;
    const lon = (Math.atan2(-dir[2], dir[0]) * 180) / Math.PI;
    return { lat, lon };
  }

  function shortestDeltaLon(fromLon: number, toLon: number) {
    return ((((toLon - fromLon) % 360) + 540) % 360) - 180;
  }

  function easeInOutCubic(t: number) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function canSpin(now = performance.now()) {
    return (
      !reducedMotion.matches &&
      !pointerOverGlobe() &&
      !paused &&
      !pointers.size &&
      !flight &&
      now >= holdUntil &&
      !(keyboardNavigation && stage.contains(document.activeElement))
    );
  }

  function scheduleHoldWakeup(delayMs: number) {
    window.clearTimeout(holdTimer);
    holdTimer = window.setTimeout(() => {
      holdTimer = 0;
      requestDraw();
    }, delayMs);
  }

  function renderWebGL() {
    if (gl!.isContextLost()) return;
    if (textureDirty) {
      textureDirty = false;
      gl!.bindTexture(gl!.TEXTURE_2D, texture);
      gl!.texImage2D(
        gl!.TEXTURE_2D,
        0,
        gl!.RGBA,
        gl!.RGBA,
        gl!.UNSIGNED_BYTE,
        atlas,
      );
      gl!.generateMipmap(gl!.TEXTURE_2D);
    }
    gl!.viewport(0, 0, canvas.width, canvas.height);
    gl!.clear(gl!.COLOR_BUFFER_BIT | gl!.DEPTH_BUFFER_BIT);
    gl!.useProgram(program);

    gl!.bindBuffer(gl!.ARRAY_BUFFER, vbo);
    gl!.enableVertexAttribArray(aPosLoc);
    gl!.vertexAttribPointer(aPosLoc, 3, gl!.FLOAT, false, 20, 0);
    gl!.enableVertexAttribArray(aUvLoc);
    gl!.vertexAttribPointer(aUvLoc, 2, gl!.FLOAT, false, 20, 12);

    gl!.bindBuffer(gl!.ELEMENT_ARRAY_BUFFER, ibo);
    gl!.activeTexture(gl!.TEXTURE0);
    gl!.bindTexture(gl!.TEXTURE_2D, texture);
    gl!.uniform1i(uAtlasLoc, 0);
    gl!.uniformMatrix4fv(uViewLoc, false, viewMatrix);
    gl!.uniformMatrix4fv(uProjLoc, false, projMatrix);
    gl!.drawElements(gl!.TRIANGLES, indexCount, gl!.UNSIGNED_SHORT, 0);
  }

  function draw(now: number) {
    frame = 0;
    if (disposed || !visible || document.hidden) return;
    const wallNow = performance.now();
    const delta =
      previousFrame === undefined
        ? 0
        : Math.min((now - previousFrame) / 1000, 0.05);
    previousFrame = now;
    const spinning = canSpin(wallNow);
    if (spinning) {
      spinVelocity += (spinRate - spinVelocity) * (1 - Math.exp(-delta / 0.75));
      cameraPos = rotateAroundY(cameraPos, spinVelocity * delta);
    } else {
      spinVelocity = 0;
    }

    let dampingActive = false;
    if (flight) {
      const t = Math.min(1, (wallNow - flight.start) / flight.duration);
      const ease = easeInOutCubic(t);
      const lat = flight.fromLat + flight.deltaLat * ease;
      const lon = flight.fromLon + flight.deltaLon * ease;
      const radius =
        flight.fromDistance +
        (flight.toDistance - flight.fromDistance) * ease +
        Math.sin(Math.PI * ease) * flight.arcLift;
      cameraPos = globePoint(lat, lon, radius);
      if (t >= 1) {
        cameraPos = globePoint(
          flight.fromLat + flight.deltaLat,
          flight.fromLon + flight.deltaLon,
          flight.toDistance,
        );
        flight = undefined;
        if (!reducedMotion.matches && !paused) {
          holdUntil = wallNow + 1100;
          scheduleHoldWakeup(1120);
        }
      }
      clearInertia();
    } else {
      dampingActive = applyOrbitStep(enableDamping);
    }

    writeLookAtOrigin(viewMatrix, cameraPos);
    renderWebGL();

    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    const stageWidth = stageBox.clientWidth || width;
    const stageHeight = stageBox.clientHeight || height;
    const offsetX = (width - stageWidth) / 2;
    const offsetY = (height - stageHeight) / 2;
    const distance = vecLength(cameraPos);
    const sphereRadius =
      height /
      (2 *
        Math.tan((cameraFov * Math.PI) / 360) *
        Math.sqrt(Math.max(0.04, distance * distance - 1)));
    const maxStageRadius = Math.max(
      80,
      Math.floor(Math.min(stageWidth, stageHeight) / 2 - 8),
    );
    const rawClipRadius = Math.ceil(sphereRadius + 2);
    const clippedByStage = rawClipRadius > maxStageRadius;
    const activeClipRadius = clippedByStage ? maxStageRadius : rawClipRadius;
    canvas.style.clipPath = `circle(${activeClipRadius}px at 50% 50%)`;
    stageBox.dataset.zoomClipped = String(clippedByStage);
    stageBox.style.setProperty(
      '--globe-clip-diameter',
      `${activeClipRadius * 2}px`,
    );

    const facing = vecNormalize(cameraPos);
    const visibleMarkers: {
      marker: (typeof markers)[number];
      x: number;
      y: number;
    }[] = [];
    for (const marker of markers) {
      const { button, position, normal } = marker;
      const vx =
        viewMatrix[0] * position[0] +
        viewMatrix[4] * position[1] +
        viewMatrix[8] * position[2] +
        viewMatrix[12];
      const vy =
        viewMatrix[1] * position[0] +
        viewMatrix[5] * position[1] +
        viewMatrix[9] * position[2] +
        viewMatrix[13];
      const vz =
        viewMatrix[2] * position[0] +
        viewMatrix[6] * position[1] +
        viewMatrix[10] * position[2] +
        viewMatrix[14];
      const w = Math.max(1e-5, -vz);
      const ndcX = (projMatrix[0] * vx) / w;
      const ndcY = (projMatrix[5] * vy) / w;
      const x = (ndcX * 0.5 + 0.5) * width - offsetX;
      const y = (-ndcY * 0.5 + 0.5) * height - offsetY;
      const dx = x - stageWidth / 2;
      const dy = y - stageHeight / 2;
      const maxMarkerRadius = Math.max(0, activeClipRadius - 4);
      const hidden =
        vecDot(normal, facing) < 1 / distance + 0.025 ||
        dx * dx + dy * dy > maxMarkerRadius * maxMarkerRadius ||
        x < 12 ||
        x > stageWidth - 12 ||
        y < 18 ||
        y > stageHeight - 18;
      if (button.hidden !== hidden) button.hidden = hidden;
      if (!hidden) {
        button.style.left = `${x}px`;
        button.style.top = `${y}px`;
        visibleMarkers.push({ marker, x, y });
      }
    }

    for (const { marker } of visibleMarkers) {
      if (!marker.labelWidth) {
        if (marker.label.hidden) marker.label.hidden = false;
        marker.labelWidth = marker.label.offsetWidth;
        marker.labelHeight = marker.label.offsetHeight;
      }
    }

    const placements = layoutGlobeLabels(
      visibleMarkers.map(({ marker, x, y }) => ({
        id: marker.place.id,
        x,
        y,
        labelWidth: marker.labelWidth,
        labelHeight: marker.labelHeight,
        count: marker.place.count,
        active: selectedId === marker.place.id || hoveredId === marker.place.id,
        prevAnchor: marker.prevAnchor,
      })),
      stageWidth,
      stageHeight,
    );

    for (let i = 0; i < visibleMarkers.length; i++) {
      const { marker } = visibleMarkers[i];
      const placement = placements[i];
      marker.prevAnchor = placement.anchor;
      if (marker.button.dataset.anchor !== placement.anchor) {
        marker.button.dataset.anchor = placement.anchor;
      }
      const hiddenAttr = String(placement.labelHidden);
      if (marker.button.dataset.labelHidden !== hiddenAttr) {
        marker.button.dataset.labelHidden = hiddenAttr;
      }
      if (marker.label.hidden !== placement.labelHidden) {
        marker.label.hidden = placement.labelHidden;
      }
    }

    const latitude =
      (Math.asin(Math.max(-1, Math.min(1, facing[1]))) * 180) / Math.PI;
    const longitude = (Math.atan2(-facing[2], facing[0]) * 180) / Math.PI;
    coordinateLabel.textContent = `${Math.abs(latitude).toFixed(1)}°${latitude >= 0 ? 'N' : 'S'}  ${Math.abs(longitude).toFixed(1)}°${longitude >= 0 ? 'E' : 'W'}`;

    for (const button of zoomButtons)
      button.disabled =
        button.dataset.globeZoom === 'in'
          ? distance <= MIN_DISTANCE + 0.02
          : distance >= MAX_DISTANCE - 0.02;

    if (flight || dampingActive || canSpin()) requestDraw();
    else previousFrame = undefined;
  }

  function requestDraw() {
    if (!frame && !disposed && visible && !document.hidden)
      frame = requestAnimationFrame(draw);
  }

  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType === 'touch') return;
      pointer = {
        x: event.clientX,
        y: event.clientY,
        overAction:
          event.target instanceof Element &&
          stage.contains(event.target) &&
          Boolean(event.target.closest('.atlas-marker, .atlas-controls')),
      };
      keyboardNavigation = false;
      requestDraw();
    },
    { signal: events.signal },
  );
  window.addEventListener(
    'pointerout',
    (event) => {
      if (event.relatedTarget !== null || event.pointerType === 'touch') return;
      pointer = undefined;
      requestDraw();
    },
    { signal: events.signal },
  );
  window.addEventListener(
    'blur',
    () => {
      pointers.clear();
      activeCanvasPointers.clear();
      previousPinchDist = 0;
      pointer = undefined;
      keyboardNavigation = false;
      requestDraw();
    },
    { signal: events.signal },
  );
  window.addEventListener('scroll', requestDraw, {
    passive: true,
    signal: events.signal,
  });
  stage.addEventListener(
    'pointerdown',
    (event) => {
      keyboardNavigation = false;
      pointers.add(event.pointerId);
      requestDraw();
    },
    { signal: events.signal },
  );
  for (const type of ['pointerup', 'pointercancel'] as const)
    window.addEventListener(
      type,
      (event) => {
        pointers.delete(event.pointerId);
        requestDraw();
      },
      { signal: events.signal },
    );
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Tab') {
        keyboardNavigation = true;
        requestDraw();
      }
    },
    { signal: events.signal },
  );
  stage.addEventListener('focusin', requestDraw, { signal: events.signal });
  stage.addEventListener('focusout', requestDraw, { signal: events.signal });

  const updateSize = () => {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    const stageHeight = stageBox.clientHeight || height;
    if (!width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const nextW = Math.max(1, Math.round(width * dpr));
    const nextH = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW;
      canvas.height = nextH;
    }
    cameraFov =
      (Math.atan(baseHalfTan * (height / stageHeight)) * 360) / Math.PI;
    cameraAspect = width / height;
    writePerspective(projMatrix, cameraFov, cameraAspect, 0.1, 30);
    requestDraw();
  };
  const resize = new ResizeObserver(updateSize);
  resize.observe(viewport);
  resize.observe(stageBox);
  updateSize();

  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    previousFrame = undefined;
    spinVelocity = 0;
    if (visible) requestDraw();
    else {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  });
  intersection.observe(stageBox);

  document.addEventListener(
    'visibilitychange',
    () => {
      previousFrame = undefined;
      spinVelocity = 0;
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else requestDraw();
    },
    { signal: events.signal },
  );

  reducedMotion.addEventListener(
    'change',
    () => {
      enableDamping = !reducedMotion.matches;
      clearInertia();
      if (flight) {
        cameraPos = globePoint(
          flight.fromLat + flight.deltaLat,
          flight.fromLon + flight.deltaLon,
          flight.toDistance,
        );
        flight = undefined;
      }
      requestDraw();
    },
    { signal: events.signal },
  );

  function move(latitude: number, longitude: number, distance: number) {
    window.clearTimeout(holdTimer);
    holdUntil = 0;
    clearInertia();
    const fromVec = vecNormalize(cameraPos);
    const toVec = vecNormalize(globePoint(latitude, longitude));
    const angularRad = Math.acos(
      Math.max(-1, Math.min(1, vecDot(fromVec, toVec))),
    );
    if (reducedMotion.matches || angularRad < 0.004) {
      cameraPos = globePoint(latitude, longitude, distance);
      flight = undefined;
    } else {
      const { lat: fromLat, lon: fromLon } = vectorToLatLon(cameraPos);
      const deltaLat = latitude - fromLat;
      const deltaLon = shortestDeltaLon(fromLon, longitude);
      const ratio = Math.min(1, angularRad / Math.PI);
      flight = {
        start: performance.now(),
        duration: Math.round(680 + ratio * 620),
        fromLat,
        fromLon,
        deltaLat,
        deltaLon,
        fromDistance: vecLength(cameraPos),
        toDistance: distance,
        arcLift: ratio * 0.42,
      };
    }
    requestDraw();
  }

  function zoom(direction: string) {
    flight = undefined;
    clearInertia();
    cameraPos = vecSetLength(
      cameraPos,
      Math.max(
        MIN_DISTANCE,
        Math.min(
          MAX_DISTANCE,
          vecLength(cameraPos) * (direction === 'in' ? 0.82 : 1.22),
        ),
      ),
    );
    requestDraw();
  }

  zoomButtons.forEach((button) =>
    button.addEventListener('click', () => zoom(button.dataset.globeZoom!), {
      signal: events.signal,
    }),
  );
  root
    .querySelector('[data-globe-home]')
    ?.addEventListener(
      'click',
      () => move(home.latitude, home.longitude, homeDistance()),
      { signal: events.signal },
    );

  canvas.addEventListener(
    'keydown',
    (event) => {
      keyboardNavigation = true;
      if (['+', '=', '-'].includes(event.key)) {
        event.preventDefault();
        zoom(event.key === '-' ? 'out' : 'in');
      } else if (event.key === 'Home') {
        event.preventDefault();
        move(home.latitude, home.longitude, homeDistance());
      } else if (
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
      ) {
        event.preventDefault();
        flight = undefined;
        clearInertia();
        const sph = vecToSpherical(cameraPos);
        if (event.key === 'ArrowLeft') sph.theta -= 0.12;
        if (event.key === 'ArrowRight') sph.theta += 0.12;
        if (event.key === 'ArrowUp') sph.phi -= 0.12;
        if (event.key === 'ArrowDown') sph.phi += 0.12;
        sph.phi = Math.max(MIN_POLAR, Math.min(MAX_POLAR, sph.phi));
        cameraPos = sphericalToVec(sph.radius, sph.phi, sph.theta);
        requestDraw();
      }
    },
    { signal: events.signal },
  );

  const handle = {
    setPaused(value: boolean) {
      paused = value;
      requestDraw();
    },
    focus(place: Place) {
      move(
        place.latitude,
        place.longitude,
        stageBox.clientWidth < 500 ? 3.45 : 3.08,
      );
    },
    resetHome() {
      move(home.latitude, home.longitude, homeDistance());
    },
    setPlaces(places: Place[], selected = '') {
      home = places[0] ?? { latitude: 20, longitude: 25 };
      selectedId = selected;
      const samePlaces =
        markers.length === places.length &&
        markers.every(
          (m, idx) =>
            m.place.id === places[idx].id &&
            m.place.count === places[idx].count,
        );
      if (samePlaces) {
        for (let i = 0; i < markers.length; i++) {
          markers[i].place = places[i];
          markers[i].button.setAttribute(
            'aria-pressed',
            String(selected === places[i].id),
          );
        }
        requestDraw();
        return;
      }
      hoveredId = '';
      const focused = markerLayer.contains(document.activeElement)
        ? (document.activeElement as HTMLElement).dataset.placeId
        : undefined;
      markerLayer.replaceChildren();
      markers = places.map((place) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'atlas-marker';
        button.dataset.placeId = place.id;
        button.dataset.anchor = 'right';
        button.setAttribute('aria-controls', 'map-records');
        button.setAttribute(
          'aria-label',
          `${place.city}，${place.count} 条测评`,
        );
        button.setAttribute('aria-pressed', String(selected === place.id));
        const dot = document.createElement('span');
        dot.className = 'atlas-marker-dot';
        dot.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.className = 'atlas-marker-label';
        label.textContent = place.city;
        const count = document.createElement('small');
        count.textContent = String(place.count);
        label.append(count);
        button.append(dot, label);
        button.addEventListener('click', () => onSelect(place.id));
        button.addEventListener('pointerenter', () => {
          hoveredId = place.id;
          requestDraw();
        });
        button.addEventListener('pointerleave', () => {
          if (hoveredId === place.id) {
            hoveredId = '';
            requestDraw();
          }
        });
        button.addEventListener('focusin', () => {
          hoveredId = place.id;
          requestDraw();
        });
        button.addEventListener('focusout', () => {
          if (hoveredId === place.id) {
            hoveredId = '';
            requestDraw();
          }
        });
        markerLayer.append(button);
        const position = globePoint(place.latitude, place.longitude, 1.006);
        return {
          place,
          button,
          label,
          labelWidth: 0,
          labelHeight: 0,
          position,
          normal: vecNormalize(position),
        };
      });
      for (const marker of markers) {
        marker.labelWidth = marker.label.offsetWidth;
        marker.labelHeight = marker.label.offsetHeight;
      }
      if (focused)
        markers
          .find(({ place }) => place.id === focused)
          ?.button.focus({ preventScroll: true });
      requestDraw();
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(holdTimer);
      events.abort();
      resize.disconnect();
      intersection.disconnect();
      if (!gl!.isContextLost()) {
        gl!.deleteTexture(texture);
        gl!.deleteBuffer(vbo);
        gl!.deleteBuffer(ibo);
        gl!.deleteProgram(program);
      }
      canvas.remove();
      markerLayer.replaceChildren();
    },
  };

  canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      handle.destroy();
      root.dispatchEvent(new Event('globe-unavailable'));
    },
    { signal: events.signal },
  );

  handle.setPlaces(initialPlaces);
  requestDraw();
  return handle;
}
