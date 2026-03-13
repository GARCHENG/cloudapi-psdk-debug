export const APP_LANGUAGES = ['en', 'zh-CN'] as const

export type AppLanguage = (typeof APP_LANGUAGES)[number]

export const APP_LANGUAGE_STORAGE_KEY = 'psdk-debug-language'

export const DEFAULT_APP_LANGUAGE: AppLanguage = 'en'
