<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const containerRef = ref<HTMLElement | null>(null)

const mouse = { x: 0, y: 0 }
const glow = { x: 0, y: 0 }
const tilt = { x: 0, y: 0 }

let rafId = 0

function lerp(start: number, end: number, factor: number) {
  return start + (end - start) * factor
}

function animate() {
  glow.x = lerp(glow.x, mouse.x, 0.08)
  glow.y = lerp(glow.y, mouse.y, 0.08)
  tilt.x = lerp(tilt.x, (mouse.x - 0.5) * 12, 0.06)
  tilt.y = lerp(tilt.y, (mouse.y - 0.5) * -8, 0.06)

  const el = containerRef.value
  if (el) {
    el.style.setProperty('--glow-x', `${glow.x * 100}%`)
    el.style.setProperty('--glow-y', `${glow.y * 100}%`)
    el.style.setProperty('--tilt-x', `${tilt.x}deg`)
    el.style.setProperty('--tilt-y', `${tilt.y}deg`)
    el.style.setProperty('--grid-x', `${(mouse.x - 0.5) * 24}px`)
    el.style.setProperty('--grid-y', `${(mouse.y - 0.5) * 24}px`)
  }

  rafId = requestAnimationFrame(animate)
}

function onMouseMove(e: MouseEvent) {
  const el = containerRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  mouse.x = (e.clientX - rect.left) / rect.width
  mouse.y = (e.clientY - rect.top) / rect.height
}

function onMouseLeave() {
  mouse.x = 0.5
  mouse.y = 0.5
}

onMounted(() => {
  mouse.x = 0.5
  mouse.y = 0.5
  glow.x = 0.5
  glow.y = 0.5
  rafId = requestAnimationFrame(animate)
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
})
</script>

<template>
  <section
    ref="containerRef"
    class="mouse-hero relative flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center overflow-hidden px-4 py-12 sm:px-6 sm:py-16"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <div class="mouse-hero__grid pointer-events-none absolute inset-0" />
    <div class="mouse-hero__glow pointer-events-none absolute inset-0" />
    <div class="mouse-hero__orb pointer-events-none absolute h-64 w-64 rounded-full blur-3xl" />

    <div
      class="mouse-hero__card relative z-10 max-w-xl text-center"
      style="transform: perspective(800px) rotateX(var(--tilt-y)) rotateY(var(--tilt-x))"
    >
      <p class="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-admin-accent">
        Admin Dashboard
      </p>
      <h1 class="text-3xl font-bold tracking-tight text-admin-text sm:text-4xl md:text-5xl">
        Welcome back
      </h1>
      <p class="mt-4 text-sm leading-relaxed text-admin-subtext sm:text-base">
        Move your mouse to explore the interactive surface. Use the sidebar to jump into user
        management, reports, and more.
      </p>
      <div class="mt-8 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
        <button type="button" class="admin-btn-primary px-5 py-2.5" @click="router.push('/admin/users')">
          Manage Users
        </button>
        <button type="button" class="admin-btn-secondary px-5 py-2.5" @click="router.push('/admin/transactions')">
          View Transactions
        </button>
      </div>
    </div>

    <div class="pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-xs text-admin-muted">
      Cursor-reactive UI
    </div>
  </section>
</template>

<style scoped>
.mouse-hero {
  --glow-x: 50%;
  --glow-y: 50%;
  --tilt-x: 0deg;
  --tilt-y: 0deg;
  --grid-x: 0px;
  --grid-y: 0px;
}

.mouse-hero__grid {
  background-image:
    linear-gradient(rgba(124, 92, 252, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(124, 92, 252, 0.07) 1px, transparent 1px);
  background-size: 48px 48px;
  background-position: var(--grid-x) var(--grid-y);
  mask-image: radial-gradient(ellipse 70% 60% at var(--glow-x) var(--glow-y), black 20%, transparent 75%);
}

.mouse-hero__glow {
  background: radial-gradient(
    600px circle at var(--glow-x) var(--glow-y),
    rgba(124, 92, 252, 0.18),
    transparent 45%
  );
}

.mouse-hero__orb {
  left: calc(var(--glow-x) - 8rem);
  top: calc(var(--glow-y) - 8rem);
  background: radial-gradient(circle, rgba(124, 92, 252, 0.35) 0%, transparent 70%);
  transition: left 0.05s linear, top 0.05s linear;
}

.mouse-hero__card {
  transition: transform 0.1s ease-out;
}
</style>
