<script lang="ts">
  import { t } from '$lib/utils/functions/translations';

  type MetricDirection = 'lower' | 'higher';
  type EventLevel = 'normal' | 'notice' | 'penalty';

  interface FlightMetric {
    labelKey: string;
    value: number;
    unit: string;
    target: number;
    direction: MetricDirection;
    weight: number;
    noteKey: string;
  }

  interface FlightScenario {
    id: string;
    titleKey: string;
    subtitleKey: string;
    aircraftKey: string;
    duration: string;
    weatherKey: string;
    riskKey: string;
    summaryKey: string;
    metrics: FlightMetric[];
    events: Array<{ time: string; labelKey: string; level: EventLevel }>;
    path: Array<{ x: number; y: number; deviation: number }>;
  }

  const scenarios: FlightScenario[] = [
    {
      id: 'figure_eight',
      titleKey: 'simulator.scenarios.figure_eight.title',
      subtitleKey: 'simulator.scenarios.figure_eight.subtitle',
      aircraftKey: 'simulator.scenarios.figure_eight.aircraft',
      duration: '04:32',
      weatherKey: 'simulator.weather.light_breeze_2_1',
      riskKey: 'simulator.risk.medium',
      summaryKey: 'simulator.scenarios.figure_eight.summary',
      metrics: [
        {
          labelKey: 'simulator.metrics.avg_lateral_deviation',
          value: 0.42,
          unit: 'm',
          target: 0.8,
          direction: 'lower',
          weight: 28,
          noteKey: 'simulator.notes.figure_eight_centerline'
        },
        {
          labelKey: 'simulator.metrics.max_altitude_deviation',
          value: 0.58,
          unit: 'm',
          target: 1.0,
          direction: 'lower',
          weight: 20,
          noteKey: 'simulator.notes.target_altitude_12m'
        },
        {
          labelKey: 'simulator.metrics.heading_error',
          value: 5.2,
          unit: '°',
          target: 10,
          direction: 'lower',
          weight: 18,
          noteKey: 'simulator.notes.turn_exit_heading'
        },
        {
          labelKey: 'simulator.metrics.path_smoothness',
          value: 86,
          unit: '%',
          target: 90,
          direction: 'higher',
          weight: 18,
          noteKey: 'simulator.notes.stick_input_smoothness'
        },
        {
          labelKey: 'simulator.metrics.task_completion',
          value: 100,
          unit: '%',
          target: 100,
          direction: 'higher',
          weight: 16,
          noteKey: 'simulator.notes.complete_all_segments'
        }
      ],
      events: [
        { time: '00:38', labelKey: 'simulator.events.figure_eight.left_loop', level: 'normal' },
        { time: '01:54', labelKey: 'simulator.events.figure_eight.right_loop_wide', level: 'penalty' },
        { time: '03:10', labelKey: 'simulator.events.figure_eight.altitude_rise', level: 'notice' }
      ],
      path: [
        { x: 10, y: 50, deviation: 0.2 },
        { x: 22, y: 26, deviation: 0.3 },
        { x: 38, y: 28, deviation: 0.4 },
        { x: 50, y: 50, deviation: 0.2 },
        { x: 62, y: 72, deviation: 0.5 },
        { x: 80, y: 74, deviation: 0.9 },
        { x: 92, y: 50, deviation: 0.4 }
      ]
    },
    {
      id: 'hover',
      titleKey: 'simulator.scenarios.hover.title',
      subtitleKey: 'simulator.scenarios.hover.subtitle',
      aircraftKey: 'simulator.scenarios.hover.aircraft',
      duration: '03:00',
      weatherKey: 'simulator.weather.gust_3_4',
      riskKey: 'simulator.risk.low',
      summaryKey: 'simulator.scenarios.hover.summary',
      metrics: [
        {
          labelKey: 'simulator.metrics.horizontal_drift_radius',
          value: 0.36,
          unit: 'm',
          target: 0.6,
          direction: 'lower',
          weight: 30,
          noteKey: 'simulator.notes.target_point_radius'
        },
        {
          labelKey: 'simulator.metrics.altitude_fluctuation',
          value: 0.24,
          unit: 'm',
          target: 0.5,
          direction: 'lower',
          weight: 24,
          noteKey: 'simulator.notes.target_altitude_8m'
        },
        {
          labelKey: 'simulator.metrics.nose_direction_error',
          value: 3.1,
          unit: '°',
          target: 8,
          direction: 'lower',
          weight: 16,
          noteKey: 'simulator.notes.nose_north'
        },
        {
          labelKey: 'simulator.metrics.wind_correction_rate',
          value: 92,
          unit: '%',
          target: 90,
          direction: 'higher',
          weight: 18,
          noteKey: 'simulator.notes.wind_recovery_speed'
        },
        {
          labelKey: 'simulator.metrics.safety_boundary',
          value: 100,
          unit: '%',
          target: 100,
          direction: 'higher',
          weight: 12,
          noteKey: 'simulator.notes.no_boundary_alarm'
        }
      ],
      events: [
        { time: '00:22', labelKey: 'simulator.events.hover.enter_point', level: 'normal' },
        { time: '01:27', labelKey: 'simulator.events.hover.gust_sink', level: 'notice' },
        { time: '02:45', labelKey: 'simulator.events.hover.recovered', level: 'normal' }
      ],
      path: [
        { x: 48, y: 48, deviation: 0.1 },
        { x: 51, y: 45, deviation: 0.2 },
        { x: 54, y: 49, deviation: 0.3 },
        { x: 50, y: 53, deviation: 0.2 },
        { x: 46, y: 51, deviation: 0.2 },
        { x: 49, y: 47, deviation: 0.1 }
      ]
    },
    {
      id: 'route',
      titleKey: 'simulator.scenarios.route.title',
      subtitleKey: 'simulator.scenarios.route.subtitle',
      aircraftKey: 'simulator.scenarios.route.aircraft',
      duration: '05:18',
      weatherKey: 'simulator.weather.sunny_1_6',
      riskKey: 'simulator.risk.low',
      summaryKey: 'simulator.scenarios.route.summary',
      metrics: [
        {
          labelKey: 'simulator.metrics.waypoint_error',
          value: 0.51,
          unit: 'm',
          target: 1.0,
          direction: 'lower',
          weight: 26,
          noteKey: 'simulator.notes.four_waypoints_avg'
        },
        {
          labelKey: 'simulator.metrics.straight_heading_drift',
          value: 4.4,
          unit: '°',
          target: 8,
          direction: 'lower',
          weight: 22,
          noteKey: 'simulator.notes.route_angle_error'
        },
        {
          labelKey: 'simulator.metrics.turn_radius_error',
          value: 0.66,
          unit: 'm',
          target: 1.2,
          direction: 'lower',
          weight: 18,
          noteKey: 'simulator.notes.corner_overshoot'
        },
        {
          labelKey: 'simulator.metrics.speed_stability',
          value: 88,
          unit: '%',
          target: 90,
          direction: 'higher',
          weight: 18,
          noteKey: 'simulator.notes.target_speed_3ms'
        },
        {
          labelKey: 'simulator.metrics.task_completion',
          value: 100,
          unit: '%',
          target: 100,
          direction: 'higher',
          weight: 16,
          noteKey: 'simulator.notes.complete_all_waypoints'
        }
      ],
      events: [
        { time: '01:06', labelKey: 'simulator.events.route.waypoint_a', level: 'normal' },
        { time: '02:49', labelKey: 'simulator.events.route.third_leg_correction', level: 'notice' },
        { time: '04:52', labelKey: 'simulator.events.route.speed_stable', level: 'normal' }
      ],
      path: [
        { x: 16, y: 72, deviation: 0.3 },
        { x: 16, y: 24, deviation: 0.4 },
        { x: 82, y: 24, deviation: 0.5 },
        { x: 84, y: 72, deviation: 0.7 },
        { x: 16, y: 72, deviation: 0.3 }
      ]
    },
    {
      id: 'landing',
      titleKey: 'simulator.scenarios.landing.title',
      subtitleKey: 'simulator.scenarios.landing.subtitle',
      aircraftKey: 'simulator.scenarios.landing.aircraft',
      duration: '02:46',
      weatherKey: 'simulator.weather.light_breeze_1_2',
      riskKey: 'simulator.risk.medium',
      summaryKey: 'simulator.scenarios.landing.summary',
      metrics: [
        {
          labelKey: 'simulator.metrics.return_path_deviation',
          value: 0.48,
          unit: 'm',
          target: 0.9,
          direction: 'lower',
          weight: 22,
          noteKey: 'simulator.notes.return_line_offset'
        },
        {
          labelKey: 'simulator.metrics.descent_rate_peak',
          value: 1.15,
          unit: 'm/s',
          target: 1.0,
          direction: 'lower',
          weight: 24,
          noteKey: 'simulator.notes.final_descent_speed'
        },
        {
          labelKey: 'simulator.metrics.landing_point_error',
          value: 0.72,
          unit: 'm',
          target: 1.0,
          direction: 'lower',
          weight: 26,
          noteKey: 'simulator.notes.distance_to_landing_center'
        },
        {
          labelKey: 'simulator.metrics.attitude_stability',
          value: 84,
          unit: '%',
          target: 90,
          direction: 'higher',
          weight: 16,
          noteKey: 'simulator.notes.pitch_roll_changes'
        },
        {
          labelKey: 'simulator.metrics.safety_action_completion',
          value: 100,
          unit: '%',
          target: 100,
          direction: 'higher',
          weight: 12,
          noteKey: 'simulator.notes.return_slow_lock'
        }
      ],
      events: [
        { time: '00:40', labelKey: 'simulator.events.landing.return_path', level: 'normal' },
        { time: '02:18', labelKey: 'simulator.events.landing.descent_peak', level: 'penalty' },
        { time: '02:44', labelKey: 'simulator.events.landing.touchdown_error', level: 'notice' }
      ],
      path: [
        { x: 12, y: 18, deviation: 0.3 },
        { x: 26, y: 30, deviation: 0.4 },
        { x: 42, y: 42, deviation: 0.4 },
        { x: 58, y: 56, deviation: 0.5 },
        { x: 74, y: 68, deviation: 0.7 },
        { x: 86, y: 78, deviation: 0.7 }
      ]
    }
  ];

  let activeId = scenarios[0].id;

  $: activeScenario = scenarios.find((scenario) => scenario.id === activeId) || scenarios[0];
  $: metricScores = activeScenario.metrics.map((metric) => ({
    ...metric,
    score: scoreMetric(metric)
  }));
  $: totalScore = Math.round(
    metricScores.reduce((sum, metric) => sum + metric.score * metric.weight, 0) /
      metricScores.reduce((sum, metric) => sum + metric.weight, 0)
  );
  $: rating = getRating(totalScore);
  $: penaltyMetrics = metricScores.filter((metric) => metric.score < 82);

  function clamp(value: number, min = 0, max = 100) {
    return Math.min(max, Math.max(min, value));
  }

  function scoreMetric(metric: FlightMetric) {
    if (metric.direction === 'lower') {
      const ratio = metric.value / metric.target;
      return Math.round(clamp(100 - ratio * 35));
    }

    const ratio = metric.value / metric.target;
    return Math.round(clamp(ratio * 100));
  }

  function getRating(score: number) {
    if (score >= 92) return { labelKey: 'simulator.rating.excellent', className: 'bg-emerald-100 text-emerald-800' };
    if (score >= 84) return { labelKey: 'simulator.rating.good', className: 'bg-blue-100 text-blue-800' };
    if (score >= 75) return { labelKey: 'simulator.rating.practice', className: 'bg-amber-100 text-amber-800' };
    return { labelKey: 'simulator.rating.high_risk', className: 'bg-red-100 text-red-800' };
  }

  function eventClass(level: EventLevel) {
    if (level === 'normal') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (level === 'notice') return 'bg-amber-50 text-amber-700 border-amber-100';
    return 'bg-red-50 text-red-700 border-red-100';
  }

  function eventLevelKey(level: EventLevel) {
    return `simulator.event_level.${level}`;
  }

  function pathPoints(path: FlightScenario['path']) {
    return path.map((point) => `${point.x},${point.y}`).join(' ');
  }
