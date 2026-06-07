<script lang="ts">
  import { HK_BOUNDS, DISTRICTS, CYBERPORT } from './data/hk_districts.js';

  interface DistrictNode {
    id: string;
    name: string;
    nameZh: string;
    x: number;
    y: number;
  }

  // Curated hand-authored coordinates for a readable dark-tech map inside 1000x600.
  // Layout: HK Island on right-mid, Kowloon mid-right, NT west/top/east, Islands far left.
  const CURATED: Record<string, { x: number; y: number }> = {
    'Central & Western': { x: 720, y: 380 },
    'Wan Chai':          { x: 780, y: 360 },
    'Eastern':           { x: 840, y: 340 },
    'Southern':          { x: 760, y: 460 },
    'Yau Tsim Mong':     { x: 720, y: 300 },
    'Sham Shui Po':      { x: 660, y: 280 },
    'Kowloon City':      { x: 780, y: 290 },
    'Wong Tai Sin':      { x: 820, y: 270 },
    'Kwun Tong':         { x: 860, y: 310 },
    'Tsuen Wan':         { x: 580, y: 280 },
    'Tuen Mun':          { x: 420, y: 240 },
    'Yuen Long':         { x: 480, y: 180 },
    'North':             { x: 620, y: 120 },
    'Tai Po':            { x: 720, y: 160 },
    'Sai Kung':          { x: 880, y: 220 },
    'Sha Tin':           { x: 760, y: 220 },
    'Kwai Tsing':        { x: 620, y: 300 },
    'Islands':           { x: 320, y: 400 },
  };

  const districts: DistrictNode[] = DISTRICTS.map((d) => ({
    id: d.id,
    name: d.nameEn,
    nameZh: d.nameZh,
    x: CURATED[d.nameEn]?.x ?? (d.centroid?.[0] ?? d.x ?? 500),
    y: CURATED[d.nameEn]?.y ?? (d.centroid?.[1] ?? d.y ?? 300),
  }));

  const cyberportNode: DistrictNode = {
    id: CYBERPORT.id,
    name: CYBERPORT.nameEn,
    nameZh: CYBERPORT.nameZh,
    x: 700,
    y: 440,
  };

  const connections: [string, string][] = [
    ['North', 'Tai Po'],
    ['Tai Po', 'Sha Tin'],
    ['Sha Tin', 'Sai Kung'],
    ['North', 'Yuen Long'],
    ['Yuen Long', 'Tuen Mun'],
    ['Tuen Mun', 'Tsuen Wan'],
    ['Tsuen Wan', 'Kwai Tsing'],
    ['Kwai Tsing', 'Sham Shui Po'],
    ['Sham Shui Po', 'Kowloon City'],
    ['Kowloon City', 'Yau Tsim Mong'],
    ['Yau Tsim Mong', 'Wan Chai'],
    ['Wan Chai', 'Eastern'],
    ['Eastern', 'Central & Western'],
    ['Central & Western', 'Southern'],
    ['Kowloon City', 'Wong Tai Sin'],
    ['Wong Tai Sin', 'Kwun Tong'],
    ['Kwun Tong', 'Sai Kung'],
    ['Yau Tsim Mong', 'Central & Western'],
    ['Tuen Mun', 'Islands'],
    ['Tsuen Wan', 'Islands'],
    ['Sha Tin', 'Kowloon City'],
  ];

  // Deterministic particles seeded by index (SSR-safe, no Math.random).
  const PARTICLE_COUNT = 64;
  const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    x: ((i * 17 + 31) * 13) % HK_BOUNDS.width,
    y: ((i * 23 + 11) * 7) % HK_BOUNDS.height,
    r: 0.5 + ((i * 3) % 16) / 10,
    o: 0.08 + ((i * 5) % 28) / 100,
    d: 2 + ((i * 7) % 41) / 10,
  }));

  // Use district paths only as subtle coastline/glow/texture.
  // Filter out very short or suspicious paths and join the rest into a single silhouette.
  function buildCoastlinePath(): string {
    const parts: string[] = [];
    for (const d of DISTRICTS) {
      const p = d.path?.trim() ?? '';
      if (p.length > 20 && p.includes('Z')) {
        parts.push(p);
      }
    }
    return parts.join(' ');
  }
  const coastlinePath = buildCoastlinePath();

  let tooltipVisible = false;
  let tooltipX = 0;
  let tooltipY = 0;
  let cyberportFocused = false;

  function findDistrict(name: string): DistrictNode | undefined {
    return districts.find((d) => d.name === name);
  }

  function showTooltip(e?: MouseEvent | FocusEvent) {
    tooltipVisible = true;
    if (e instanceof MouseEvent) {
      tooltipX = e.clientX;
      tooltipY = e.clientY;
    }
  }
  function moveTooltip(e: MouseEvent) {
    tooltipX = e.clientX;
    tooltipY = e.clientY;
  }
  function hideTooltip() {
    tooltipVisible = false;
  }
  function handleCyberportFocus(e: FocusEvent) {
    cyberportFocused = true;
    showTooltip(e);
  }
  function handleCyberportBlur() {
    cyberportFocused = false;
    hideTooltip();
  }
  function handleCyberportKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      tooltipVisible = cyberportFocused ? !tooltipVisible : true;
    }
  }

  // Center of the landmass for radar/decor (not the SVG center).
  const cx = 640;
  const cy = 320;

  // Gold outgoing arcs from the hub area toward the right (UK / OBOR / Europe).
  const goldArcs = [
    { d: `M ${cx + 120} ${cy + 20} Q ${cx + 320} ${cy - 100} ${cx + 480} ${cy - 180}` },
    { d: `M ${cx + 140} ${cy + 40} Q ${cx + 320} ${cy + 20} ${cx + 480} ${cy + 40}` },
    { d: `M ${cx + 100} ${cy - 20} Q ${cx + 300} ${cy - 160} ${cx + 480} ${cy - 220}` },
  ];

  const destLabels = [
    { x: cx + 480, y: cy - 185, line1: 'UK', line2: 'Education Gateway' },
    { x: cx + 480, y: cy + 35, line1: 'OBOR', line2: '\u0026 European Market' },
  ];

  const destHalos = [
    { x: cx + 480, y: cy - 180, delay: '0s' },
    { x: cx + 480, y: cy + 40, delay: '1.6s' },
  ];

  // Curved link between two district nodes (deterministic control point).
  function curveBetween(a: DistrictNode, b: DistrictNode): string {
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    // Offset control point perpendicular to the link for a subtle arc.
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const arcSize = Math.min(24, len * 0.18);
    const qx = mx - (dy / len) * arcSize;
    const qy = my + (dx / len) * arcSize;
    return `M ${a.x} ${a.y} Q ${qx} ${qy} ${b.x} ${b.y}`;
  }
