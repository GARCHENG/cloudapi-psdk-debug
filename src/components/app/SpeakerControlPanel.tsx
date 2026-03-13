import { useState } from 'react'
import type { SpeakerAudioPlayStartValidationResult } from '../../lib/speakerAudioPlayStartValidation'
import { getText } from '../../lib/i18n'
import type { AppLanguage } from '../../types/app'
import type { CommandFeedback } from '../../types/psdk'
import { resolveCommandMethodLabel, formatShortTid } from './view-helpers'
import { InlineSpinner, SectionHeader } from './ui'
import {
  WidgetValueExampleModal,
  type WidgetExamplePick,
} from './WidgetValueExampleModal'

interface SpeakerControlPanelProps {
  language: AppLanguage
  pendingTotal: number
  commandFeedbacks: CommandFeedback[]
  removeFeedback: (id: string) => void
  canSend: boolean
  playMode: 0 | 1
  setPlayMode: (value: 0 | 1) => void
  pendingPlayModeSet: boolean
  handlePlayModeSet: () => void
  playVolume: number
  setPlayVolume: (value: number) => void
  pendingVolumeSet: boolean
  handleVolumeSet: () => void
  pendingReplay: boolean
  handleReplay: () => void
  pendingStop: boolean
  handleStop: () => void
  audioName: string
  setAudioName: (value: string) => void
  audioUrl: string
  setAudioUrl: (value: string) => void
  audioMd5: string
  setAudioMd5: (value: string) => void
  canValidateAudio: boolean
  audioValid: boolean
  audioValidation: SpeakerAudioPlayStartValidationResult
  pendingAudioValidation: boolean
  handleValidateAudioPlayStart: () => void
  pendingAudioPlayStart: boolean
  handleAudioPlayStart: () => void
  handleFillDefaultAudioPlay: () => void
  ttsName: string
  setTtsName: (value: string) => void
  ttsText: string
  setTtsText: (value: string) => void
  ttsMd5: string
  setTtsMd5: (value: string) => void
  ttsValid: boolean
  pendingTtsPlayStart: boolean
  handleTtsPlayStart: () => void
  inputBoxText: string
  setInputBoxText: (value: string) => void
  inputBoxTextBytes: number
  inputBoxTextValid: boolean
  pendingInputBoxTextSet: boolean
  handleInputBoxTextSet: () => void
  widgetIndex: number
  setWidgetIndex: (value: number) => void
  widgetValue: number
  setWidgetValue: (value: number) => void
  widgetIndexValid: boolean
  widgetValueValid: boolean
  pendingWidgetValueSet: boolean
  handleWidgetValueSet: () => void
  widgetConfigSourceType: string
  setWidgetConfigSourceType: (value: string) => void
}

