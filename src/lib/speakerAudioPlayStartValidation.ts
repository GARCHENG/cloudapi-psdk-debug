const EXPECTED_CHANNELS = 1
const EXPECTED_SAMPLE_RATE = 16000
const EXPECTED_BITS_PER_SAMPLE = 16
const HEADER_PROBE_BYTES = 8192
const MD5_BLOCK_SIZE = 64

const MD5_ROUND_SHIFTS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4,
  11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6,
  10, 15, 21,
] as const

const MD5_K = Array.from({ length: 64 }, (_, index) =>
  Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000) >>> 0,
)

type ValidationErrorCode =
  | 'VALIDATION_REQUIRED'
  | 'REVALIDATION_REQUIRED'
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
  | 'MD5_REQUIRED'
  | 'MD5_MISMATCH'
  | 'MD5_CALCULATION_FAILED'

export type SpeakerAudioPlayStartValidationStatus =
  | 'validating'
  | 'valid'
  | 'invalid'

export interface SpeakerAudioPlayStartValidationSnapshot {
  url: string
  md5: string
}

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
  md5?: string
  calculatedMd5?: string
  snapshot?: SpeakerAudioPlayStartValidationSnapshot
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

const leftRotate32 = (value: number, bits: number) =>
  ((value << bits) | (value >>> (32 - bits))) >>> 0

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

const normalizeSpeakerAudioMd5 = (rawMd5: string) => rawMd5.trim().toLowerCase()

const createInvalidResult = (
  url: string,
  errorCode: ValidationErrorCode,
  message: string,
  overrides: Partial<SpeakerAudioPlayStartValidationResult> = {},
): SpeakerAudioPlayStartValidationResult => ({
  status: 'invalid',
  valid: false,
  url,
  errorCode,
  message,
  ...overrides,
})

const createSnapshot = (
  url: string,
  md5: string,
): SpeakerAudioPlayStartValidationSnapshot => ({
  url,
  md5: normalizeSpeakerAudioMd5(md5),
})

const createValidResult = (
  url: string,
  metadata: SpeakerPcmMetadata,
  options: {
    md5?: string
    calculatedMd5?: string
  } = {},
): SpeakerAudioPlayStartValidationResult => ({
  status: 'valid',
  valid: true,
  url,
  md5: options.md5,
  calculatedMd5: options.calculatedMd5,
  snapshot: options.md5 ? createSnapshot(url, options.md5) : undefined,
  metadata,
  message:
    options.calculatedMd5 && options.md5
      ? `Validation passed: PCM ${metadata.channels} ch / ${metadata.sampleRate} Hz / ${metadata.bitsPerSample} bit, MD5 matched (${options.calculatedMd5}).`
      : metadata.source === 'raw_pcm_assumed'
        ? `Raw PCM detected (.pcm). Assuming ${metadata.channels} ch / ${metadata.sampleRate} Hz / ${metadata.bitsPerSample} bit.`
        : `PCM check passed: ${metadata.channels} ch / ${metadata.sampleRate} Hz / ${metadata.bitsPerSample} bit`,
})

export const createValidatingSpeakerAudioValidation = (
  url: string,
  md5 = '',
): SpeakerAudioPlayStartValidationResult => ({
  status: 'validating',
  valid: false,
  url,
  md5: normalizeSpeakerAudioMd5(md5),
  message: md5
    ? 'Validating URL, PCM metadata, and MD5...'
    : 'Validating URL and PCM metadata...',
})

export const createRevalidationRequiredSpeakerAudioValidation = (
  url = '',
  md5 = '',
): SpeakerAudioPlayStartValidationResult => ({
  status: 'invalid',
  valid: false,
  url,
  md5: normalizeSpeakerAudioMd5(md5),
  errorCode: 'REVALIDATION_REQUIRED',
  message: 'Audio URL or MD5 changed. Please click Validate Audio again.',
})

export const createRequiredSpeakerAudioValidation = (
  url = '',
): SpeakerAudioPlayStartValidationResult =>
  createInvalidResult(url, 'URL_REQUIRED', 'File URL (PCM) is required.')

export const createMd5RequiredSpeakerAudioValidation = (
  url = '',
): SpeakerAudioPlayStartValidationResult =>
  createInvalidResult(url, 'MD5_REQUIRED', 'File MD5 is required.')

class Md5Hasher {
  private state = new Uint32Array([
    0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476,
  ])

  private readonly block = new Uint8Array(MD5_BLOCK_SIZE)
  private blockLength = 0
  private bytesHashed = 0

  update(chunk: Uint8Array) {
    if (chunk.byteLength === 0) {
      return this
    }

    this.bytesHashed += chunk.byteLength
    let offset = 0

    if (this.blockLength > 0) {
      const space = MD5_BLOCK_SIZE - this.blockLength
      const count = Math.min(space, chunk.byteLength)
      this.block.set(chunk.subarray(0, count), this.blockLength)
      this.blockLength += count
      offset += count

      if (this.blockLength === MD5_BLOCK_SIZE) {
        this.processBlock(this.block, 0)
        this.blockLength = 0
      }
    }

    while (offset + MD5_BLOCK_SIZE <= chunk.byteLength) {
      this.processBlock(chunk, offset)
      offset += MD5_BLOCK_SIZE
    }

    if (offset < chunk.byteLength) {
      this.block.set(chunk.subarray(offset), 0)
      this.blockLength = chunk.byteLength - offset
    }

    return this
  }

