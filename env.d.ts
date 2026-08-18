/// <reference types="vite/client" />

import 'vue-router'
import type { AdminRole } from './src/types/api'

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_LIVE_API_BASE_URL: string
  readonly VITE_USE_MOCK: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    requiresAuth?: boolean
    title?: string
    roles?: AdminRole[]
    viewName?: string
  }
}

