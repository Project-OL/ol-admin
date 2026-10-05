import axios from 'axios'
import api from '@/api/client'

export type ApkRelease = {
  id: string
  versionName: string
  sizeBytes: number
  url: string
  createdAt: string
}

export type AppLinksConfig = {
  iosUrl: string | null
  playStoreUrl: string | null
  currentApk: ApkRelease | null
  releases: ApkRelease[]
  maxApkBytes: number
  updatedAt: string
}

type ApkUploadUrlResponse = {
  uploadUrl: string
  key: string
  contentType: string
  expiresIn: number
  maxBytes: number
}

const BASE = '/admin/system-settings/app-links'

/** Download links shown on offoolive.com (SUPER_ADMIN only). */
export const appLinksApi = {
  get: () => api.get<AppLinksConfig>(BASE),

  updateLinks: (body: { iosUrl: string | null; playStoreUrl: string | null }) =>
    api.put<AppLinksConfig>(BASE, body),

  setCurrentRelease: (releaseId: string) =>
    api.put<AppLinksConfig>(`${BASE}/apk/current`, { releaseId }),

  /**
   * Presign → PUT straight to the bucket → confirm. The file never goes through the API.
   * Uses plain axios for the PUT: the shared `api` instance would attach the admin Bearer
   * token to the bucket request, and `fetch` can't report upload progress.
   */
  async uploadApk(
    file: File,
    versionName: string,
    onProgress: (percent: number) => void,
  ): Promise<AppLinksConfig> {
    const { data: presign } = await api.post<ApkUploadUrlResponse>(`${BASE}/apk/upload-url`, {
      fileName: file.name,
      sizeBytes: file.size,
      versionName,
    })
    await axios.put(presign.uploadUrl, file, {
      headers: { 'Content-Type': presign.contentType },
      onUploadProgress: (e) => {
        if (e.total) onProgress(Math.round((e.loaded / e.total) * 100))
      },
    })
    const { data } = await api.post<AppLinksConfig>(`${BASE}/apk/releases`, {
      key: presign.key,
      versionName,
    })
    return data
  },
}
