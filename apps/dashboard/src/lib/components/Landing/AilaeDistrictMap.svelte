<script lang="ts">
  import { onMount } from 'svelte';

  interface District {
    name: string;
    x: number;
    y: number;
  }

  const districts: District[] = [
    { name: 'North', x: 720, y: 120 },
    { name: 'Tai Po', x: 800, y: 150 },
    { name: 'Yuen Long', x: 560, y: 240 },
    { name: 'Tuen Mun', x: 440, y: 300 },
    { name: 'Tsuen Wan', x: 520, y: 350 },
    { name: 'Sha Tin', x: 780, y: 210 },
    { name: 'Sai Kung', x: 900, y: 260 },
    { name: 'Kwai Tsing', x: 560, y: 380 },
    { name: 'Sham Shui Po', x: 640, y: 390 },
    { name: 'Kowloon City', x: 720, y: 410 },
    { name: 'Wong Tai Sin', x: 760, y: 370 },
    { name: 'Kwun Tong', x: 820, y: 390 },
    { name: 'Yau Tsim', x: 680, y: 430 },
    { name: 'Wan Chai', x: 720, y: 460 },
    { name: 'Eastern', x: 780, y: 470 },
    { name: 'Central & Western', x: 680, y: 480 },
    { name: 'Southern', x: 640, y: 530 },
    { name: 'Islands', x: 380, y: 480 },
  ];

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
    ['Kowloon City', 'Yau Tsim'],
    ['Yau Tsim', 'Wan Chai'],
    ['Wan Chai', 'Eastern'],
    ['Eastern', 'Central & Western'],
    ['Central & Western', 'Southern'],
    ['Kowloon City', 'Wong Tai Sin'],
    ['Wong Tai Sin', 'Kwun Tong'],
    ['Kwun Tong', 'Sai Kung'],
    ['Yau Tsim', 'Central & Western'],
    ['Tuen Mun', 'Islands'],
    ['Tsuen Wan', 'Islands'],
    ['Sha Tin', 'Kowloon City'],
  ];

  interface Particle {
    x: number;
    y: number;
    r: number;
    o: number;
    d: number;
  }

  let particles: Particle[] = [];

  let tooltipVisible = false;
  let tooltipX = 0;
  let tooltipY = 0;

  onMount(() => {
    const arr: Particle[] = [];
    for (let i = 0; i < 60; i++) {
      arr.push({
        x: Math.random() * 1200,
        y: Math.random() * 760,
        r: 0.5 + Math.random() * 1.5,
        o: 0.08 + Math.random() * 0.35,
        d: 2 + Math.random() * 4,
      });
    }
    particles = arr;
  });

  function findDistrict(name: string): District | undefined {
    return districts.find((d) => d.name === name);
  }

  function showTooltip(e: MouseEvent) {
    tooltipVisible = true;
    tooltipX = e.clientX;
    tooltipY = e.clientY;
  }

  function moveTooltip(e: MouseEvent) {
    tooltipX = e.clientX;
    tooltipY = e.clientY;
  }

  function hideTooltip() {
    tooltipVisible = false;
  }
</script>