export const SpeakerControlPanel = ({
  language,
  pendingTotal,
  commandFeedbacks,
  removeFeedback,
  canSend,
  playMode,
  setPlayMode,
  pendingPlayModeSet,
  handlePlayModeSet,
  playVolume,
  setPlayVolume,
  pendingVolumeSet,
  handleVolumeSet,
  pendingReplay,
  handleReplay,
  pendingStop,
  handleStop,
  audioName,
  setAudioName,
  audioUrl,
  setAudioUrl,
  audioMd5,
  setAudioMd5,
  canValidateAudio,
  audioValid,
  audioValidation,
  pendingAudioValidation,
  handleValidateAudioPlayStart,
  pendingAudioPlayStart,
  handleAudioPlayStart,
  handleFillDefaultAudioPlay,
  ttsName,
  setTtsName,
  ttsText,
  setTtsText,
  ttsMd5,
  setTtsMd5,
  ttsValid,
  pendingTtsPlayStart,
  handleTtsPlayStart,
  inputBoxText,
  setInputBoxText,
  inputBoxTextBytes,
  inputBoxTextValid,
  pendingInputBoxTextSet,
  handleInputBoxTextSet,
  widgetIndex,
  setWidgetIndex,
  widgetValue,
  setWidgetValue,
  widgetIndexValid,
  widgetValueValid,
  pendingWidgetValueSet,
  handleWidgetValueSet,
  widgetConfigSourceType,
  setWidgetConfigSourceType,
}: SpeakerControlPanelProps) => {
  const text = getText(language)
  const panelText = text.speaker
  const common = text.common
  const [widgetExampleModalOpen, setWidgetExampleModalOpen] = useState(false)
  const [widgetExampleDeviceType, setWidgetExampleDeviceType] = useState('')
  const [widgetExampleDescription, setWidgetExampleDescription] = useState('')

  const showAudioValidation =
    audioUrl.trim().length > 0 ||
    audioMd5.trim().length > 0 ||
    audioValidation.status === 'validating'

  const audioValidationTone =
    audioValidation.status === 'valid'
      ? 'border-signal-500/45 bg-signal-500/10 text-signal-400'
      : audioValidation.status === 'validating'
        ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
        : 'border-warn-500/45 bg-warn-500/10 text-warn-500'

  const audioValidationMessage = (() => {
    switch (audioValidation.errorCode) {
      case 'URL_REQUIRED':
      case 'INVALID_URL':
      case 'INVALID_PROTOCOL':
        return `${panelText.validationPrefixUrl}: ${audioValidation.message}`
      case 'INVALID_WAV_HEADER':
      case 'UNSUPPORTED_WAV_FORMAT':
      case 'CHANNELS_MISMATCH':
      case 'SAMPLE_RATE_MISMATCH':
      case 'BITS_PER_SAMPLE_MISMATCH':
        return `${panelText.validationPrefixPcm}: ${audioValidation.message}`
      case 'MD5_REQUIRED':
      case 'MD5_MISMATCH':
        return `${panelText.validationPrefixMd5}: ${audioValidation.message}`
      case 'NETWORK_ERROR':
      case 'HTTP_ERROR':
      case 'MD5_CALCULATION_FAILED':
        return `${panelText.validationPrefixNetwork}: ${audioValidation.message}`
      default:
        return audioValidation.message
    }
  })()

  const handleWidgetExamplePick = ({
    index,
    value,
    deviceType,
    description,
  }: WidgetExamplePick) => {
    setWidgetIndex(index)
    setWidgetValue(value)
    setWidgetExampleDeviceType(deviceType)
    setWidgetExampleDescription(description)
    setWidgetConfigSourceType(deviceType)
  }

  const pendingSummaryText =
    pendingTotal > 1
      ? panelText.pendingPlural(pendingTotal)
      : panelText.pendingSingular

  return (
    <>
      <section className='panel'>
        <SectionHeader
          title={panelText.title}
          subtitle={panelText.subtitle}
          language={language}
        />
        <div className='mt-5 space-y-3'>
          <div className='flex flex-wrap items-center gap-3 rounded-xl border border-steel-700/45 bg-coal-900/50 px-4 py-3 text-sm text-steel-300'>
            {pendingTotal > 0 ? (
              <>
                <InlineSpinner className='h-4 w-4 text-amber-400' />
                <span>{pendingSummaryText}</span>
              </>
            ) : (
              <span className='text-signal-400'>{panelText.noPending}</span>
            )}
          </div>

          {commandFeedbacks.length > 0 && (
            <div className='space-y-2'>
              {commandFeedbacks.map((feedback) => (
                <div
                  key={feedback.id}
                  className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-panel transition ${
                    feedback.status === 'success'
                      ? 'border-signal-500/50 bg-signal-500/10 text-signal-400'
                      : feedback.status === 'timeout'
                        ? 'border-amber-500/55 bg-amber-500/10 text-amber-400'
                        : 'border-warn-500/50 bg-warn-500/10 text-warn-500'
                  }`}
                >
                  <span className='font-medium'>
                    {feedback.status === 'success'
                      ? panelText.feedbackSuccess
                      : feedback.status === 'timeout'
                        ? panelText.feedbackTimeout
                        : panelText.feedbackFailure}
                  </span>
                  <span className='text-steel-300'>
                    {resolveCommandMethodLabel(feedback.method, language)}
                  </span>
                  <span className='chip border-current/40 bg-transparent font-mono text-[11px] text-current'>
                    tid {formatShortTid(feedback.tid)}
                  </span>
                  <span className='text-steel-300'>
                    {panelText.resultLabel} {feedback.result ?? common.na}
                  </span>
                  <button
                    className='btn ml-auto h-8 px-3 text-xs'
                    onClick={() => removeFeedback(feedback.id)}
                  >
                    {common.dismiss}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className='mt-6 grid gap-4 lg:grid-cols-2'>
          <div className='rounded-xl border border-steel-700/40 bg-coal-900/60 p-4'>
            <p className='text-xs uppercase tracking-[0.2em] text-steel-400'>
              {panelText.playModeVolume}
            </p>
            <div className='mt-3 grid gap-4'>
              <div className='flex flex-wrap items-center gap-4 text-sm'>
                <label className='flex items-center gap-2'>
                  <input
                    type='radio'
                    checked={playMode === 0}
                    onChange={() => setPlayMode(0)}
                  />
                  {panelText.single}
                </label>
                <label className='flex items-center gap-2'>
                  <input
                    type='radio'
                    checked={playMode === 1}
                    onChange={() => setPlayMode(1)}
                  />
                  {panelText.loop}
                </label>
                <button
                  className='btn'
                  onClick={handlePlayModeSet}
                  disabled={!canSend || pendingPlayModeSet}
                  aria-busy={pendingPlayModeSet}
                >
                  {pendingPlayModeSet ? (
                    <>
                      <InlineSpinner />
                      {panelText.applying}
                    </>
                  ) : (
                    panelText.applyMode
                  )}
                </button>
              </div>
              <div className='flex flex-wrap items-center gap-3'>
                <input
                  type='range'
                  min={0}
                  max={100}
                  value={playVolume}
                  onChange={(event) => setPlayVolume(Number(event.target.value))}
                  className='flex-1'
                />
                <input
                  type='number'
                  min={0}
                  max={100}
                  value={playVolume}
                  onChange={(event) => setPlayVolume(Number(event.target.value))}
                  className='input w-24'
                />
                <button
                  className='btn'
                  onClick={handleVolumeSet}
                  disabled={!canSend || pendingVolumeSet}
                  aria-busy={pendingVolumeSet}
                >
                  {pendingVolumeSet ? (
                    <>
                      <InlineSpinner />
                      {panelText.applying}
                    </>
                  ) : (
                    panelText.applyVolume
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className='rounded-xl border border-steel-700/40 bg-coal-900/60 p-4'>
            <p className='text-xs uppercase tracking-[0.2em] text-steel-400'>
              {panelText.playbackActions}
            </p>
            <div className='mt-3 flex flex-wrap gap-3'>
              <button
                className='btn'
                onClick={handleReplay}
                disabled={!canSend || pendingReplay}
                aria-busy={pendingReplay}
              >
                {pendingReplay ? (
                  <>
                    <InlineSpinner />
                    {panelText.replaying}
                  </>
                ) : (
                  panelText.replay
                )}
              </button>
              <button
                className='btn btn-danger'
                onClick={handleStop}
                disabled={!canSend || pendingStop}
                aria-busy={pendingStop}
              >
                {pendingStop ? (
                  <>
                    <InlineSpinner />
                    {panelText.stopping}
                  </>
                ) : (
                  panelText.stop
                )}
              </button>
            </div>
          </div>

          <div className='flex h-full flex-col rounded-xl border border-steel-700/40 bg-coal-900/60 p-4'>
            <div className='flex items-center justify-between gap-3'>
              <p className='text-xs uppercase tracking-[0.2em] text-steel-400'>
                {panelText.audioPlayStart}
              </p>
              <button className='btn' onClick={handleFillDefaultAudioPlay}>
                {panelText.example}
              </button>
            </div>
            <div className='mt-3 grid flex-1 gap-3'>
              <input
                className='input'
                value={audioName}
                onChange={(event) => setAudioName(event.target.value)}
                placeholder={panelText.fileNamePlaceholder}
              />
              <input
                className='input'
                value={audioUrl}
                onChange={(event) => setAudioUrl(event.target.value)}
                placeholder={panelText.fileUrlPlaceholder}
              />
              <input
                className='input'
                value={audioMd5}
                onChange={(event) => setAudioMd5(event.target.value)}
                placeholder={panelText.fileMd5Placeholder}
              />
              {showAudioValidation && (
                <p
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${audioValidationTone}`}
                >
                  {audioValidation.status === 'validating' && (
                    <InlineSpinner className='h-3 w-3' />
                  )}
                  {audioValidationMessage}
                </p>
              )}
              <div className='mt-auto flex flex-wrap gap-3'>
                <button
                  className='btn'
                  onClick={handleValidateAudioPlayStart}
                  disabled={!canValidateAudio || pendingAudioValidation}
                  aria-busy={pendingAudioValidation}
                >
                  {pendingAudioValidation ? (
                    <>
                      <InlineSpinner />
                      {panelText.validating}
                    </>
                  ) : (
                    panelText.validateAudio
                  )}
                </button>
                <button
                  className='btn btn-primary'
                  onClick={handleAudioPlayStart}
                  disabled={!canSend || !audioValid || pendingAudioPlayStart}
                  aria-busy={pendingAudioPlayStart}
                >
                  {pendingAudioPlayStart ? (
                    <>
                      <InlineSpinner />
                      {panelText.waitingReply}
                    </>
                  ) : (
                    panelText.sendAudioPlayStart
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className='flex h-full flex-col rounded-xl border border-steel-700/40 bg-coal-900/60 p-4'>
            <p className='text-xs uppercase tracking-[0.2em] text-steel-400'>
              {panelText.ttsPlayStart}
            </p>
            <div className='mt-3 grid flex-1 gap-3'>
              <input
                className='input'
                value={ttsName}
                onChange={(event) => setTtsName(event.target.value)}
                placeholder={panelText.ttsNamePlaceholder}
              />
              <textarea
                className='textarea h-24'
                value={ttsText}
                onChange={(event) => setTtsText(event.target.value)}
                placeholder={panelText.ttsTextPlaceholder}
              />
              <input
                className='input'
                value={ttsMd5}
                onChange={(event) => setTtsMd5(event.target.value)}
                placeholder={panelText.ttsMd5Placeholder}
              />
              <div className='mt-auto flex flex-wrap gap-3'>
                <button
                  className='btn btn-primary'
                  onClick={handleTtsPlayStart}
                  disabled={!canSend || !ttsValid || pendingTtsPlayStart}
                  aria-busy={pendingTtsPlayStart}
                >
                  {pendingTtsPlayStart ? (
                    <>
                      <InlineSpinner />
                      {panelText.waitingReply}
                    </>
                  ) : (
                    panelText.sendTtsPlayStart
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className='flex h-full flex-col rounded-xl border border-steel-700/40 bg-coal-900/60 p-4'>
            <p className='text-xs uppercase tracking-[0.2em] text-steel-400'>
              {panelText.inputBoxTextSet}
            </p>
            <div className='mt-3 grid flex-1 gap-3'>
              <textarea
                className='textarea h-24'
                value={inputBoxText}
                maxLength={128}
                onChange={(event) => setInputBoxText(event.target.value)}
                placeholder={panelText.inputBoxPlaceholder}
              />
              <p className='text-xs text-steel-400'>
                {panelText.bytesLabel(inputBoxTextBytes, 128)}
              </p>
              <div className='mt-auto flex flex-wrap gap-3'>
                <button
                  className='btn'
                  onClick={handleInputBoxTextSet}
                  disabled={
                    !canSend || !inputBoxTextValid || pendingInputBoxTextSet
                  }
                  aria-busy={pendingInputBoxTextSet}
                >
                  {pendingInputBoxTextSet ? (
                    <>
                      <InlineSpinner />
                      {panelText.applying}
                    </>
                  ) : (
                    panelText.setInputBoxText
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className='flex h-full flex-col rounded-xl border border-steel-700/40 bg-coal-900/60 p-4'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <p className='text-xs uppercase tracking-[0.2em] text-steel-400'>
                {panelText.widgetValueSet}
              </p>
              <button
                className='btn h-8 px-3 text-xs'
                onClick={() => setWidgetExampleModalOpen(true)}
                type='button'
              >
                {panelText.example}
              </button>
            </div>
            <div className='mt-3 grid flex-1 gap-3'>
              <div className='flex flex-wrap items-center gap-3'>
                <label className='label m-0'>{panelText.widgetIndex}</label>
                <input
                  type='number'
                  min={0}
                  step={1}
                  value={widgetIndex}
                  onChange={(event) => {
                    setWidgetIndex(Number(event.target.value))
                    setWidgetExampleDeviceType('')
                    setWidgetExampleDescription('')
                    setWidgetConfigSourceType('')
                  }}
                  className='input w-24'
                />
              </div>
              <div className='flex flex-wrap items-center gap-3'>
                <label className='label m-0'>{panelText.widgetValue}</label>
                <input
                  type='number'
                  value={widgetValue}
                  onChange={(event) => {
                    setWidgetValue(Number(event.target.value))
                    setWidgetExampleDeviceType('')
                    setWidgetExampleDescription('')
                    setWidgetConfigSourceType('')
                  }}
                  className='input w-24'
                />
              </div>
              {widgetExampleDescription && (
                <p className='flex flex-wrap items-center gap-2 rounded-lg border border-signal-500/40 bg-signal-500/10 px-3 py-2 text-sm text-signal-400'>
                  {(widgetExampleDeviceType || widgetConfigSourceType) && (
                    <span className='chip border-signal-500/45 bg-signal-500/15 text-[11px] text-signal-300'>
                      {widgetExampleDeviceType || widgetConfigSourceType}
                    </span>
                  )}
                  {widgetExampleDescription}
                </p>
              )}
              <div className='mt-auto flex flex-wrap gap-3'>
                <button
                  className='btn'
                  onClick={handleWidgetValueSet}
                  disabled={
                    !canSend ||
                    !widgetIndexValid ||
                    !widgetValueValid ||
                    pendingWidgetValueSet
                  }
                  aria-busy={pendingWidgetValueSet}
                >
                  {pendingWidgetValueSet ? (
                    <>
                      <InlineSpinner />
                      {panelText.applying}
                    </>
                  ) : (
                    panelText.setWidgetValue
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
      <WidgetValueExampleModal
        language={language}
        open={widgetExampleModalOpen}
        onClose={() => setWidgetExampleModalOpen(false)}
        onPick={handleWidgetExamplePick}
      />
    </>
  )
}
