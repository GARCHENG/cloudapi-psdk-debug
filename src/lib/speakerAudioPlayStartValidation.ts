const EXPECTED_CHANNELS = 1
const EXPECTED_SAMPLE_RATE = 16000
const EXPECTED_BITS_PER_SAMPLE = 16
const HEADER_PROBE_BYTES = 8192

type ValidationErrorCode =
  | 'URL_REQUIRED'
  | 'INVALID_URL'
  | 'INVALID_PROTOCOL'
  | 'NETWORK_ERROR'
  | 'HTTP_ERROR'
  | 'INVALID_WAV_HEADER'
  | 'UNSUPPORTED_WAV_FORMAT'
  | 'CHANNELS_MISMATCH'
  | 'SAMPLE_RATE_MISMATCH'
  | 'BITS_PER_SAMPLE_MISMATCH'

export type SpeakerAudioPlayStartValidationStatus =
  | 'validating'
  | 'valid'
  | 'invalid'

export interface SpeakerPcmMetadata {
  audioFormat: number
  channels: number
  sampleRate: number
  bitsPerSample: number
  source?: 'wav_header' | 'raw_pcm_assumed'
}

export interface SpeakerAudioPlayStartValidationResult {
  status: SpeakerAudioPlayStartValidationStatus
  valid: boolean
  url: string
  errorCode?: ValidationErrorCode
  message: string
  metadata?: SpeakerPcmMetadata
}

interface ParsedWavMetadata {
  audioFormat: number
  channels: number
  sampleRate: number
  bitsPerSample: number
}

const textDecoder = new TextDecoder('ascii')

const createInvalidResult = (
  url: string,
  errorCode: ValidationErrorCode,
  message: string,
): SpeakerAudioPlayStartValidationResult => ({
  status: 'invalid',
  valid: false,
  url,
  errorCode,
  message,
})

const createValidResult = (
  url: string,
  metadata: SpeakerPcmMetadata,
): SpeakerAudioPlayStartValidationResult => ({
  status: 'valid',
  valid: true,
  url,
  metadata,
  message:
    metadata.source === 'raw_pcm_assumed'
      ? `Raw PCM detected (.pcm). Assuming ${metadata.channels} ch / ${metadata.sampleRate} Hz / ${metadata.bitsPerSample} bit.`
      : `PCM check passed: ${metadata.channels} ch / ${metadata.sampleRate} Hz / ${metadata.bitsPerSample} bit`,
})

export const createValidatingSpeakerAudioValidation = (
  url: string,
): SpeakerAudioPlayStartValidationResult => ({
  status: 'validating',
  valid: false,
  url,
  message: 'Validating URL and PCM metadata...',
})

export const createRequiredSpeakerAudioValidation = (
  url = '',
): SpeakerAudioPlayStartValidationResult =>
  createInvalidResult(url, 'URL_REQUIRED', 'File URL (PCM) is required.')

const readFourCC = (bytes: Uint8Array, start: number) =>
  textDecoder.decode(bytes.subarray(start, start + 4))

const parseWavMetadata = (buffer: ArrayBuffer): ParsedWavMetadata | null => {
  const bytes = new Uint8Array(buffer)
  if (bytes.byteLength < 44) {
    return null
  }

  const view = new DataView(buffer)
  const riff = readFourCC(bytes, 0)
  const wave = readFourCC(bytes, 8)
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    return null
  }

  let offset = 12
  while (offset + 8 <= bytes.byteLength) {
    const chunkId = readFourCC(bytes, offset)
    const chunkSize = view.getUint32(offset + 4, true)
    const chunkDataOffset = offset + 8
    const chunkDataEnd = chunkDataOffset + chunkSize
    if (chunkDataEnd > bytes.byteLength) {
      return null
    }

    if (chunkId === 'fmt ') {
      if (chunkSize < 16 || chunkDataOffset + 16 > bytes.byteLength) {
        return null
      }

      return {
        audioFormat: view.getUint16(chunkDataOffset, true),
        channels: view.getUint16(chunkDataOffset + 2, true),
        sampleRate: view.getUint32(chunkDataOffset + 4, true),
        bitsPerSample: view.getUint16(chunkDataOffset + 14, true),
      }
    }

    offset = chunkDataEnd + (chunkSize % 2)
  }

  return null
}

