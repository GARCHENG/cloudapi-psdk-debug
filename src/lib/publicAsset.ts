const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:/

const normalizeAssetPath = (assetPath: string) =>
  assetPath.replace(/^\.?\//, '')

const normalizeBaseUrl = (baseUrl: string) =>
  baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`

export const resolvePublicAssetUrl = (assetPath: string) => {
  if (ABSOLUTE_URL_PATTERN.test(assetPath)) {
    return assetPath
  }

  const normalizedPath = normalizeAssetPath(assetPath)
  if (normalizedPath.length === 0) {
    return normalizeBaseUrl(import.meta.env.BASE_URL ?? '/')
  }

  if (window.location.protocol === 'file:') {
    return new URL(normalizedPath, window.location.href).toString()
  }

  const baseUrl = normalizeBaseUrl(import.meta.env.BASE_URL ?? '/')
  return `${baseUrl}${normalizedPath}`
}
