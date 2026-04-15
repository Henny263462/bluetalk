<script setup lang="ts">
const route = useRoute()
const menuOpen = ref(false)

const navItems = [
  { to: '/', label: 'Overview' },
  { to: '/download', label: 'Download' },
]

const isActive = (to: string) => {
  if (to === '/') {
    return route.path === '/'
  }

  return route.path.startsWith(to)
}

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
  },
)

const toggleMenu = () => {
  menuOpen.value = !menuOpen.value
}
</script>

<template>
  <div class="header-wrap">
    <a class="skip-link" href="#main-content">Skip to main content</a>

    <header class="site-header">
      <div class="container header-inner" :class="{ 'nav-open': menuOpen }">
        <NuxtLink to="/" class="brand-mark" aria-label="BlueTalk home">
          <span class="brand-orb" />
          <span class="brand-word">BlueTalk</span>
        </NuxtLink>

        <button
          type="button"
          class="nav-toggle"
          :aria-expanded="menuOpen"
          aria-controls="site-nav"
          @click="toggleMenu"
        >
          <span class="nav-toggle-bars" aria-hidden="true" />
          <span class="nav-toggle-label">{{ menuOpen ? 'Close menu' : 'Menu' }}</span>
        </button>

        <div id="site-nav" class="header-nav-panel">
          <nav class="main-nav" aria-label="Main navigation">
            <NuxtLink
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              class="nav-link"
              :class="{ 'is-active': isActive(item.to) }"
            >
              {{ item.label }}
            </NuxtLink>
          </nav>

          <a
            class="repo-link"
            href="https://github.com/Henny263462/bluetalk"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </div>
    </header>
  </div>
</template>
