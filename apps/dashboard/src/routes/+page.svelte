<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { isSingleOrgMode } from '$lib/utils/config/singleOrg';
  import { hasSession } from '$lib/utils/functions/supabase';
  import { BRAND } from '$lib/utils/config/brand';

  onMount(() => {
    if (isSingleOrgMode()) {
      goto(hasSession() ? '/lms' : '/login');
    }
  });

</script>

<svelte:head>
  <title>{BRAND.name} — 18 District School Center</title>
</svelte:head>

{#if !isSingleOrgMode()}
  <div class="relative h-screen w-full overflow-hidden bg-[#020617] text-white">
    <!-- Subtle grid -->
    <div
      class="pointer-events-none absolute inset-0 opacity-[0.04]"
      style="background-image: radial-gradient(#22d3ee 1px, transparent 1px); background-size: 36px 36px;"
    />

    <!-- Glow orbs -->
    <div class="pointer-events-none absolute -left-24 -top-24 h-[500px] w-[500px] rounded-full bg-cyan-500/[0.06] blur-[120px]" />
    <div class="pointer-events-none absolute -bottom-24 -right-24 h-[500px] w-[500px] rounded-full bg-blue-600/[0.06] blur-[120px]" />

    <div class="relative z-10 mx-auto flex h-full max-w-[1400px] flex-col items-center justify-center px-8 lg:flex-row lg:px-16">
      <!-- Left Panel -->
      <div class="flex w-full flex-1 flex-col justify-center space-y-5 lg:max-w-md lg:pr-10">
        <!-- 5GNU Logo -->
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-black text-white shadow-lg shadow-cyan-500/20">
            5G
          </div>
          <div class="flex flex-col">
            <span class="text-xl font-black tracking-tight text-white">5G<span class="text-cyan-400">NU</span></span>
            <span class="text-[10px] font-medium uppercase tracking-widest text-slate-500">MultiMedia Limited</span>
          </div>
        </div>

        <div class="space-y-1">
          <h1 class="text-5xl font-black leading-[0.9] tracking-tighter md:text-6xl">
            <span class="bg-gradient-to-r from-cyan-400 to-cyan-200 bg-clip-text text-transparent">18</span>
            <span class="block text-white">District</span>
            <span class="block text-white">School Center</span>
          </h1>
          <div class="flex items-center gap-3 pt-3">
            <div class="h-0.5 w-10 bg-cyan-500" />
            <h2 class="text-xl font-bold text-cyan-300 md:text-2xl">AiLAE Promotion</h2>
          </div>
        </div>

        <div class="space-y-2.5">
          <div class="flex items-start gap-3 rounded-lg border border-cyan-500/[0.08] bg-cyan-950/30 p-3 backdrop-blur-sm">
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/20">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </div>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">From HK to</p>
              <p class="text-sm font-bold text-amber-400">OBOR and European Market via UK</p>
            </div>
          </div>

          <div class="flex items-start gap-3 rounded-lg border border-cyan-500/[0.08] bg-cyan-950/30 p-3 backdrop-blur-sm">
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/20">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M3 21h18M5 21V7l8-4 8 4v14M9 21v-6h6v6" />
              </svg>
            </div>
            <div>
              <p class="text-base font-bold text-cyan-300">18 Districts</p>
              <p class="text-xs text-slate-400">School Center Network</p>
            </div>
          </div>

          <div class="flex items-start gap-3 rounded-lg border border-cyan-500/[0.08] bg-cyan-950/30 p-3 backdrop-blur-sm">
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/20">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <p class="text-base font-bold text-cyan-300">AiLAE Empowerment</p>
              <p class="text-xs text-slate-400">AI Learning · Aerial Tech · Education</p>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap gap-3 pt-1">
          <a
            href="/login"
            class="group relative overflow-hidden rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-7 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/40"
          >
            <span class="relative z-10">Get Started</span>
            <div class="absolute inset-0 -translate-x-full bg-white/15 transition-transform duration-300 group-hover:translate-x-0" />
          </a>
          <a
            href="/login"
            class="rounded-full border border-cyan-500/20 px-7 py-2.5 text-sm font-bold text-cyan-300 transition hover:border-cyan-400/40 hover:bg-cyan-500/5"
          >
            Login
          </a>
        </div>
      </div>

      <!-- Right Panel: 18 District Network Map -->
      <div class="relative flex w-full flex-1 items-center justify-center lg:justify-end">
        <div class="relative w-full max-w-3xl">
          <svg viewBox="0 0 900 600" class="h-auto w-full" style="filter: drop-shadow(0 0 30px rgba(34,211,238,0.1));">
            <defs>
              <!-- Glow filter -->
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <filter id="strongGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <!-- Gradients -->
              <linearGradient id="mapStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.9" />
                <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0.5" />
              </linearGradient>
              <radialGradient id="dotGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#22d3ee" />
                <stop offset="100%" stop-color="#0891b2" />
              </radialGradient>
              <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.6" />
                <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.8" />
              </linearGradient>
            </defs>

            <!-- Background world map hint (top-right) -->
            <g opacity="0.12">
              <circle cx="780" cy="100" r="70" fill="none" stroke="#22d3ee" stroke-width="0.5" />
              <path d="M740 70 Q760 60 780 75 Q800 60 820 70 Q830 90 820 110 Q800 130 780 120 Q760 130 740 110 Q730 90 740 70Z" fill="#22d3ee" opacity="0.3" />
            </g>

            <!-- ===== HK 18 District Map Outline (detailed) ===== -->
            <!-- Main landmass -->
            <path d="M260 120
                     C280 110, 310 105, 340 115
                     C370 125, 390 145, 400 170
                     C410 200, 405 230, 390 260
                     C375 290, 360 320, 350 350
                     C340 380, 330 410, 320 440
                     C310 470, 295 490, 280 500
                     C260 510, 240 505, 225 490
                     C210 475, 200 450, 195 420
                     C190 390, 185 360, 180 330
                     C175 300, 170 270, 165 240
                     C160 210, 155 180, 160 160
                     C170 140, 190 130, 210 125
                     C230 120, 245 118, 260 120Z"
                  fill="rgba(14,115,114,0.04)" stroke="url(#mapStroke)" stroke-width="1.2" filter="url(#glow)" />

            <!-- Lantau / Islands (left-bottom) -->
            <path d="M120 380
                     C130 370, 150 375, 160 390
                     C170 405, 165 425, 155 440
                     C145 455, 130 460, 115 450
                     C100 440, 95 420, 105 400
                     C110 390, 115 385, 120 380Z"
                  fill="rgba(14,115,114,0.03)" stroke="url(#mapStroke)" stroke-width="0.8" opacity="0.7" />

            <!-- ===== Connection Lines (network effect) ===== -->
            <g stroke="rgba(34,211,238,0.15)" stroke-width="0.6">
              <!-- Cross-district connections -->
              <line x1="280" y1="160" x2="340" y2="180" />
              <line x1="340" y1="180" x2="380" y2="220" />
              <line x1="380" y1="220" x2="360" y2="280" />
              <line x1="360" y1="280" x2="310" y2="310" />
              <line x1="310" y1="310" x2="260" y2="290" />
              <line x1="260" y1="290" x2="220" y2="320" />
              <line x1="220" y1="320" x2="240" y2="380" />
              <line x1="240" y1="380" x2="290" y2="410" />
              <line x1="290" y1="410" x2="340" y2="390" />
              <line x1="340" y1="390" x2="370" y2="340" />
              <line x1="370" y1="340" x2="410" y2="300" />
              <line x1="410" y1="300" x2="430" y2="240" />
              <line x1="430" y1="240" x2="400" y2="190" />
              <line x1="400" y1="190" x2="360" y2="160" />
              <line x1="360" y1="160" x2="300" y2="150" />
              <line x1="300" y1="150" x2="280" y2="160" />
              <!-- Diagonal connections -->
              <line x1="280" y1="160" x2="360" y2="280" stroke-dasharray="3 3" />
              <line x1="340" y1="180" x2="310" y2="310" stroke-dasharray="3 3" />
              <line x1="380" y1="220" x2="370" y2="340" stroke-dasharray="3 3" />
              <line x1="260" y1="290" x2="290" y2="410" stroke-dasharray="3 3" />
              <line x1="220" y1="320" x2="340" y2="390" stroke-dasharray="3 3" />
            </g>

            <!-- ===== Animated dashed line from HK to UK/World ===== -->
            <path d="M430 200 Q550 150 700 100 Q740 80 780 90"
                  fill="none" stroke="url(#lineGrad)" stroke-width="1.5" stroke-dasharray="5 5" filter="url(#glow)">
              <animate attributeName="stroke-dashoffset" values="0;-20" dur="2s" repeatCount="indefinite" />
            </path>
            <path d="M430 240 Q580 220 720 130 Q760 110 790 115"
                  fill="none" stroke="url(#lineGrad)" stroke-width="1" stroke-dasharray="4 4" opacity="0.6">
              <animate attributeName="stroke-dashoffset" values="0;-16" dur="2.5s" repeatCount="indefinite" />
            </path>

            <!-- ===== UK / Europe Markers (top-right) ===== -->
            <!-- UK Big Ben icon -->
            <g transform="translate(780, 90)">
              <circle r="22" fill="none" stroke="#22d3ee" stroke-width="0.8" opacity="0.3" />
              <circle r="16" fill="rgba(34,211,238,0.08)" stroke="#22d3ee" stroke-width="0.5" />
              <!-- Tower -->
              <rect x="-3" y="-10" width="6" height="18" rx="1" fill="none" stroke="#f59e0b" stroke-width="1" />
              <rect x="-4" y="-12" width="8" height="4" rx="1" fill="none" stroke="#f59e0b" stroke-width="0.8" />
              <line x1="0" y1="-14" x2="0" y2="-16" stroke="#f59e0b" stroke-width="1" />
              <text y="28" text-anchor="middle" fill="#bae6fd" font-size="8" font-weight="600">UK</text>
            </g>

            <!-- OBOR & European Market marker -->
            <g transform="translate(830, 160)">
              <circle r="18" fill="none" stroke="#f59e0b" stroke-width="0.6" opacity="0.4" />
              <circle r="12" fill="rgba(245,158,11,0.08)" stroke="#f59e0b" stroke-width="0.4" />
              <!-- Globe hint -->
              <circle r="6" fill="none" stroke="#f59e0b" stroke-width="0.6" />
              <path d="M-6 0h12M0 -6v12" stroke="#f59e0b" stroke-width="0.4" />
              <text y="26" text-anchor="middle" fill="#f59e0b" font-size="7" font-weight="600">OBOR &amp;</text>
              <text y="35" text-anchor="middle" fill="#f59e0b" font-size="7" font-weight="600">European Market</text>
            </g>

            <!-- ===== 18 District School Markers ===== -->
            <!-- Each marker: ping circle + school icon + drone icon + label -->

            <!-- North -->
            <g transform="translate(360, 140)">
              <circle r="3" fill="none" stroke="#22d3ee" stroke-width="0.8" opacity="0.4"><animate attributeName="r" values="2;14" dur="2.5s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.5;0" dur="2.5s" repeatCount="indefinite" /></circle>
              <circle r="4" fill="url(#dotGrad)" />
              <text y="14" text-anchor="middle" fill="#bae6fd" font-size="7" font-weight="600" style="text-shadow: 0 1px 6px rgba(0,0,0,0.9);">North</text>
              <!-- School icon -->
              <g transform="translate(-10, -14)" opacity="0.85">
                <path d="M0 4 L4 0 L8 4 V8 H0 Z" fill="none" stroke="#22d3ee" stroke-width="0.7" />
                <rect x="3" y="5" width="2" height="3" fill="#22d3ee" opacity="0.5" />
              </g>
              <!-- Drone icon -->
              <g transform="translate(4, -16)" opacity="0.9">
                <circle r="2" fill="none" stroke="#22d3ee" stroke-width="0.6" />
                <line x1="-3" y1="0" x2="3" y2="0" stroke="#22d3ee" stroke-width="0.5" />
                <line x1="0" y1="-3" x2="0" y2="3" stroke="#22d3ee" stroke-width="0.5" />
              </g>
            </g>

            <!-- Tai Po -->
            <g transform="translate(400, 160)">
              <circle r="3" fill="none" stroke="#22d3ee" stroke-width="0.8" opacity="0.4"><animate attributeName="r" values="2;14" dur="2.5s" repeatCount="indefinite" begin="0.3s" /><animate attributeName="opacity" values="0.5;0" dur="2.5s" repeatCount="indefinite" begin="0.3s" /></circle>
              <circle r="4" fill="url(#dotGrad)" />
              <text y="14" text-anchor="middle" fill="#bae6fd" font-size="7" font-weight="600" style="text-shadow: 0 1px 6px rgba(0,0,0,0.9);">Tai Po</text>
              <g transform="translate(-10, -14)" opacity="0.85"><path d="M0 4 L4 0 L8 4 V8 H0 Z" fill="none" stroke="#22d3ee" stroke-width="0.7" /><rect x="3" y="5" width="2" height="3" fill="#22d3ee" opacity="0.5" /></g>
              <g transform="translate(4, -16)" opacity="0.9"><circle r="2" fill="none" stroke="#22d3ee" stroke-width="0.6" /><line x1="-3" y1="0" x2="3" y2="0" stroke="#22d3ee" stroke-width="0.5" /><line x1="0" y1="-3" x2="0" y2="3" stroke="#22d3ee" stroke-width="0.5" /></g>
            </g>

            <!-- Sai Kung -->
            <g transform="translate(440, 200)">
              <circle r="3" fill="none" stroke="#22d3ee" stroke-width="0.8" opacity="0.4"><animate attributeName="r" values="2;14" dur="2.5s" repeatCount="indefinite" begin="0.6s" /><animate attributeName="opacity" values="0.5;0" dur="2.5s" repeatCount="indefinite" begin="0.6s" /></circle>
              <circle r="4" fill="url(#dotGrad)" />
              <text y="14" text-anchor="middle" fill="#bae6fd" font-size="7" font-weight="600" style="text-shadow: 0 1px 6px rgba(0,0,0,0.9);">Sai Kung</text>
              <g transform="translate(-10, -14)" opacity="0.85"><path d="M0 4 L4 0 L8 4 V8 H0 Z" fill="none" stroke="#22d3ee" stroke-width="0.7" /><rect x="3" y="5" width="2" height="3" fill="#22d3ee" opacity="0.5" /></g>
              <g transform="translate(4, -16)" opacity="0.9"><circle r="2" fill="none" stroke="#22d3ee" stroke-width="0.6" /><line x1="-3" y1="0" x2="3" y2="0" stroke="#22d3ee" stroke-width="0.5" /><line x1="0" y1="-3" x2="0" y2="3" stroke="#22d3ee" stroke-width="0.5" /></g>
            </g>

            <!-- Sha Tin -->
            <g transform="translate(380, 200)">
              <circle r="3" fill="none" stroke="#22d3ee" stroke-width="0.8" opacity="0.4"><animate attributeName="r" values="2;14" dur="2.5s" repeatCount="indefinite" begin="0.9s" /><animate attributeName="opacity" values="0.5;0" dur="2.5s" repeatCount="indefinite" begin="0.9s" /></circle>
              <circle r="4" fill="url(#dotGrad)" />
              <text y="14" text-anchor="middle" fill="#bae6fd" font-size="7" font-weight="600" style="text-shadow: 0 1px 6px rgba(0,0,0,0.9);">Sha Tin</text>
              <g transform="translate(-10, -14)" opacity="0.85"><path d="M0 4 L4 0 L8 4 V8 H0 Z" fill="none" stroke="#22d3ee" stroke-width="0.7" /><rect x="3" y="5" width="2" height="3" fill="#22d3ee" opacity="0.5" /></g>
              <g transform="translate(4, -16)" opacity="0.9"><circle r="2" fill="none" stroke="#22d3ee" stroke-width="0.6" /><line x1="-3" y1="0" x2="3" y2="0" stroke="#22d3ee" stroke-width="0.5" /><line x1="0" y1="-3" x2="0" y2="3" stroke="#22d3ee" stroke-width="0.5" /></g>
            </g>

            <!-- Yuen Long -->
            <g transform="translate(280, 160)">
              <circle r="3" fill="none" stroke="#22d3ee" stroke-width="0.8" opacity="0.4"><animate attributeName="r" values="2;14" dur="2.5s" repeatCount="indefinite" begin="0.4s" /><animate attributeName="opacity" values="0.5;0" dur="2.5s" repeatCount="indefinite" begin="0.4s" /></circle>
              <circle r="4" fill="url(#dotGrad)" />
              <text y="14" text-anchor="middle" fill="#bae6fd" font-size="7" font-weight="600" style="text-shadow: 0 1px 6px rgba(0,0,0,0.9);">Yuen Long</text>
              <g transform="translate(-10, -14)" opacity="0.85"><path d="M0 4 L4 0 L8 4 V8 H0 Z" fill="none" stroke="#22d3ee" stroke-width="0.7" /><rect x="3" y="5" width="2" height="3" fill="#22d3ee" opacity="0.5" /></g>
              <g transform="translate(4, -16)" opacity="0.9"><circle r="2" fill="none" stroke="#22d3ee" stroke-width="0.6" /><line x1="-3" y1="0" x2="3" y2="0" stroke="#22d3ee" stroke-width="0.5" /><line x1="0" y1="-3" x2="0" y2="3" stroke="#22d3ee" stroke-width="0.5" /></g>
            </g>

            <!-- Tuen Mun -->
            <g transform="translate(240, 200)">
              <circle r="3" fill="none" stroke="#22d3ee" stroke-width="0.8" opacity="0.4"><animate attributeName="r" values="2;14" dur="2.5s" repeatCount="indefinite" begin="0.7s" /><animate attributeName="opacity" values="0.5;0" dur="2.5s" repeatCount="indefinite" begin="0.7s" /></circle>
              <circle r="4" fill="url(#dotGrad)" />
              <text y="14" text-anchor="middle" fill="#bae6fd" font-size="7" font-weight="600" style="text-shadow: 0 1px 6px rgba(0,0,0,0.9);">Tuen Mun</text>
              <g transform="translate(-10, -14)" opacity="0.85"><path d="M0 4 L4 0 L8 4 V8 H0 Z" fill="none" stroke="#22d3ee" stroke-width="0.7" /><rect x="3" y="5" width="2" height="3" fill="#22d3ee" opacity="0.5" /></g>
              <g transform="translate(4, -16)" opacity="0.9"><circle r="2" fill="none" stroke="#22d3ee" stroke-width="0.6" /><line x1="-3" y1="0" x2="3" y2="0" stroke="#22d3ee" stroke-width="0.5" /><line x1="0" y1="-3" x2="0" y2="3" stroke="#22d3ee" stroke-width="0.5" /></g>
            </g>

            <!-- Tsuen Wan -->
            <g transform="translate(300, 230)">
              <circle r="3" fill="none" stroke="#22d3ee" stroke-width="0.8" opacity="0.4"><animate attributeName="r" values="2;14" dur="2.5s" repeatCount="indefinite" begin="1.0s" /><animate attributeName="opacity" values="0.5;0" dur="2.5s" repeatCount="indefinite" begin="1.0s" /></circle>
              <circle r="4" fill="url(#dotGrad)" />
              <text y="14" text-anchor="middle" fill="#bae6fd" font-size="7" font-weight="600" style="text-shadow: 0 1px 6px rgba(0,0,0,0.9);">Tsuen Wan</text>
              <g transform="translate(-10, -14)" opacity="0.85"><path d="M0 4 L4 0 L8 4 V8 H0 Z" fill="none" stroke="#22d3ee" stroke-width="0.7" /><rect x="3" y="5" width="2" height="3" fill="#22d3ee" opacity="0.5" /></g>
              <g transform="translate(4, -16)" opacity="0.9"><circle r="2" fill="none" stroke="#22d3ee" stroke-width="0.6" /><line x1="-3" y1="0" x2="3" y2="0" stroke="#22d3ee" stroke-width="0.5" /><line x1="0" y1="-3" x2="0" y2="3" stroke="#22d3ee" stroke-width="0.5" /></g>
            </g>

            <!-- Kwai Tsing -->
            <g transform="translate(280, 270)">
              <circle r="3" fill="none" stroke="#22d3ee" stroke-width="0.8" opacity="0.4"><animate attributeName="r" values="2;14" dur="2.5s" repeatCount="indefinite" begin="0.2s" /><animate attributeName="opacity" values="0.5;0" dur="2.5s" repeatCount="indefinite" begin="0.2s" /></circle>
              <circle r="4" fill="url(#dotGrad)" />
              <text y="14" text-anchor="middle" fill="#bae6fd" font-size="7" font-weight="600" style="text-shadow: 0 1px 6px rgba(0,0,0,0.9);">Kwai Tsing</text>
              <g transform="translate(-10, -14)" opacity="0.85"><path d="M0 4 L4 0 L8 4 V8 H0 Z" fill="none" stroke="#22d3ee" stroke-width="0.7" /><rect x="3" y="5" width="2" height="3" fill="#22d3ee" opacity="0.5" /></g>
              <g transform="translate(4, -16)" opacity="0.9"><circle r="2" fill="none" stroke="#22d3ee" stroke-width="0.6" /><line x1="-3" y1="0" x2="3" y2="0" stroke="#22d3ee" stroke-width="0.5" /><line x1="0" y1="-3" x2="0" y2="3" stroke="#22d3ee" stroke-width="0.5" /></g>
            </g>

            <!-- Kwun Tong -->
            <g transform="translate(400, 260)">
              <circle r="3" fill="none" stroke="#22d3ee" stroke-width="0.8" opacity="0.4"><animate attributeName="r" values="2;14" dur="2.5s" repeatCount="indefinite" begin="0.5s" /><animate attributeName="opacity" values="0.5;0" dur="2.5s" repeatCount="indefinite" begin="0.5s" /></circle>
              <circle r="4" fill="url(#dotGrad)" />
              <text y="14" text-anchor="middle" fill="#bae6fd" font-size="7" font-weight="600" style="text-shadow: 0 1px 6px rgba(0,0,0,0.9);">Kwun Tong</text>
              <g transform="translate(-10, -14)" opacity="0.85"><path d="M0 4 L4 0 L8 4 V8 H0 Z" fill="none" stroke="#22d3ee" stroke-width="0.7" /><rect x="3" y="5" width="2" height="3" fill="#22d3ee" opacity="0.5" /></g>
              <g transform="translate(4, -16)" opacity="0.9"><circle r="2" fill="none" stroke="#22d3ee" stroke-width="0.6" /><line x1="-3" y1="0" x2="3" y2="0" stroke="#22d3ee" stroke-width="0.5" /><line x1="0" y1="-3" x2="0" y2="3" stroke="#22d3ee" stroke-width="0.5" /></g>
            </g>

            <!-- Wong Tai Sin -->
            <g transform="translate(360, 290)">
              <circle r="3" fill="none" stroke="#22d3ee" stroke-width="0.8" opacity="0.4"><animate attributeName="r" values="2;14" dur="2.5s" repeatCount="indefinite" begin="0.8s" /><animate attributeName="opacity" values="0.5;0" dur="2.5s" repeatCount="indefinite" begin="0.8s" /></circle>
              <circle r="4" fill="url(#dotGrad)" />
              <text y="14" text-anchor="middle" fill="#bae6fd" font-size="7" font-weight="600" style="text-shadow: 0 1px 6px rgba(0,0,0,0.9);">Wong Tai Sin</text>
              <g transform="translate(-10, -14)" opacity="0.85"><path d="M0 4 L4 0 L8 4 V8 H0 Z" fill="none" stroke="#22d3ee" stroke-width="0.7" /><rect x="3" y="5" width="2" height="3" fill="#22d3ee" opacity="0.5" /></g>
              <g transform="translate(4, -16)" opacity="0.9"><circle r="2" fill="none" stroke="#22d3ee" stroke-width="0.6" /><line x1="-3" y1="0" x2="3" y2="0" stroke="#22d3ee" stroke-width="0.5" /><line x1="0" y1="-3" x2="0" y2="3" stroke="#22d3ee" stroke-width="0.5" /></g>
            </g>

            <!-- Sham Shui Po -->
            <g transform="translate(320, 330)">
              <circle r="3" fill="none" stroke="#22d3ee" stroke-width="0.8" opacity="0.4"><animate attributeName="r" values="2;14" dur="2.5s" repeatCount="indefinite" begin="1.1s" /><animate attributeName="opacity" values="0.5;0" dur="2.5s" repeatCount="indefinite" begin="1.1s" /></circle>
              <circle r="4" fill="url(#dotGrad)" />
              <text y="14" text-anchor="middle" fill="#bae6fd" font-size="7" font-weight="600" style="text-shadow: 0 1px 6px rgba(0,0,0,0.9);">Sham Shui Po</text>
              <g transform="translate(-10, -14)" opacity="0.85"><path d="M0 4 L4 0 L8 4 V8 H0 Z" fill="none" stroke="#22d3ee" stroke-width="0.7" /><rect x="3" y="5" width="2" height="3" fill="#22d3ee" opacity="0.5" /></g>
              <g transform="translate(4, -16)" opacity="0.9"><circle r="2" fill="none" stroke="#22d3ee" stroke-width="0.6" /><line x1="-3" y1="0" x2="3" y2="0" stroke="#22d3ee" stroke-width="0.5" /><line x1="0" y1="-3" x2="0" y2="3" stroke="#22d3ee" stroke-width="0.5" /></g>
            </g>

            <!-- Yau Tsim -->
            <g transform="translate(340, 360)">
              <circle r="3" fill="none" stroke="#22d3ee" stroke-width="0.8" opacity="0.4"><animate attributeName="r" values="2;14" dur="2.5s" repeatCount="indefinite" begin="0.3s" /><animate attributeName="opacity" values="0.5;0" dur="2.5s" repeatCount="indefinite" begin="0.3s" /></circle>
              <circle r="4" fill="url(#dotGrad)" />
              <text y="14" text-anchor="middle" fill="#bae6fd" font-size="7" font-weight="600" style="text-shadow: 0 1px 6px rgba(0,0,0,0.9);">Yau Tsim</text>
              <g transform="translate(-10, -14)" opacity="0.85"><path d="M0 4 L4 0 L8 4 V8 H0 Z" fill="none" stroke="#22d3ee" stroke-width="0.7" /><rect x="3" y="5" width="2" height="3" fill="#22d3ee" opacity="0.5" /></g>
              <g transform="translate(4, -16)" opacity="0.9"><circle r="2" fill="none" stroke="#22d3ee" stroke-width="0.6" /><line x1="-3" y1="0" x2="3" y2="0" stroke="#22d3ee" stroke-width="0.5" /><line x1="0" y1="-3" x2="0" y2="3" stroke="#22d3ee" stroke-width="0.5" /></g>
            </g>

            <!-- Wan Chai -->
            <g transform="translate(380, 350)">
              <circle r="3" fill="none" stroke="#22d3ee" stroke-width="0.8" opacity="0.4"><animate attributeName="r" values="2;14" dur="2.5s" repeatCount="indefinite" begin="0.6s" /><animate attributeName="opacity" values="0.5;0" dur="2.5s" repeatCount="indefinite" begin="0.6s" /></circle>
              <circle r="4" fill="url(#dotGrad)" />
              <text y="14" text-anchor="middle" fill="#bae6fd" font-size="7" font-weight="600" style="text-shadow: 0 1px 6px rgba(0,0,0,0.9);">Wan Chai</text>
              <g transform="translate(-10, -14)" opacity="0.85"><path d="M0 4 L4 0 L8 4 V8 H0 Z" fill="none" stroke="#22d3ee" stroke-width="0.7" /><rect x="3" y="5" width="2" height="3" fill="#22d3ee" opacity="0.5" /></g>
              <g transform="translate(4, -16)" opacity="0.9"><circle r="2" fill="none" stroke="#22d3ee" stroke-width="0.6" /><line x1="-3" y1="0" x2="3" y2="0" stroke="#22d3ee" stroke-width="0.5" /><line x1="0" y1="-3" x2="0" y2="3" stroke="#22d3ee" stroke-width="0.5" /></g>
            </g>

            <!-- Central & Western -->
            <g transform="translate(350, 390)">
              <circle r="3" fill="none" stroke="#22d3ee" stroke-width="0.8" opacity="0.4"><animate attributeName="r" values="2;14" dur="2.5s" repeatCount="indefinite" begin="0.9s" /><animate attributeName="opacity" values="0.5;0" dur="2.5s" repeatCount="indefinite" begin="0.9s" /></circle>
              <circle r="4" fill="url(#dotGrad)" />
              <text y="14" text-anchor="middle" fill="#bae6fd" font-size="7" font-weight="600" style="text-shadow: 0 1px 6px rgba(0,0,0,0.9);">Central &amp; Western</text>
              <g transform="translate(-10, -14)" opacity="0.85"><path d="M0 4 L4 0 L8 4 V8 H0 Z" fill="none" stroke="#22d3ee" stroke-width="0.7" /><rect x="3" y="5" width="2" height="3" fill="#22d3ee" opacity="0.5" /></g>
              <g transform="translate(4, -16)" opacity="0.9"><circle r="2" fill="none" stroke="#22d3ee" stroke-width="0.6" /><line x1="-3" y1="0" x2="3" y2="0" stroke="#22d3ee" stroke-width="0.5" /><line x1="0" y1="-3" x2="0" y2="3" stroke="#22d3ee" stroke-width="0.5" /></g>
            </g>

            <!-- Southern -->
            <g transform="translate(330, 430)">
              <circle r="3" fill="none" stroke="#22d3ee" stroke-width="0.8" opacity="0.4"><animate attributeName="r" values="2;14" dur="2.5s" repeatCount="indefinite" begin="1.2s" /><animate attributeName="opacity" values="0.5;0" dur="2.5s" repeatCount="indefinite" begin="1.2s" /></circle>
              <circle r="4" fill="url(#dotGrad)" />
              <text y="14" text-anchor="middle" fill="#bae6fd" font-size="7" font-weight="600" style="text-shadow: 0 1px 6px rgba(0,0,0,0.9);">Southern</text>
              <g transform="translate(-10, -14)" opacity="0.85"><path d="M0 4 L4 0 L8 4 V8 H0 Z" fill="none" stroke="#22d3ee" stroke-width="0.7" /><rect x="3" y="5" width="2" height="3" fill="#22d3ee" opacity="0.5" /></g>
              <g transform="translate(4, -16)" opacity="0.9"><circle r="2" fill="none" stroke="#22d3ee" stroke-width="0.6" /><line x1="-3" y1="0" x2="3" y2="0" stroke="#22d3ee" stroke-width="0.5" /><line x1="0" y1="-3" x2="0" y2="3" stroke="#22d3ee" stroke-width="0.5" /></g>
            </g>

            <!-- Islands -->
            <g transform="translate(140, 410)">
              <circle r="3" fill="none" stroke="#22d3ee" stroke-width="0.8" opacity="0.4"><animate attributeName="r" values="2;14" dur="2.5s" repeatCount="indefinite" begin="0.5s" /><animate attributeName="opacity" values="0.5;0" dur="2.5s" repeatCount="indefinite" begin="0.5s" /></circle>
              <circle r="4" fill="url(#dotGrad)" />
              <text y="14" text-anchor="middle" fill="#bae6fd" font-size="7" font-weight="600" style="text-shadow: 0 1px 6px rgba(0,0,0,0.9);">Islands</text>
              <g transform="translate(-10, -14)" opacity="0.85"><path d="M0 4 L4 0 L8 4 V8 H0 Z" fill="none" stroke="#22d3ee" stroke-width="0.7" /><rect x="3" y="5" width="2" height="3" fill="#22d3ee" opacity="0.5" /></g>
              <g transform="translate(4, -16)" opacity="0.9"><circle r="2" fill="none" stroke="#22d3ee" stroke-width="0.6" /><line x1="-3" y1="0" x2="3" y2="0" stroke="#22d3ee" stroke-width="0.5" /><line x1="0" y1="-3" x2="0" y2="3" stroke="#22d3ee" stroke-width="0.5" /></g>
            </g>

            <!-- ===== 5GNU Logo (bottom-right) ===== -->
            <g transform="translate(780, 520)">
              <text x="0" y="0" text-anchor="end" fill="#22d3ee" font-size="32" font-weight="900" font-family="sans-serif" opacity="0.9" style="text-shadow: 0 0 20px rgba(34,211,238,0.4);">5G</text>
              <text x="42" y="0" text-anchor="end" fill="#0ea5e9" font-size="32" font-weight="900" font-family="sans-serif" opacity="0.9" style="text-shadow: 0 0 20px rgba(14,165,233,0.4);">NU</text>
            </g>
          </svg>
        </div>
      </div>
    </div>

    <!-- 5GNU Watermark -->
    <div class="pointer-events-none absolute bottom-6 right-8 z-10">
      <p class="text-5xl font-black tracking-tighter text-white/[0.04]">5GNU</p>
    </div>
  </div>
{/if}
