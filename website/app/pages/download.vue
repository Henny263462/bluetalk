<script setup lang="ts">
useSeoMeta({
  title: 'Download',
  ogTitle: 'BlueTalk Download',
  description: 'Download the latest BlueTalk installer or portable build.',
  ogDescription: 'Download the latest BlueTalk installer or portable build.',
})

type ReleaseAsset = { url: string; name: string; size: number }

type ReleasePayload = {
  tag: string | null
  installer: ReleaseAsset | null
  portable: ReleaseAsset | null
  error: string | null
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const { data, pending, error } = await useFetch<ReleasePayload>('/api/releases/latest', {
  key: 'bluetalk-latest-release',
})

const runtimeConfig = useRuntimeConfig()

function downloadHref(kind: 'installer' | 'portable') {
  const base = runtimeConfig.app.baseURL
  return `${base}api/releases/download?kind=${kind}`
}

const baseMeta = ['Setup · Windows · .exe', 'No install · Windows · .exe'] as const

const cards = computed(() => {
  const d = data.value
  const installerMeta = d?.installer?.size
    ? `Setup · Windows · .exe · ${formatBytes(d.installer.size)}`
    : baseMeta[0]
  const portableMeta = d?.portable?.size
    ? `No install · Windows · .exe · ${formatBytes(d.portable.size)}`
    : baseMeta[1]

  return [
    {
      key: 'installer',
      eyebrow: 'Windows Setup',
      title: 'Installer',
      description:
        'Standard desktop installation with shortcuts, updates and a familiar Windows install flow.',
      meta: installerMeta,
      href: downloadHref('installer'),
    },
    {
      key: 'portable',
      eyebrow: 'Portable Build',
      title: 'Portable',
      description: 'Single executable for environments where installation should stay optional.',
      meta: portableMeta,
      href: downloadHref('portable'),
    },
  ]
})

const showApiWarning = computed(() => Boolean(error.value || data.value?.error))
const apiWarningText = computed(() => {
  if (error.value) {
    return 'Could not load release details (sizes). Downloads still use the latest Windows build from GitHub.'
  }
  if (data.value?.error) {
    return `${data.value.error} If a download returns 404, publish a Windows build on GitHub first.`
  }
  return ''
})
</script>

<template>
  <div class="download-page">
    <section class="section">
      <div class="container download-hero">
        <div class="section-heading download-heading">
          <span class="section-tag">Get BlueTalk</span>
          <h1>Download Options</h1>
          <p>
            Pick the installer for a standard desktop setup or use the portable build
            when you need to keep installation overhead low.
          </p>
          <p v-if="showApiWarning" class="download-api-hint" role="status">
            {{ apiWarningText }}
          </p>
        </div>

        <div v-if="pending" class="download-placeholder" aria-live="polite">
          Resolving latest release and download links…
        </div>

        <div v-else class="download-grid">
          <DownloadCard
            v-for="item in cards"
            :key="item.key"
            :eyebrow="item.eyebrow"
            :title="item.title"
            :description="item.description"
            :meta="item.meta"
            :href="item.href"
          />
        </div>
      </div>
    </section>
  </div>
</template>
