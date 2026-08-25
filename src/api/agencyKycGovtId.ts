import api from '@/api/client'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
const MAX_BYTES = 10 * 1024 * 1024

export type AdminGovtIdUploadTarget =
  | { via: 'user'; userId: string }
  | { via: 'application'; userId: string }
  | { via: 'agency'; identifier: string }

export interface AdminGovtIdConfirmResponse {
  ok: boolean
  userId: string
  govtIdUrl: string | null
  govtIdSubmittedAt: string | null
}

function resolveMime(file: File): string {
  const raw = file.type === 'image/jpg' ? 'image/jpeg' : file.type
  if (!ALLOWED_MIME.has(raw)) {
    throw new Error('Use a JPEG, PNG, WebP, or PDF file')
  }
  return raw
}

function pathsFor(target: AdminGovtIdUploadTarget) {
  if (target.via === 'user') {
    const base = `/admin/users/${encodeURIComponent(target.userId)}/kyc/govt-id`
    return { upload: `${base}/upload-url`, confirm: `${base}/confirm` }
  }
  if (target.via === 'application') {
    const base = `/admin/agency/applications/${encodeURIComponent(target.userId)}/kyc/govt-id`
    return { upload: `${base}/upload-url`, confirm: `${base}/confirm` }
  }
  const base = `/admin/agency/${encodeURIComponent(target.identifier)}/kyc/govt-id`
  return { upload: `${base}/upload-url`, confirm: `${base}/confirm` }
}

/** Presign → PUT file to S3 → confirm. Returns the new public URL. */
export async function uploadAdminGovtId(
  target: AdminGovtIdUploadTarget,
  file: File,
): Promise<AdminGovtIdConfirmResponse> {
  if (file.size > MAX_BYTES) {
    throw new Error('File must be 10 MB or smaller')
  }
  const mimeType = resolveMime(file)
  const { upload, confirm } = pathsFor(target)

  const { data: presign } = await api.post<{
    uploadUrl: string
    s3Key: string
    expiresInSec: number
  }>(upload, { mimeType })

  const putRes = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: file,
  })
  if (!putRes.ok) {
    throw new Error(`S3 upload failed: ${putRes.status}`)
  }

  const { data } = await api.post<AdminGovtIdConfirmResponse>(confirm, { s3Key: presign.s3Key })
  return data
}

export function reopenAgencyApplication(userId: string, via: 'user' | 'application' = 'application') {
  const path =
    via === 'user'
      ? `/admin/users/${encodeURIComponent(userId)}/agency-application/reopen`
      : `/admin/agency/applications/${encodeURIComponent(userId)}/reopen`
  return api.post<{
    ok: boolean
    userId: string
    reopened: boolean
    previousApplicationId: string
  }>(path)
}
