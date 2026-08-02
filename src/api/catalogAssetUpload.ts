import api from '@/api/client'

export type AdminCatalogAssetRole = 'display' | 'effect'
export type AdminCatalogDomain = 'gift' | 'store'

export interface AdminCatalogAssetUploadUrlResponse {
  uploadUrl: string
  key: string
  publicUrl: string
  expiresIn: number
  role: AdminCatalogAssetRole
  contentType: string
}

/** Request presign, PUT file to S3, return publicUrl for catalog create/patch. */
export async function uploadAdminCatalogAsset(params: {
  domain: AdminCatalogDomain
  role: AdminCatalogAssetRole
  file: File
}): Promise<string> {
  const presignPath =
    params.domain === 'gift' ? '/admin/gifts/upload-url' : '/admin/store/items/upload-url'

  const { data: presign } = await api.post<AdminCatalogAssetUploadUrlResponse>(presignPath, {
    role: params.role,
    fileName: params.file.name,
    sizeBytes: params.file.size,
  })

  const putRes = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': presign.contentType },
    body: params.file,
  })
  if (!putRes.ok) {
    throw new Error(`S3 upload failed: ${putRes.status}`)
  }

  return presign.publicUrl
}