</script>

<svelte:head>
  <title>{$t('simulator.title')}</title>
</svelte:head>

<section class="mx-auto max-w-7xl px-5 py-6">
  <div class="mb-6 flex flex-col justify-between gap-4 border-b border-gray-200 pb-5 dark:border-neutral-800 md:flex-row md:items-end">
    <div>
      <p class="text-sm font-semibold text-primary-700 dark:text-primary-300">{$t('simulator.eyebrow')}</p>
      <h1 class="mt-2 text-2xl font-bold text-[#040F2D] dark:text-white md:text-3xl">{$t('simulator.title')}</h1>
      <p class="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-neutral-300">
        {$t('simulator.description')}
      </p>
    </div>
    <div class="grid grid-cols-3 gap-3 text-center">
      <div class="rounded-md border border-gray-200 px-4 py-3 dark:border-neutral-800">
        <p class="text-xs text-gray-500 dark:text-neutral-400">{$t('simulator.stats.subjects')}</p>
        <p class="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{scenarios.length}</p>
      </div>
      <div class="rounded-md border border-gray-200 px-4 py-3 dark:border-neutral-800">
        <p class="text-xs text-gray-500 dark:text-neutral-400">{$t('simulator.stats.current_score')}</p>
        <p class="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{totalScore}</p>
      </div>
      <div class="rounded-md border border-gray-200 px-4 py-3 dark:border-neutral-800">
        <p class="text-xs text-gray-500 dark:text-neutral-400">{$t('simulator.stats.penalty_items')}</p>
        <p class="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{penaltyMetrics.length}</p>
      </div>
    </div>
  </div>

  <div class="mb-5 flex gap-2 overflow-x-auto pb-1">
    {#each scenarios as scenario}
      <button
        type="button"
        class="shrink-0 rounded-md border px-4 py-3 text-left transition {activeId === scenario.id
          ? 'border-primary-700 bg-primary-900 text-white'
          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800'}"
        on:click={() => (activeId = scenario.id)}
      >
        <span class="block text-sm font-semibold">{$t(scenario.titleKey)}</span>
        <span class="mt-1 block text-xs opacity-80">{$t(scenario.aircraftKey)} · {scenario.duration}</span>
      </button>
    {/each}
  </div>

  <div class="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
    <div class="space-y-5">
      <section class="rounded-md border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div class="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{$t(activeScenario.titleKey)}</h2>
              <span class="rounded-md px-2.5 py-1 text-xs font-semibold {rating.className}">{$t(rating.labelKey)}</span>
            </div>
            <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-neutral-300">{$t(activeScenario.subtitleKey)}</p>
            <p class="mt-3 text-sm leading-6 text-gray-700 dark:text-neutral-200">{$t(activeScenario.summaryKey)}</p>
          </div>
          <div class="grid min-w-[220px] grid-cols-2 gap-2 text-sm">
            <div class="rounded border border-gray-200 p-3 dark:border-neutral-800">
              <p class="text-xs text-gray-500">{$t('simulator.labels.aircraft')}</p>
              <p class="mt-1 font-medium text-gray-900 dark:text-white">{$t(activeScenario.aircraftKey)}</p>
            </div>
            <div class="rounded border border-gray-200 p-3 dark:border-neutral-800">
              <p class="text-xs text-gray-500">{$t('simulator.labels.risk')}</p>
              <p class="mt-1 font-medium text-gray-900 dark:text-white">{$t(activeScenario.riskKey)}</p>
            </div>
            <div class="rounded border border-gray-200 p-3 dark:border-neutral-800">
              <p class="text-xs text-gray-500">{$t('simulator.labels.duration')}</p>
              <p class="mt-1 font-medium text-gray-900 dark:text-white">{activeScenario.duration}</p>
            </div>
            <div class="rounded border border-gray-200 p-3 dark:border-neutral-800">
              <p class="text-xs text-gray-500">{$t('simulator.labels.weather')}</p>
              <p class="mt-1 font-medium text-gray-900 dark:text-white">{$t(activeScenario.weatherKey)}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-md border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">{$t('simulator.scoring.title')}</h3>
          <span class="text-sm text-gray-500 dark:text-neutral-400">{$t('simulator.scoring.weighted')}</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[760px] text-left text-sm">
            <thead class="border-b border-gray-200 text-xs text-gray-500 dark:border-neutral-800 dark:text-neutral-400">
              <tr>
                <th class="py-3 pr-4 font-medium">{$t('simulator.table.metric')}</th>
                <th class="py-3 pr-4 font-medium">{$t('simulator.table.actual')}</th>
                <th class="py-3 pr-4 font-medium">{$t('simulator.table.target')}</th>
                <th class="py-3 pr-4 font-medium">{$t('simulator.table.weight')}</th>
                <th class="py-3 pr-4 font-medium">{$t('simulator.table.score')}</th>
                <th class="py-3 font-medium">{$t('simulator.table.note')}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-neutral-800">
              {#each metricScores as metric}
                <tr>
                  <td class="py-3 pr-4 font-medium text-gray-900 dark:text-white">{$t(metric.labelKey)}</td>
                  <td class="py-3 pr-4 text-gray-700 dark:text-neutral-300">{metric.value}{metric.unit}</td>
                  <td class="py-3 pr-4 text-gray-700 dark:text-neutral-300">
                    {metric.direction === 'lower' ? '≤' : '≥'} {metric.target}{metric.unit}
                  </td>
                  <td class="py-3 pr-4 text-gray-700 dark:text-neutral-300">{metric.weight}%</td>
                  <td class="py-3 pr-4">
                    <div class="flex items-center gap-3">
                      <div class="h-2 w-24 rounded bg-gray-100 dark:bg-neutral-800">
                        <div
                          class="h-2 rounded bg-primary-700"
                          style={`width: ${metric.score}%`}
                        />
                      </div>
                      <span class="font-semibold text-gray-900 dark:text-white">{metric.score}</span>
                    </div>
                  </td>
                  <td class="py-3 text-gray-600 dark:text-neutral-300">{$t(metric.noteKey)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <div class="space-y-5">
      <section class="rounded-md border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">{$t('simulator.path.title')}</h3>
          <span class="text-xs text-gray-500 dark:text-neutral-400">{$t('simulator.path.hint')}</span>
        </div>
        <div class="aspect-[4/3] rounded border border-gray-200 bg-gray-50 p-4 dark:border-neutral-800 dark:bg-black">
          <svg viewBox="0 0 100 100" class="h-full w-full">
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#d1d5db" stroke-width="0.4" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#grid)" opacity="0.65" />
            <polyline points={pathPoints(activeScenario.path)} fill="none" stroke="#0E7372" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" />
            {#each activeScenario.path as point, index}
              <circle
                cx={point.x}
                cy={point.y}
                r={2.6 + point.deviation * 2}
                fill={point.deviation > 0.65 ? '#dc2626' : point.deviation > 0.4 ? '#d97706' : '#059669'}
                opacity="0.85"
              />
              <text x={point.x + 3} y={point.y - 3} font-size="4" fill="#374151">P{index + 1}</text>
            {/each}
          </svg>
        </div>
      </section>

      <section class="rounded-md border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{$t('simulator.penalty.title')}</h3>
        {#if penaltyMetrics.length === 0}
          <p class="mt-3 rounded border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700">{$t('simulator.penalty.none')}</p>
        {:else}
          <div class="mt-3 space-y-3">
            {#each penaltyMetrics as metric}
              <div class="rounded border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
                <p class="font-semibold">{$t(metric.labelKey)}：{metric.score} {$t('simulator.table.score_unit')}</p>
                <p class="mt-1">{$t(metric.noteKey)}，{$t('simulator.penalty.recommend')}</p>
              </div>
            {/each}
          </div>
        {/if}
      </section>

      <section class="rounded-md border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{$t('simulator.events_title')}</h3>
        <div class="mt-3 space-y-3">
          {#each activeScenario.events as event}
            <div class="rounded border px-3 py-2 text-sm {eventClass(event.level)}">
              <div class="flex items-center justify-between gap-3">
                <span class="font-semibold">{event.time}</span>
                <span>{$t(eventLevelKey(event.level))}</span>
              </div>
              <p class="mt-1">{$t(event.labelKey)}</p>
            </div>
          {/each}
        </div>
      </section>
    </div>
  </div>
</section>