  digest() {
    const bitLengthLow = (this.bytesHashed << 3) >>> 0
    const bitLengthHigh = Math.floor(this.bytesHashed / 0x20000000) >>> 0

    this.block[this.blockLength] = 0x80
    this.blockLength += 1

    if (this.blockLength > 56) {
      this.block.fill(0, this.blockLength, MD5_BLOCK_SIZE)
      this.processBlock(this.block, 0)
      this.blockLength = 0
    }

    this.block.fill(0, this.blockLength, 56)
    this.writeUint32Le(56, bitLengthLow)
    this.writeUint32Le(60, bitLengthHigh)
    this.processBlock(this.block, 0)
    this.blockLength = 0

    const digest = new Uint8Array(16)
    for (let index = 0; index < 4; index += 1) {
      const word = this.state[index]
      digest[index * 4] = word & 0xff
      digest[index * 4 + 1] = (word >>> 8) & 0xff
      digest[index * 4 + 2] = (word >>> 16) & 0xff
      digest[index * 4 + 3] = (word >>> 24) & 0xff
    }

    return bytesToHex(digest)
  }

  private processBlock(source: Uint8Array, offset: number) {
    const words = new Uint32Array(16)
    for (let index = 0; index < 16; index += 1) {
      const base = offset + index * 4
      words[index] =
        (source[base] |
          (source[base + 1] << 8) |
          (source[base + 2] << 16) |
          (source[base + 3] << 24)) >>>
        0
    }

    let a = this.state[0]
    let b = this.state[1]
    let c = this.state[2]
    let d = this.state[3]

    for (let index = 0; index < 64; index += 1) {
      let f = 0
      let g = 0

      if (index < 16) {
        f = (b & c) | (~b & d)
        g = index
      } else if (index < 32) {
        f = (d & b) | (~d & c)
        g = (index * 5 + 1) % 16
      } else if (index < 48) {
        f = b ^ c ^ d
        g = (index * 3 + 5) % 16
      } else {
        f = c ^ (b | ~d)
        g = (index * 7) % 16
      }

      const sum = (a + f + MD5_K[index] + words[g]) >>> 0
      const rotated = leftRotate32(sum, MD5_ROUND_SHIFTS[index])

      a = d
      d = c
      c = b
      b = (b + rotated) >>> 0
    }

    this.state[0] = (this.state[0] + a) >>> 0
    this.state[1] = (this.state[1] + b) >>> 0
    this.state[2] = (this.state[2] + c) >>> 0
    this.state[3] = (this.state[3] + d) >>> 0
  }

  private writeUint32Le(offset: number, value: number) {
    this.block[offset] = value & 0xff
    this.block[offset + 1] = (value >>> 8) & 0xff
    this.block[offset + 2] = (value >>> 16) & 0xff
    this.block[offset + 3] = (value >>> 24) & 0xff
  }
}

const calculateRemoteFileMd5 = async (url: string) => {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return {
        ok: false as const,
        message: `Unable to download audio for MD5 validation (HTTP ${response.status}).`,
      }
    }

    const hasher = new Md5Hasher()

    if (!response.body) {
      const buffer = await response.arrayBuffer()
      hasher.update(new Uint8Array(buffer))
      return { ok: true as const, md5: hasher.digest() }
    }

    const reader = response.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      if (value) {
        hasher.update(value)
      }
    }

    return { ok: true as const, md5: hasher.digest() }
  } catch {
    return {
      ok: false as const,
      message:
        'Unable to read remote audio content for MD5 validation. Check network access/CORS and try another URL.',
    }
  }
}

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
    url: parsed.toString(),
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

export const validateSpeakerAudioPlayStartManual = async (
  rawUrl: string,
  rawMd5: string,
): Promise<SpeakerAudioPlayStartValidationResult> => {
  const normalizedMd5 = normalizeSpeakerAudioMd5(rawMd5)
  const urlValidation = validateSpeakerAudioPlayStartUrl(rawUrl)
  if (!urlValidation.valid) {
    return urlValidation
  }

  const normalizedUrl = urlValidation.url

  if (!normalizedMd5) {
    return createMd5RequiredSpeakerAudioValidation(normalizedUrl)
  }

  const pcmValidation = await validateSpeakerAudioPlayStartPcmUrl(normalizedUrl)
  if (!pcmValidation.valid || !pcmValidation.metadata) {
    return {
      ...pcmValidation,
      md5: normalizedMd5,
      snapshot: createSnapshot(normalizedUrl, normalizedMd5),
    }
  }

  const md5Result = await calculateRemoteFileMd5(normalizedUrl)
  if (!md5Result.ok) {
    return createInvalidResult(
      normalizedUrl,
      'MD5_CALCULATION_FAILED',
      md5Result.message,
      {
        md5: normalizedMd5,
        metadata: pcmValidation.metadata,
        snapshot: createSnapshot(normalizedUrl, normalizedMd5),
      },
    )
  }

  if (md5Result.md5 !== normalizedMd5) {
    return createInvalidResult(
      normalizedUrl,
      'MD5_MISMATCH',
      `MD5 mismatch: expected ${normalizedMd5}, got ${md5Result.md5}.`,
      {
        md5: normalizedMd5,
        calculatedMd5: md5Result.md5,
        metadata: pcmValidation.metadata,
        snapshot: createSnapshot(normalizedUrl, normalizedMd5),
      },
    )
  }

  return createValidResult(normalizedUrl, pcmValidation.metadata, {
    md5: normalizedMd5,
    calculatedMd5: md5Result.md5,
  })
}
