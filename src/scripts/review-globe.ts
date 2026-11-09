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
  const camera = new PerspectiveCamera(40, 1, 0.1, 30);
  const home = initialPlaces[0] ?? { latitude: 20, longitude: 25 };
  const homeDistance = () => (viewport.clientWidth < 500 ? 3.8 : 3.35);
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
  // Two degrees per second: a full turn in three minutes, independent of frame rate.
  const spinRate = Math.PI / 90;
  let flight:
    | {
        start: number;
        from: Vector3;
        to: Vector3;
        fromDistance: number;
        toDistance: number;
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
    const bounds = viewport.getBoundingClientRect();
    // The projected sphere silhouette, rather than the surrounding rectangular canvas.
    const radius =
      bounds.height /
      (2 *
        Math.tan((camera.fov * Math.PI) / 360) *
        Math.sqrt(camera.position.lengthSq() - 1));
    const x = pointer.x - bounds.left - bounds.width / 2;
    const y = pointer.y - bounds.top - bounds.height / 2;
    return (
      pointer.x >= bounds.left &&
      pointer.x <= bounds.right &&
      pointer.y >= bounds.top &&
      pointer.y <= bounds.bottom &&
      x * x + y * y <= radius * radius
    );
  }
  function canSpin() {
    return (
      !reducedMotion.matches &&
      !pointerOverGlobe() &&
      !paused &&
      !pointers.size &&
      !flight &&
      !(keyboardNavigation && stage.contains(document.activeElement))
    );
  }
  function draw(now: number) {
    frame = 0;
    if (disposed || !visible || document.hidden) return;
    const delta =
      previousFrame === undefined
        ? 0
        : Math.min((now - previousFrame) / 1000, 0.05);
    previousFrame = now;
    const spinning = canSpin();
    if (spinning) {
      spinVelocity += (spinRate - spinVelocity) * (1 - Math.exp(-delta / 0.6));
      camera.position.applyAxisAngle(originalUp, spinVelocity * delta);
    } else spinVelocity = 0;
    if (flight) {
      const t = Math.min(1, (performance.now() - flight.start) / 850);
      const ease = 1 - Math.pow(1 - t, 4);
      // Spherical interpolation follows the surface instead of passing through Earth.
      const angle = flight.from.angleTo(flight.to);
      const axis = new Vector3()
        .crossVectors(flight.from, flight.to)
        .normalize();
      if (axis.lengthSq() < 0.001) axis.copy(originalUp);
      camera.position
        .copy(flight.from)
        .applyAxisAngle(axis, angle * ease)
        .multiplyScalar(
          flight.fromDistance +
            (flight.toDistance - flight.fromDistance) * ease,
        );
      if (t === 1) {
        camera.position.copy(flight.to).multiplyScalar(flight.toDistance);
        flight = undefined;
      }
    }
    controls.update();
    renderer.render(scene, camera);
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    const distance = camera.position.length();
    const facing = camera.position.clone().normalize();
    const occupied: { x: number; y: number }[] = [];
    for (const { button, position, label } of [...markers].sort(
      (a, b) =>
        Number(b.button.getAttribute('aria-pressed') === 'true') -
        Number(a.button.getAttribute('aria-pressed') === 'true'),
    )) {
      projected.copy(position).project(camera);
      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height;
      const hidden =
        position.clone().normalize().dot(facing) < 1 / distance + 0.025 ||
        x < 16 ||
        x > width - 16 ||
        y < 52 ||
        y > height - 48;
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
          x > width - 170
            ? 'translate(calc(-100% + 14px), -50%)'
            : 'translate(-14px, -50%)';
        button.style.flexDirection = x > width - 170 ? 'row-reverse' : 'row';
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
  const resize = new ResizeObserver(() => {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestDraw();
  });
  resize.observe(viewport);
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
  intersection.observe(viewport);
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
        camera.position.copy(flight.to).multiplyScalar(flight.toDistance);
        flight = undefined;
      }
      requestDraw();
    },
    { signal: events.signal },
  );
  function move(latitude: number, longitude: number, distance: number) {
    // Clear remaining drag inertia before starting a guided camera movement.
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = !reducedMotion.matches;
    const to = new Vector3(...globePoint(latitude, longitude)).normalize();
    if (reducedMotion.matches) {
      camera.position.copy(to).multiplyScalar(distance);
      flight = undefined;
    } else
      flight = {
        start: performance.now(),
        from: camera.position.clone().normalize(),
        to,
        fromDistance: camera.position.length(),
        toDistance: distance,
      };
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
        viewport.clientWidth < 500 ? 3.4 : 2.7,
      );
    },
    setPlaces(places: Place[], selected = '') {
      const focused = markerLayer.contains(document.activeElement)
        ? (document.activeElement as HTMLElement).dataset.placeId
        : undefined;
      markerLayer.replaceChildren();
      markers = places.map((place) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'atlas-marker';
        button.dataset.placeId = place.id;
        button.setAttribute('aria-haspopup', 'dialog');
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
