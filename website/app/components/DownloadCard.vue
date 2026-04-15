<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
  description: string
  href: string
  meta: string
}>()
</script>

<template>
  <a
    class="download-card"
    :href="href"
    rel="noopener noreferrer"
    :aria-label="`${title}: ${description} (download)`"
  >
    <span class="card-eyebrow">{{ eyebrow }}</span>
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
    <div class="download-card-meta">{{ meta }}</div>
    <span class="download-card-action">Download</span>
  </a>
</template>