<div class="map-wrap">
  <svg
    viewBox="0 0 1200 760"
    xmlns="http://www.w3.org/2000/svg"
    class="h-full w-full"
    preserveAspectRatio="xMidYMid slice"
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
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
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
        <path
          d="M 48 0 L 0 0 0 48"
          fill="none"
          stroke="rgba(0,212,255,0.05)"
          stroke-width="0.5"
        />
      </pattern>
    </defs>

    <!-- Background grid -->
    <rect width="1200" height="760" fill="url(#grid)" />

    <!-- Radar rings -->
    <g opacity="0.35">
      <circle cx="680" cy="380" r="160" fill="none" stroke="url(#ringGrad)" stroke-width="1" />
      <circle cx="680" cy="380" r="260" fill="none" stroke="url(#ringGrad)" stroke-width="1" />
      <circle cx="680" cy="380" r="380" fill="none" stroke="url(#ringGrad)" stroke-width="1" />
    </g>

    <!-- Sweeping radar line -->
    <line
      x1="680"
      y1="380"
      x2="840"
      y2="380"
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

    <!-- ====== Fine-grained HK outline ====== -->
    <!-- New Territories main body -->
    <path
      d="M 640 80
         L 680 60 L 720 55 L 760 65 L 800 85 L 830 110 L 860 140 L 880 180 L 890 220
         L 880 260 L 860 290 L 830 310 L 800 320 L 770 325 L 740 320 L 710 310
         L 680 295 L 650 280 L 620 260 L 590 235 L 560 210 L 535 180 L 520 150
         L 515 120 L 525 95 L 550 80 L 590 75 Z"
      fill="rgba(7,68,88,0.18)"
      stroke="#0E7372"
      stroke-width="1.2"
      filter="url(#cyanGlow)"
      class="region-fill"
    />

    <!-- Kowloon peninsula -->
    <path
      d="M 650 300
         L 680 295 L 710 305 L 740 325 L 760 350 L 750 380 L 730 405
         L 700 415 L 670 410 L 645 395 L 630 370 L 625 345 L 635 320 Z"
      fill="rgba(7,68,88,0.22)"
      stroke="#0E7372"
      stroke-width="1.2"
      filter="url(#cyanGlow)"
      class="region-fill"
    />

    <!-- Hong Kong Island -->
    <path
      d="M 620 410
         L 640 405 L 660 415 L 680 435 L 700 455 L 720 465 L 740 460
         L 760 445 L 775 425 L 785 405 L 790 385 L 785 370
         L 770 365 L 750 370 L 730 385 L 710 400 L 690 408 L 670 405
         L 650 400 L 630 402 Z"
      fill="rgba(7,68,88,0.22)"
      stroke="#0E7372"
      stroke-width="1.2"
      filter="url(#cyanGlow)"
      class="region-fill"
    />

    <!-- Lantau Island -->
    <path
      d="M 320 340
         L 360 320 L 400 325 L 430 345 L 450 375 L 455 410 L 450 445
         L 435 475 L 410 490 L 380 495 L 350 485 L 325 465 L 305 435
         L 295 400 L 300 370 Z"
      fill="rgba(7,68,88,0.15)"
      stroke="#0E7372"
      stroke-width="1.1"
      filter="url(#cyanGlow)"
      class="region-fill"
    />

    <!-- Outlying islands cluster -->
    <path
      d="M 460 470 L 490 460 L 510 480 L 490 500 Z"
      fill="rgba(7,68,88,0.12)"
      stroke="#0E7372"
      stroke-width="0.8"
      filter="url(#cyanGlow)"
      class="region-fill"
    />
    <path
      d="M 840 340 L 865 335 L 875 355 L 855 365 Z"
      fill="rgba(7,68,88,0.12)"
      stroke="#0E7372"
      stroke-width="0.8"
      filter="url(#cyanGlow)"
      class="region-fill"
    />

    <!-- ====== Cyberport highlight zone ====== -->
    <g
      class="cyberport-zone"
      on:mouseenter={showTooltip}
      on:mousemove={moveTooltip}
      on:mouseleave={hideTooltip}
      style="cursor: pointer;"
    >
      <!-- Glow aura -->
      <circle cx="620" cy="430" r="45" fill="rgba(0,212,255,0.06)" filter="url(#cyberGlow)" class="cyber-aura" />
      <circle cx="620" cy="430" r="30" fill="none" stroke="rgba(0,212,255,0.3)" stroke-width="1" class="cyber-ring" />
      <circle cx="620" cy="430" r="18" fill="none" stroke="rgba(0,212,255,0.5)" stroke-width="1.5" class="cyber-ring-inner" />
      <!-- Core beacon -->
      <circle cx="620" cy="430" r="7" fill="#00D4FF" filter="url(#strongCyanGlow)" class="cyber-core" />
      <circle cx="620" cy="430" r="3" fill="#fff" />
      <!-- Label -->
      <text
        x="620"
        y="400"
        fill="#eafcff"
        font-size="11"
        font-weight="700"
        font-family="Roboto, system-ui, sans-serif"
        text-anchor="middle"
        style="text-shadow: 0 1px 6px rgba(0,0,0,0.8);"
      >
        Cyberport
      </text>
      <text
        x="620"
        y="413"
        fill="#58f2ff"
        font-size="8"
        font-weight="600"
        font-family="Roboto, system-ui, sans-serif"
        text-anchor="middle"
        style="text-shadow: 0 1px 6px rgba(0,0,0,0.8);"
      >
        HQ
      </text>
    </g>

    <!-- District connection lines -->
    <g stroke="rgba(0,212,255,0.28)" stroke-width="0.8">
      {#each connections as [aName, bName]}
        {@const a = findDistrict(aName)}
        {@const b = findDistrict(bName)}
        {#if a && b}
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
        {/if}
      {/each}
    </g>

    <!-- Outgoing gold paths -->
    <g fill="none" stroke-width="2" filter="url(#goldGlow)" opacity="0.9">
      <path
        d="M 760 460 Q 920 320 1100 200"
        stroke="url(#goldLine)"
        stroke-dasharray="8 10"
        class="dash-flow"
      />
      <path
        d="M 740 420 Q 920 400 1100 420"
        stroke="url(#goldLine)"
        stroke-dasharray="8 10"
        class="dash-flow-reverse"
      />
      <path
        d="M 850 240 Q 970 200 1100 180"
        stroke="url(#goldLine)"
        stroke-dasharray="8 10"
        class="dash-flow-slow"
      />
    </g>

    <!-- Outgoing destination labels -->
    <g font-size="13" font-weight="700" font-family="Roboto, system-ui, sans-serif">
      <text x="1100" y="190" fill="#FFC629" text-anchor="middle" filter="url(#goldGlow)">UK</text>
      <text x="1100" y="205" fill="#FFC629" text-anchor="middle" font-size="10" opacity="0.8">Education Gateway</text>

      <text x="1100" y="415" fill="#FFC629" text-anchor="middle" filter="url(#goldGlow)">OBOR</text>
      <text x="1100" y="430" fill="#FFC629" text-anchor="middle" font-size="10" opacity="0.8">&amp; European Market</text>
    </g>

    <!-- Destination halo dots -->
    <g>
      <circle cx="1100" cy="200" r="5" fill="#FFC629" filter="url(#goldGlow)">
        <animate attributeName="r" values="5;7;5" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.8;0.4;0.8" dur="3s" repeatCount="indefinite" />
      </circle>
      <circle cx="1100" cy="420" r="5" fill="#FFC629" filter="url(#goldGlow)">
        <animate attributeName="r" values="5;7;5" dur="3s" repeatCount="indefinite" begin="1.5s" />
        <animate attributeName="opacity" values="0.8;0.4;0.8" dur="3s" repeatCount="indefinite" begin="1.5s" />
      </circle>
    </g>

    <!-- District nodes -->
    <g>
      {#each districts as d (d.name)}
        <g transform="translate({d.x},{d.y})">
          <circle r="10" fill="none" stroke="rgba(0,212,255,0.35)" stroke-width="1" class="pulse-ring" />
          <circle r="5" fill="#00D4FF" filter="url(#strongCyanGlow)" />
          <circle r="2.2" fill="#fff" />
          <path
            d="M -3 -1 L 0 -4 L 3 -1 M -3 -1 L -3 2 L 3 2 L 3 -1"
            fill="none"
            stroke="#fff"
            stroke-width="0.7"
            opacity="0.9"
            transform="translate(0, 7) scale(0.75)"
          />
          <text
            y="-16"
            fill="#eafcff"
            font-size="9.5"
            font-weight="600"
            font-family="Roboto, system-ui, sans-serif"
            text-anchor="middle"
            style="text-shadow: 0 1px 4px rgba(0,0,0,0.7);"
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
    to {
      stroke-dashoffset: -54;
    }
  }
  @keyframes dashFlowReverse {
    to {
      stroke-dashoffset: 54;
    }
  }
  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
      opacity: 0.35;
    }
    50% {
      transform: scale(1.35);
      opacity: 0.1;
    }
  }
  @keyframes particleTwinkle {
    0%, 100% {
      opacity: 0.08;
    }
    50% {
      opacity: 0.45;
    }
  }
  @keyframes radarSweep {
    0% {
      transform: rotate(0deg);
      opacity: 0.15;
    }
    50% {
      opacity: 0.35;
    }
    100% {
      transform: rotate(360deg);
      opacity: 0.15;
    }
  }
  @keyframes cyberPulse {
    0%, 100% {
      r: 18;
      opacity: 0.5;
    }
    50% {
      r: 28;
      opacity: 0.15;
    }
  }
  @keyframes cyberAura {
    0%, 100% {
      r: 45;
      opacity: 0.4;
    }
    50% {
      r: 55;
      opacity: 0.2;
    }
  }

  .dash-flow {
    animation: dashFlow 2.2s linear infinite;
  }
  .dash-flow-reverse {
    animation: dashFlowReverse 3s linear infinite;
  }
  .dash-flow-slow {
    animation: dashFlow 4s linear infinite;
  }

  .pulse-ring {
    animation: pulse 3s ease-in-out infinite;
    transform-origin: center;
  }

  .particle {
    animation: particleTwinkle 4s ease-in-out infinite;
  }

  .radar-sweep {
    transform-origin: 680px 380px;
    animation: radarSweep 8s linear infinite;
  }

  .region-fill {
    transition: fill-opacity 0.4s ease;
  }
  .region-fill:hover {
    fill-opacity: 0.5;
  }

  .cyber-ring-inner {
    animation: cyberPulse 2.5s ease-in-out infinite;
    transform-origin: center;
  }
  .cyber-aura {
    animation: cyberAura 4s ease-in-out infinite;
    transform-origin: center;
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

  @keyframes tooltipIn {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
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