const parseContentLengthFromResponse = (response: Response) => {
  const contentRange = response.headers.get('content-range')
  if (contentRange) {
    const match = contentRange.match(/\/(\d+)\s*$/)
    if (match) {
      const parsed = Number(match[1])
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed
      }
    }
  }

  const contentLength = response.headers.get('content-length')
  if (contentLength) {
    const parsed = Number(contentLength)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return null
}

const looksLikeRawPcmUrl = (url: string) => {
  try {
    const parsed = new URL(url)
    return parsed.pathname.toLowerCase().endsWith('.pcm')
  } catch {
    return false
  }
}

export const validateSpeakerAudioPlayStartUrl = (
  rawUrl: string,
): SpeakerAudioPlayStartValidationResult => {
  const url = rawUrl.trim()
  if (!url) {
    return createRequiredSpeakerAudioValidation(url)
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return createInvalidResult(
      url,
      'INVALID_URL',
      'File URL is invalid. Please provide a full HTTP(S) URL.',
    )
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return createInvalidResult(
      url,
      'INVALID_PROTOCOL',
      'File URL must use http:// or https://.',
    )
  }

  return {
    status: 'valid',
    valid: true,
    url,
    message: 'URL protocol check passed.',
  }
}

export const validateSpeakerAudioPlayStartPcmUrl = async (
  rawUrl: string,
): Promise<SpeakerAudioPlayStartValidationResult> => {
  const urlValidation = validateSpeakerAudioPlayStartUrl(rawUrl)
  if (!urlValidation.valid) {
    return urlValidation
  }

  const url = urlValidation.url
  try {
    const response = await fetch(url, {
      headers: {
        Range: `bytes=0-${HEADER_PROBE_BYTES - 1}`,
      },
    })

    if (!response.ok) {
      return createInvalidResult(
        url,
        'HTTP_ERROR',
        `Unable to read audio metadata (HTTP ${response.status}).`,
      )
    }

    const buffer = await response.arrayBuffer()
    const metadata = parseWavMetadata(buffer)
    if (!metadata) {
      const totalBytes = parseContentLengthFromResponse(response)
      const isRawPcmCandidate = looksLikeRawPcmUrl(url)

      if (isRawPcmCandidate) {
        if (totalBytes !== null && totalBytes % 2 !== 0) {
          return createInvalidResult(
            url,
            'BITS_PER_SAMPLE_MISMATCH',
            `Raw PCM size is not 16-bit aligned (bytes=${totalBytes}).`,
          )
        }

        return createValidResult(url, {
          audioFormat: 1,
          channels: EXPECTED_CHANNELS,
          sampleRate: EXPECTED_SAMPLE_RATE,
          bitsPerSample: EXPECTED_BITS_PER_SAMPLE,
          source: 'raw_pcm_assumed',
        })
      }

      return createInvalidResult(
        url,
        'INVALID_WAV_HEADER',
        'Unable to parse WAV PCM metadata from this URL. For raw PCM, use a .pcm URL.',
      )
    }

    if (metadata.audioFormat !== 1) {
      return createInvalidResult(
        url,
        'UNSUPPORTED_WAV_FORMAT',
        `Unsupported WAV format (${metadata.audioFormat}). PCM (format=1) is required.`,
      )
    }

    if (metadata.channels !== EXPECTED_CHANNELS) {
      return createInvalidResult(
        url,
        'CHANNELS_MISMATCH',
        `Invalid channels: expected ${EXPECTED_CHANNELS}, got ${metadata.channels}.`,
      )
    }

    if (metadata.sampleRate !== EXPECTED_SAMPLE_RATE) {
      return createInvalidResult(
        url,
        'SAMPLE_RATE_MISMATCH',
        `Invalid sample rate: expected ${EXPECTED_SAMPLE_RATE}, got ${metadata.sampleRate}.`,
      )
    }

    if (metadata.bitsPerSample !== EXPECTED_BITS_PER_SAMPLE) {
      return createInvalidResult(
        url,
        'BITS_PER_SAMPLE_MISMATCH',
        `Invalid bit depth: expected ${EXPECTED_BITS_PER_SAMPLE}, got ${metadata.bitsPerSample}.`,
      )
    }

    return createValidResult(url, {
      ...metadata,
      source: 'wav_header',
    })
  } catch {
    return createInvalidResult(
      url,
      'NETWORK_ERROR',
      'Unable to access URL metadata. Check network access/CORS and try another URL.',
    )
  }
}
