import {
  CanvasTexture,
  Color,
  Mesh,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Spherical,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  globePoint,
  unwrapGeographicLine,
  unwrapLandRing,
} from '../lib/globe-geometry';
import type { ReviewPlace } from '../lib/review-map';

type Place = Pick<ReviewPlace, 'id' | 'city' | 'latitude' | 'longitude'> & {
  count: number;
};
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
  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0, 0);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    '交互式测评地球，可使用方向键旋转，加减键缩放，Home 键复位',
  );
  canvas.setAttribute('aria-describedby', 'globe-instructions');
  viewport.append(canvas);
  let land: number[][][][];
  let borders: number[][][];
  try {
    const response = await fetch('/globe/geography-50m.json', {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('无法加载地理轮廓');
    const geography = (await response.json()) as {
      land: number[][][][];
      borders: number[][][];
    };
    land = geography.land.map((polygon) => polygon.map(unwrapLandRing));
    borders = geography.borders.map(unwrapGeographicLine);
  } catch (error) {
    renderer.dispose();
    canvas.remove();
    throw error;
  }
  const atlas = document.createElement('canvas');
  atlas.width = Math.min(4096, renderer.capabilities.maxTextureSize);
  atlas.height = atlas.width / 2;
  const lineScale = atlas.width / 2048;
  const context = atlas.getContext('2d');
  if (!context) {
    renderer.dispose();
    canvas.remove();
    throw new Error('无法绘制地理轮廓');
  }
  const texture = new CanvasTexture(atlas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const scene = new Scene();
  const geometry = new SphereGeometry(1, 96, 64);
  const material = new ShaderMaterial({
    uniforms: { atlas: { value: texture } },
    vertexShader: `varying vec2 vUv; varying vec3 vNormal; varying vec3 vView;
      void main() { vUv = uv; vec4 p = modelViewMatrix * vec4(position, 1.0); vNormal = normalize(normalMatrix * normal); vView = normalize(-p.xyz); gl_Position = projectionMatrix * p; }`,
    fragmentShader: `uniform sampler2D atlas; varying vec2 vUv; varying vec3 vNormal; varying vec3 vView;
      void main() { vec3 color = texture2D(atlas, vUv).rgb;
        float facing = max(0.0, dot(normalize(vNormal), normalize(vView)));
        gl_FragColor = vec4(color * (0.82 + 0.18 * smoothstep(0.0, 0.85, facing)), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  scene.add(new Mesh(geometry, material));
  // Coastlines and shared country borders use one topology and live site tokens.
  function paintTheme() {
    const css = getComputedStyle(root);
    const token = (name: string) =>
      new Color(css.getPropertyValue(name).trim());
    const ocean = token('--raised');
    const landColor = token('--border').lerp(token('--accent'), 0.12);
    const grid = ocean.clone().lerp(token('--border'), 0.38);
    const coast = landColor.clone().lerp(token('--muted'), 0.45);
    const boundary = landColor.clone().lerp(token('--muted'), 0.72);
    context!.fillStyle = ocean.getStyle();
    context!.fillRect(0, 0, atlas.width, atlas.height);
    context!.lineWidth = 0.7 * lineScale;
    context!.strokeStyle = grid.getStyle();
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
    context!.fillStyle = landColor.getStyle();
    context!.strokeStyle = coast.getStyle();
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
    context!.strokeStyle = boundary.getStyle();
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
    texture.needsUpdate = true;
    requestDraw();
  }
  const baseHalfTan = Math.tan((40 * Math.PI) / 360);
  const camera = new PerspectiveCamera(40, 1, 0.1, 30);
  let home = initialPlaces[0] ?? { latitude: 20, longitude: 25 };
  const homeDistance = () => (stageBox.clientWidth < 500 ? 3.8 : 3.4);
  camera.position.fromArray(
    globePoint(home.latitude, home.longitude, homeDistance()),
  );
  const controls = new OrbitControls(camera, canvas);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  controls.enableDamping = !reducedMotion.matches;
  controls.dampingFactor = 0.09;
  controls.enablePan = false;
  controls.minDistance = 1.65;
  controls.maxDistance = 5.2;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.7;
  controls.minPolarAngle = 0.07;
  controls.maxPolarAngle = Math.PI - 0.07;
  let frame = 0;
  let visible = true;
  let disposed = false;
  let pointer: { x: number; y: number; overAction: boolean } | undefined;
  let paused = false;
  let keyboardNavigation = false;
  const pointers = new Set<number>();
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
  let markers: {
    button: HTMLButtonElement;
    position: Vector3;
    place: Place;
    label: HTMLSpanElement;
  }[] = [];
  const events = new AbortController();
  const zoomButtons = [
    ...root.querySelectorAll<HTMLButtonElement>('[data-globe-zoom]'),
  ];
  const originalUp = new Vector3(0, 1, 0);
  const projected = new Vector3();
  const themeObserver = new MutationObserver(paintTheme);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'data-appearance'],
  });
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  systemTheme.addEventListener('change', paintTheme, { signal: events.signal });
  paintTheme();

  function pointerOverGlobe() {
    if (!pointer) return false;
    if (pointer.overAction) return true;
    const stageBounds = stageBox.getBoundingClientRect();
    const bounds = viewport.getBoundingClientRect();
    // The projected sphere silhouette, capped to the stage lens when zoomed in.
    const rawRadius =
      bounds.height /
      (2 *
        Math.tan((camera.fov * Math.PI) / 360) *
        Math.sqrt(Math.max(0.04, camera.position.lengthSq() - 1)));
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
  function vectorToLatLon(vec: Vector3) {
    const dir = vec.clone().normalize();
    const lat = (Math.asin(Math.max(-1, Math.min(1, dir.y))) * 180) / Math.PI;
    const lon = (Math.atan2(-dir.z, dir.x) * 180) / Math.PI;
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
      camera.position.applyAxisAngle(originalUp, spinVelocity * delta);
    } else spinVelocity = 0;
    if (flight) {
      const t = Math.min(1, (wallNow - flight.start) / flight.duration);
      const ease = easeInOutCubic(t);
      const lat = flight.fromLat + flight.deltaLat * ease;
      const lon = flight.fromLon + flight.deltaLon * ease;
      const radius =
        flight.fromDistance +
        (flight.toDistance - flight.fromDistance) * ease +
        Math.sin(Math.PI * ease) * flight.arcLift;
      camera.position.fromArray(globePoint(lat, lon, radius));
      if (t >= 1) {
        camera.position.fromArray(
          globePoint(
            flight.fromLat + flight.deltaLat,
            flight.fromLon + flight.deltaLon,
            flight.toDistance,
          ),
        );
        flight = undefined;
        if (!reducedMotion.matches && !paused) {
          holdUntil = wallNow + 1100;
          scheduleHoldWakeup(1120);
        }
      }
      const wasDamping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = wasDamping;
    } else {
      controls.update();
    }
    renderer.render(scene, camera);
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    const stageWidth = stageBox.clientWidth || width;
    const stageHeight = stageBox.clientHeight || height;
    const offsetX = (width - stageWidth) / 2;
    const offsetY = (height - stageHeight) / 2;
    const distance = camera.position.length();
    const sphereRadius =
      height /
      (2 *
        Math.tan((camera.fov * Math.PI) / 360) *
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
    const facing = camera.position.clone().normalize();
    const occupied: { x: number; y: number }[] = [];
    for (const { button, position, label } of [...markers].sort(
      (a, b) =>
        Number(b.button.getAttribute('aria-pressed') === 'true') -
        Number(a.button.getAttribute('aria-pressed') === 'true'),
    )) {
      projected.copy(position).project(camera);
      const x = (projected.x * 0.5 + 0.5) * width - offsetX;
      const y = (-projected.y * 0.5 + 0.5) * height - offsetY;
      const dx = x - stageWidth / 2;
      const dy = y - stageHeight / 2;
      const maxMarkerRadius = Math.max(0, activeClipRadius - 4);
      const hidden =
        position.clone().normalize().dot(facing) < 1 / distance + 0.025 ||
        dx * dx + dy * dy > maxMarkerRadius * maxMarkerRadius ||
        x < 12 ||
        x > stageWidth - 12 ||
        y < 18 ||
        y > stageHeight - 18;
      button.hidden = hidden;
      if (!hidden) {
        button.style.left = `${x}px`;
        button.style.top = `${y}px`;
        const crowded = occupied.some(
          (p) => Math.abs(p.x - x) < 140 && Math.abs(p.y - y) < 38,
        );
        label.hidden = crowded;
        if (!crowded) occupied.push({ x, y });
        button.style.transform =
          x > stageWidth - 170
            ? 'translate(calc(-100% + 14px), -50%)'
            : 'translate(-14px, -50%)';
        button.style.flexDirection =
          x > stageWidth - 170 ? 'row-reverse' : 'row';
      }
    }
    const latitude = (Math.asin(facing.y) * 180) / Math.PI;
    const longitude = (Math.atan2(-facing.z, facing.x) * 180) / Math.PI;
    coordinateLabel.textContent = `${Math.abs(latitude).toFixed(1)}°${latitude >= 0 ? 'N' : 'S'}  ${Math.abs(longitude).toFixed(1)}°${longitude >= 0 ? 'E' : 'W'}`;
    for (const button of zoomButtons)
      button.disabled =
        button.dataset.globeZoom === 'in'
          ? distance <= controls.minDistance + 0.02
          : distance >= controls.maxDistance - 0.02;
    if (flight || canSpin()) requestDraw();
    else previousFrame = undefined;
  }
  function requestDraw() {
    if (!frame && !disposed && visible && !document.hidden)
      frame = requestAnimationFrame(draw);
  }
  controls.addEventListener('change', requestDraw);
  controls.addEventListener('start', () => {
    flight = undefined;
    holdUntil = 0;
    window.clearTimeout(holdTimer);
    requestDraw();
  });
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
    renderer.setSize(width, height, false);
    camera.fov =
      (Math.atan(baseHalfTan * (height / stageHeight)) * 360) / Math.PI;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestDraw();
  };
  const resize = new ResizeObserver(updateSize);
  resize.observe(viewport);
  resize.observe(stageBox);
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
      controls.enableDamping = !reducedMotion.matches;
      if (flight) {
        camera.position.fromArray(
          globePoint(
            flight.fromLat + flight.deltaLat,
            flight.fromLon + flight.deltaLon,
            flight.toDistance,
          ),
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
    // Clear remaining drag inertia before starting a guided camera movement.
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = !reducedMotion.matches;
    const fromVec = camera.position.clone().normalize();
    const toVec = new Vector3(...globePoint(latitude, longitude)).normalize();
    const angularRad = fromVec.angleTo(toVec);
    if (reducedMotion.matches || angularRad < 0.004) {
      camera.position.fromArray(globePoint(latitude, longitude, distance));
      flight = undefined;
    } else {
      const { lat: fromLat, lon: fromLon } = vectorToLatLon(camera.position);
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
        fromDistance: camera.position.length(),
        toDistance: distance,
        arcLift: ratio * 0.42,
      };
    }
    requestDraw();
  }
  function zoom(direction: string) {
    flight = undefined;
    camera.position.setLength(
      Math.max(
        controls.minDistance,
        Math.min(
          controls.maxDistance,
          camera.position.length() * (direction === 'in' ? 0.82 : 1.22),
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
        const position = new Spherical().setFromVector3(camera.position);
        if (event.key === 'ArrowLeft') position.theta -= 0.12;
        if (event.key === 'ArrowRight') position.theta += 0.12;
        if (event.key === 'ArrowUp') position.phi -= 0.12;
        if (event.key === 'ArrowDown') position.phi += 0.12;
        position.phi = Math.max(
          controls.minPolarAngle,
          Math.min(controls.maxPolarAngle, position.phi),
        );
        camera.position.setFromSpherical(position);
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
      const focused = markerLayer.contains(document.activeElement)
        ? (document.activeElement as HTMLElement).dataset.placeId
        : undefined;
      markerLayer.replaceChildren();
      markers = places.map((place) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'atlas-marker';
        button.dataset.placeId = place.id;
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
        markerLayer.append(button);
        return {
          place,
          button,
          label,
          position: new Vector3(
            ...globePoint(place.latitude, place.longitude, 1.006),
          ),
        };
      });
      if (focused)
        markers
          .find(({ place }) => place.id === focused)
          ?.button.focus({ preventScroll: true });
      requestDraw();
    },
    destroy() {
      disposed = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(holdTimer);
      events.abort();
      themeObserver.disconnect();
      resize.disconnect();
      intersection.disconnect();
      controls.dispose();
      texture.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
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
