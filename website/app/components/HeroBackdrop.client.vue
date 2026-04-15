<script setup lang="ts">
const canvas = useTemplateRef<HTMLCanvasElement>('canvasRef')
let frame = 0
let resizeHandler: (() => void) | undefined

type NodePoint = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
}

onMounted(() => {
  const element = canvas.value
  if (!element) {
    return
  }

  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  const context = element.getContext('2d')

  if (!context) {
    return
  }

  let width = 0
  let height = 0
  let ratio = 1
  let points: NodePoint[] = []

  const buildPoints = () => Array.from({ length: 16 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.35,
    vy: (Math.random() - 0.5) * 0.35,
    r: Math.random() * 1.4 + 1,
  }))

  const resize = () => {
    ratio = window.devicePixelRatio || 1
    width = element.offsetWidth
    height = element.offsetHeight
    element.width = Math.max(1, Math.floor(width * ratio))
    element.height = Math.max(1, Math.floor(height * ratio))
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    points = buildPoints()
  }

  const draw = () => {
    context.clearRect(0, 0, width, height)

    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const dx = points[i].x - points[j].x
        const dy = points[i].y - points[j].y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance < 180) {
          const alpha = (1 - distance / 180) * 0.18
          context.beginPath()
          context.strokeStyle = `rgba(59, 130, 246, ${alpha})`
          context.lineWidth = 1
          context.moveTo(points[i].x, points[i].y)
          context.lineTo(points[j].x, points[j].y)
          context.stroke()
        }
      }
    }

    points.forEach((point) => {
      context.beginPath()
      context.fillStyle = 'rgba(59, 130, 246, 0.14)'
      context.arc(point.x, point.y, point.r, 0, Math.PI * 2)
      context.fill()
    })
  }

  const tick = () => {
    points.forEach((point) => {
      point.x += point.vx
      point.y += point.vy

      if (point.x < 0 || point.x > width) {
        point.vx *= -1
      }

      if (point.y < 0 || point.y > height) {
        point.vy *= -1
      }
    })

    draw()

    if (!media.matches) {
      frame = window.requestAnimationFrame(tick)
    }
  }

  resize()
  draw()

  if (!media.matches) {
    frame = window.requestAnimationFrame(tick)
  }

  resizeHandler = () => {
    window.cancelAnimationFrame(frame)
    resize()
    draw()

    if (!media.matches) {
      frame = window.requestAnimationFrame(tick)
    }
  }

  window.addEventListener('resize', resizeHandler)
})

onBeforeUnmount(() => {
  window.cancelAnimationFrame(frame)

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
  }
})
</script>

<template>
  <canvas ref="canvasRef" class="hero-backdrop" aria-hidden="true" />
</template>
