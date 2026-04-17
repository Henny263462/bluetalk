const STORAGE_KEY = 'bluetalk-site-color-scheme'

export type SiteColorScheme = 'light' | 'dark'

function applyToDocument(light: boolean) {
  if (!import.meta.client) {
    return
  }

  const root = document.documentElement
  root.dataset.colorScheme = light ? 'light' : 'dark'
  root.style.colorScheme = light ? 'light' : 'dark'

  try {
    localStorage.setItem(STORAGE_KEY, light ? 'light' : 'dark')
  }
  catch {
    // ignore
  }
}

function readFromDom(): boolean {
  if (!import.meta.client) {
    return false
  }

  return document.documentElement.dataset.colorScheme === 'light'
}

export function useColorMode() {
  const isLight = useState('site-color-light', () => false)

  const setLight = (light: boolean) => {
    isLight.value = light
    applyToDocument(light)
  }

  const toggle = () => {
    setLight(!isLight.value)
  }

  const themeColor = computed(() => (isLight.value ? '#fafafa' : '#0a0a0a'))

  if (import.meta.client) {
    onMounted(() => {
      isLight.value = readFromDom()
    })
  }

  return {
    isLight: readonly(isLight),
    setLight,
    toggle,
    themeColor,
  }
}
