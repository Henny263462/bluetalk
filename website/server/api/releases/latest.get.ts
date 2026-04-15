type GhAsset = {
  name: string
  browser_download_url: string
  size: number
}

type GhRelease = {
  tag_name: string
  assets: GhAsset[]
}

function pickWindowsAssets(assets: GhAsset[]) {
  const exes = assets.filter((a) => a.name.toLowerCase().endsWith('.exe'))
  if (!exes.length) return { installer: null, portable: null }

  const portable = exes.find((a) => /portable/i.test(a.name)) ?? null

  let installer =
    exes.find((a) => /setup/i.test(a.name) && !/portable/i.test(a.name)) ?? null

  if (!installer && portable) {
    installer = exes.find((a) => a.name !== portable.name) ?? null
  }

  if (!installer && !portable) {
    installer = exes[0] ?? null
  }

  return { installer, portable }
}

export default defineEventHandler(async () => {
  const fallback = {
    tag: null as string | null,
    installer: null as { url: string; name: string; size: number } | null,
    portable: null as { url: string; name: string; size: number } | null,
    error: null as string | null,
  }

  const token = process.env.GITHUB_TOKEN
  try {
    const res = await fetch('https://api.github.com/repos/Henny263462/bluetalk/releases/latest', {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'BlueTalk-Website',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

    if (!res.ok) {
      return {
        ...fallback,
        error: `GitHub returned ${res.status}`,
      }
    }

    const data = (await res.json()) as GhRelease
    const { installer, portable } = pickWindowsAssets(data.assets || [])

    return {
      tag: data.tag_name ?? null,
      installer: installer
        ? { url: installer.browser_download_url, name: installer.name, size: installer.size }
        : null,
      portable: portable
        ? { url: portable.browser_download_url, name: portable.name, size: portable.size }
        : null,
      error: !installer && !portable ? 'No Windows .exe assets on latest release' : null,
    }
  } catch {
    return {
      ...fallback,
      error: 'Could not load release info',
    }
  }
})
