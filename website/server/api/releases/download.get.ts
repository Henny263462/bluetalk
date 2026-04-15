import { resolveLatestWindowsAssets } from '../../utils/releases'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const kind = q.kind === 'portable' ? 'portable' : 'installer'
  const payload = await resolveLatestWindowsAssets()
  const asset = kind === 'portable' ? payload.portable : payload.installer
  if (!asset?.url) {
    throw createError({
      statusCode: 404,
      statusMessage: 'No Windows build available for this variant yet.',
    })
  }
  return sendRedirect(event, asset.url, 302)
})
