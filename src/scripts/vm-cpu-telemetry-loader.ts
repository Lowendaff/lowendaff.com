let modulePromise: Promise<typeof import('./vm-cpu-telemetry')> | undefined;

function loadTelemetryModule() {
  modulePromise ??= import('./vm-cpu-telemetry');
  return modulePromise;
}

function bootVmCpuTelemetryLazy() {
  const roots = Array.from(
    document.querySelectorAll<HTMLElement>('[data-vm-telemetry-root]'),
  );
  if (!roots.length) return;

  const mountRoot = async (root: HTMLElement) => {
    const mod = await loadTelemetryModule();
    mod.mountVmCpuTelemetryRoot(root);
  };

  if (typeof IntersectionObserver === 'undefined') {
    void loadTelemetryModule().then((mod) => mod.initVmCpuTelemetryCharts());
    return;
  }

  const pending = new Set(roots);
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const target = entry.target as HTMLElement;
        observer.unobserve(target);
        pending.delete(target);
        void mountRoot(target);
      }
      if (!pending.size) observer.disconnect();
    },
    { rootMargin: '280px 0px' },
  );

  for (const root of roots) observer.observe(root);
}

if (typeof window !== 'undefined') {
  bootVmCpuTelemetryLazy();
}
