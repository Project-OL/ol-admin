import api from '@/api/client'
import type {
  BannerAdmin,
  BannerListQuery,
  BannerListResponse,
  BannerUploadUrlResponse,
  CreateBannerPayload,
  PatchBannerPayload,
} from '@/types/banner'

export async function uploadBannerImage(file: File): Promise<string> {
  const { data: presign } = await api.post<BannerUploadUrlResponse>('/admin/banners/upload-url', {
    fileName: file.name,
    sizeBytes: file.size,
  })

  const putRes = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': presign.contentType },
    body: file,
  })
  if (!putRes.ok) {
    throw new Error(`S3 upload failed: ${putRes.status}`)
  }

  return presign.publicUrl
}

export const bannerAdminApi = {
  list(params: BannerListQuery = {}) {
    return api.get<BannerListResponse>('/admin/banners', { params })
  },

  get(bannerId: string) {
    return api.get<{ banner: BannerAdmin }>(`/admin/banners/${bannerId}`)
  },

  create(payload: CreateBannerPayload) {
    return api.post<{ banner: BannerAdmin }>('/admin/banners', payload)
  },

  patch(bannerId: string, payload: PatchBannerPayload) {
    return api.patch<{ banner: BannerAdmin }>(`/admin/banners/${bannerId}`, payload)
  },

  delete(bannerId: string) {
    return api.delete<{ ok: true }>(`/admin/banners/${bannerId}`)
  },
}
