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
  pendingLatestTag: string | null
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

/** Same repo as `server/utils/releases.ts` — external URL so static prerender never crawls /api/releases/download (404 without assets). */
const githubReleasesPage = 'https://github.com/Henny263462/bluetalk/releases'

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
      href: d?.installer?.url ?? githubReleasesPage,
    },
    {
      key: 'portable',
      eyebrow: 'Portable Build',
      title: 'Portable',
      description: 'Single executable for environments where installation should stay optional.',
      meta: portableMeta,
      href: d?.portable?.url ?? githubReleasesPage,
    },
  ]
})

const releaseVersionText = computed(() => {
  const tag = data.value?.tag?.trim()
  return tag || null
})

const pendingLatestTag = computed(() => data.value?.pendingLatestTag?.trim() || null)

const showBuildPendingNotice = computed(
  () => Boolean(!pending.value && pendingLatestTag.value),
)

const buildPendingNoticeText = computed(() => {
  const pend = pendingLatestTag.value
  const offered = releaseVersionText.value
  if (!pend) return ''
  if (offered && offered !== pend) {
    return `GitHub’s current release ${pend} does not list Windows installers yet—the build may still be uploading. The downloads below are from ${offered}, the newest release that already includes Windows installers.`
  }
  return `GitHub’s current release ${pend} does not list Windows installers yet—the build may still be uploading. Check back soon or browse past releases on GitHub.`
})

const showApiWarning = computed(() => Boolean(error.value || data.value?.error))
const apiWarningText = computed(() => {
  if (error.value) {
    return 'Could not load release details (sizes). The download buttons link to GitHub releases until asset metadata is available.'
  }
  if (data.value?.error) {
    return `${data.value.error} The buttons below open GitHub releases; publish a Windows .exe there for one-click downloads.`
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
          <p v-if="pending" class="download-version-indicator" aria-live="polite">
            Download BlueTalk …
          </p>
          <p v-else-if="releaseVersionText" class="download-version-indicator">
            Download BlueTalk {{ releaseVersionText }}
          </p>
          <p v-else class="download-version-indicator download-version-indicator--muted">
            Download BlueTalk
          </p>
          <p>
            Pick the installer for a standard desktop setup or use the portable build
            when you need to keep installation overhead low.
          </p>
          <p v-if="showBuildPendingNotice" class="download-build-pending" role="status">
            {{ buildPendingNoticeText }}
          </p>
          <p class="download-older-versions">
            <a
              :href="githubReleasesPage"
              target="_blank"
              rel="noopener noreferrer"
              class="download-older-versions-link"
            >
              Older releases on GitHub
            </a>
            <span class="download-older-versions-hint"> — browse and download any past version.</span>
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