</script>

<div class="map-wrap">
  <svg
    viewBox="0 0 {HK_BOUNDS.width} {HK_BOUNDS.height}"
    xmlns="http://www.w3.org/2000/svg"
    class="h-full w-full"
    preserveAspectRatio="xMidYMid meet"
    aria-label="Hong Kong 18 Districts tech map"
  >
    <defs>
      <filter id="cyanGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <filter id="strongCyanGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <filter id="goldGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <filter id="cyberGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="10" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="blur" />
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <filter id="coastBlur" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <radialGradient id="ringGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="rgba(14,115,114,0)" />
        <stop offset="70%" stop-color="rgba(0,212,255,0.06)" />
        <stop offset="100%" stop-color="rgba(0,212,255,0.22)" />
      </radialGradient>

      <linearGradient id="goldLine" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#FFC629" stop-opacity="0.2" />
        <stop offset="50%" stop-color="#FFC629" stop-opacity="1" />
        <stop offset="100%" stop-color="#FFC629" stop-opacity="0.2" />
      </linearGradient>

      <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
        <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(0,212,255,0.05)" stroke-width="0.5" />
      </pattern>
    </defs>

    <!-- Background grid -->
    <rect width="{HK_BOUNDS.width}" height="{HK_BOUNDS.height}" fill="url(#grid)" />

    <!-- Radar rings -->
    <g opacity="0.35">
      <circle cx="{cx}" cy="{cy}" r="160" fill="none" stroke="url(#ringGrad)" stroke-width="1" />
      <circle cx="{cx}" cy="{cy}" r="260" fill="none" stroke="url(#ringGrad)" stroke-width="1" />
      <circle cx="{cx}" cy="{cy}" r="380" fill="none" stroke="url(#ringGrad)" stroke-width="1" />
    </g>

    <!-- Sweeping radar line -->
    <line
      x1="{cx}"
      y1="{cy}"
      x2="{cx + 160}"
      y2="{cy}"
      stroke="rgba(0,212,255,0.15)"
      stroke-width="1"
      class="radar-sweep"
    />

    <!-- Particles -->
    <g>
      {#each particles as p, i (i)}
        <circle cx={p.x} cy={p.y} r={p.r} fill="rgba(0,212,255,{p.o})" class="particle" style="animation-delay: {p.d}s;" />
      {/each}
    </g>

    <!-- Luminous coastline silhouette (subtle, not admin chunks) -->
    {#if coastlinePath}
      <g class="coastline">
        <!-- Wide outer glow -->
        <path
          d={coastlinePath}
          fill="none"
          stroke="rgba(0,212,255,0.45)"
          stroke-width="2.6"
          filter="url(#coastBlur)"
          opacity="0.85"
        />
        <!-- Core line -->
        <path
          d={coastlinePath}
          fill="none"
          stroke="rgba(0,212,255,0.9)"
          stroke-width="1"
          opacity="0.95"
        />
        <!-- Very subtle filled silhouette for shape recognition -->
        <path
          d={coastlinePath}
          fill="rgba(0,212,255,0.04)"
          stroke="none"
          opacity="0.7"
        />
      </g>
    {/if}

    <!-- District connection lines (dashed curves) -->
    <g fill="none" stroke="rgba(0,212,255,0.28)" stroke-width="0.8" stroke-dasharray="3 5" opacity="0.9">
      {#each connections as [aName, bName]}
        {@const a = findDistrict(aName)}
        {@const b = findDistrict(bName)}
        {#if a && b}
          <path d={curveBetween(a, b)} />
        {/if}
      {/each}
    </g>

    <!-- Outgoing gold paths -->
    <g fill="none" stroke-width="2.5" filter="url(#goldGlow)" opacity="0.9">
      {#each goldArcs as arc, i (i)}
        <path d={arc.d} stroke="url(#goldLine)" stroke-dasharray="8 10" class="dash-flow" style="animation-delay: {i * 0.7}s;" />
      {/each}
    </g>

    <!-- Outgoing destination labels -->
    <g class="dest-labels" font-size="13" font-weight="700" font-family="Roboto, system-ui, sans-serif">
      {#each destLabels as dest (dest.line1)}
        <text x={dest.x} y={dest.y} fill="#FFC629" text-anchor="middle" filter="url(#goldGlow)">{dest.line1}</text>
        <text x={dest.x} y={dest.y + 15} fill="#FFC629" text-anchor="middle" font-size="10" opacity="0.85">{dest.line2}</text>
      {/each}
    </g>

    <!-- Destination halo dots -->
    <g>
      {#each destHalos as h (h.x + '-' + h.y)}
        <circle cx={h.x} cy={h.y} r="5" fill="#FFC629" filter="url(#goldGlow)">
          <animate attributeName="r" values="5;8;5" dur="3s" repeatCount="indefinite" begin={h.delay} />
          <animate attributeName="opacity" values="0.85;0.35;0.85" dur="3s" repeatCount="indefinite" begin={h.delay} />
        </circle>
      {/each}
    </g>

    <!-- Cyberport highlight zone -->
    <g
      class="cyberport-zone"
      role="button"
      tabindex="0"
      aria-label="Cyberport headquarters"
      on:mouseenter={showTooltip}
      on:mousemove={moveTooltip}
      on:mouseleave={hideTooltip}
      on:focus={handleCyberportFocus}
      on:blur={handleCyberportBlur}
      on:keydown={handleCyberportKeydown}
      style="cursor: pointer;"
    >
      <!-- Glow aura -->
      <circle cx={cyberportNode.x} cy={cyberportNode.y} r="52" fill="rgba(0,212,255,0.07)" filter="url(#cyberGlow)" class="cyber-aura" />
      <circle cx={cyberportNode.x} cy={cyberportNode.y} r="34" fill="none" stroke="rgba(0,212,255,0.28)" stroke-width="1" class="cyber-ring" />
      <circle cx={cyberportNode.x} cy={cyberportNode.y} r="20" fill="none" stroke="rgba(0,212,255,0.5)" stroke-width="1.5" class="cyber-ring-inner" />
      <!-- Core beacon -->
      <circle cx={cyberportNode.x} cy={cyberportNode.y} r="8" fill="#00D4FF" filter="url(#strongCyanGlow)" class="cyber-core" />
      <circle cx={cyberportNode.x} cy={cyberportNode.y} r="3.5" fill="#fff" />
      <!-- Label -->
      <text
        x={cyberportNode.x}
        y={cyberportNode.y - 40}
        fill="#eafcff"
        font-size="13"
        font-weight="800"
        font-family="Roboto, system-ui, sans-serif"
        text-anchor="middle"
        class="cyber-label"
      >
        {cyberportNode.name}
      </text>
      <text
        x={cyberportNode.x}
        y={cyberportNode.y - 24}
        fill="#58f2ff"
        font-size="10"
        font-weight="700"
        font-family="Roboto, system-ui, sans-serif"
        text-anchor="middle"
        class="cyber-label-zh"
      >
        {cyberportNode.nameZh}
      </text>
    </g>

    <!-- District nodes -->
    <g role="list" aria-label="Hong Kong 18 districts">
      {#each districts as d (d.id)}
        <g transform="translate({d.x},{d.y})" role="listitem" aria-label="{d.name}, {d.nameZh}">
          <circle r="11" fill="none" stroke="rgba(0,212,255,0.35)" stroke-width="1" class="pulse-ring" />
          <circle r="5.5" fill="#00D4FF" filter="url(#strongCyanGlow)" />
          <circle r="2.4" fill="#fff" />
          <text
            y="-18"
            fill="#eafcff"
            font-size="9.5"
            font-weight="600"
            font-family="Roboto, system-ui, sans-serif"
            text-anchor="middle"
            class="district-label"
          >
            {d.name}
          </text>
        </g>
      {/each}
    </g>
  </svg>

  <!-- Cyberport Tooltip -->
  {#if tooltipVisible}
    <div
      class="cyber-tooltip"
      style="left: {tooltipX + 16}px; top: {tooltipY - 20}px;"
      role="tooltip"
      aria-live="polite"
    >
      <div class="tooltip-header">
        <span class="tooltip-logo">5G</span>
        <span class="tooltip-brand">
          <strong>5GNU</strong>
          <small>MULTIMEDIA LIMITED</small>
        </span>
      </div>
      <div class="tooltip-body">
        <p class="tooltip-label">Headquarters</p>
        <p class="tooltip-addr">100 Cyberport Road, Hong Kong</p>
        <p class="tooltip-addr">Unit 1805, Level 18, Core C</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .map-wrap {
    position: relative;
    width: 100%;
    height: 100%;
  }

  @keyframes dashFlow {
    to { stroke-dashoffset: -54; }
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 0.35; }
    50% { transform: scale(1.45); opacity: 0.08; }
  }
  @keyframes particleTwinkle {
    0%, 100% { opacity: 0.08; }
    50% { opacity: 0.5; }
  }
  @keyframes radarSweep {
    0% { transform: rotate(0deg); opacity: 0.15; }
    50% { opacity: 0.35; }
    100% { transform: rotate(360deg); opacity: 0.15; }
  }
  @keyframes cyberPulse {
    0%, 100% { r: 20; opacity: 0.5; }
    50% { r: 32; opacity: 0.12; }
  }
  @keyframes cyberAura {
    0%, 100% { r: 52; opacity: 0.35; }
    50% { r: 64; opacity: 0.15; }
  }
  @keyframes tooltipIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .dash-flow {
    animation: dashFlow 2.4s linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .dash-flow,
    .pulse-ring,
    .particle,
    .radar-sweep,
    .cyber-ring-inner,
    .cyber-aura {
      animation: none !important;
    }
  }

  .pulse-ring {
    animation: pulse 3s ease-in-out infinite;
    transform-origin: center;
  }

  .particle {
    animation: particleTwinkle 4s ease-in-out infinite;
  }

  .radar-sweep {
    transform-origin: 640px 320px;
    animation: radarSweep 10s linear infinite;
  }

  .coastline path {
    transition: stroke-opacity 0.4s ease;
  }

  .cyber-ring-inner {
    animation: cyberPulse 2.5s ease-in-out infinite;
    transform-origin: center;
  }
  .cyber-aura {
    animation: cyberAura 4s ease-in-out infinite;
    transform-origin: center;
  }

  .district-label,
  .cyber-label,
  .cyber-label-zh,
  .dest-labels text {
    text-shadow: 0 1px 5px rgba(0, 0, 0, 0.85);
  }

  /* Mobile: suppress some labels to reduce overlap when the SVG scales down. */
  @media (max-width: 760px) {
    .district-label {
      font-size: 7.5px;
      font-weight: 700;
    }
    .cyber-label {
      font-size: 10px;
    }
    .cyber-label-zh {
      font-size: 8px;
    }
    .dest-labels text {
      font-size: 10px;
    }
    .dest-labels text:nth-child(2) {
      font-size: 8px;
    }
  }

  /* Tooltip */
  .cyber-tooltip {
    position: fixed;
    z-index: 100;
    min-width: 220px;
    max-width: 280px;
    background: rgba(2, 10, 24, 0.92);
    border: 1px solid rgba(0, 212, 255, 0.35);
    border-radius: 12px;
    padding: 12px 14px;
    box-shadow:
      0 0 24px rgba(0, 212, 255, 0.15),
      0 8px 24px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    pointer-events: none;
    animation: tooltipIn 0.2s ease-out;
  }

  .tooltip-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(0, 212, 255, 0.15);
  }

  .tooltip-logo {
    display: grid;
    width: 2.2rem;
    height: 2.2rem;
    place-items: center;
    border-radius: 0.5rem;
    background: linear-gradient(135deg, #1dd7f5, #246dff);
    box-shadow: 0 0 12px rgba(29, 215, 245, 0.25);
    font-size: 0.85rem;
    font-weight: 900;
    color: #fff;
  }

  .tooltip-brand strong {
    display: block;
    font-size: 0.95rem;
    color: #eafcff;
    line-height: 1;
  }

  .tooltip-brand small {
    display: block;
    margin-top: 2px;
    font-size: 0.6rem;
    color: #7f90aa;
    font-weight: 700;
    letter-spacing: 0.1em;
  }

  .tooltip-body {
    display: grid;
    gap: 2px;
  }

  .tooltip-label {
    margin: 0;
    font-size: 0.7rem;
    color: #58f2ff;
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  .tooltip-addr {
    margin: 0;
    font-size: 0.78rem;
    color: #a7b7c9;
    line-height: 1.4;
  }
</style>
