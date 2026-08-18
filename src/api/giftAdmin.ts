import api from '@/api/client'
import type {
  CreateGalleryCategoryPayload,
  CreateGiftCategoryPayload,
  CreateGiftPayload,
  GalleryAdminListResponse,
  GalleryCategoryAdmin,
  GiftAnalytics,
  GiftCategoryAdmin,
  GiftListQuery,
  GiftListResponse,
  GiftAdminListItem,
  PatchGalleryCategoryPayload,
  PatchGiftCategoryPayload,
  PatchGiftPayload,
} from '@/types/gift'

export const giftAdminApi = {
  getAnalytics() {
    return api.get<GiftAnalytics>('/admin/gifts/analytics')
  },

  listGifts(params: GiftListQuery = {}) {
    return api.get<GiftListResponse>('/admin/gifts', { params })
  },

  createGift(payload: CreateGiftPayload) {
    return api.post<GiftAdminListItem>('/admin/gifts', payload)
  },

  patchGift(giftId: string, payload: PatchGiftPayload) {
    return api.patch<GiftAdminListItem>(`/admin/gifts/${giftId}`, payload)
  },

  deleteGift(giftId: string) {
    return api.delete(`/admin/gifts/${giftId}`)
  },

  listCategories() {
    return api.get<{ categories?: GiftCategoryAdmin[] } | GiftCategoryAdmin[]>(
      '/admin/gift-categories',
    )
  },

  createCategory(payload: CreateGiftCategoryPayload) {
    return api.post<GiftCategoryAdmin>('/admin/gift-categories', payload)
  },

  patchCategory(categoryId: string, payload: PatchGiftCategoryPayload) {
    return api.patch<GiftCategoryAdmin>(`/admin/gift-categories/${categoryId}`, payload)
  },

  reorderCategories(orderedIds: string[]) {
    return api.post('/admin/gift-categories/reorder', { orderedIds })
  },

  listGalleryCategories(params?: { year?: number; month?: number }) {
    return api.get<GalleryAdminListResponse>('/admin/gift-gallery/categories', {
      params,
    })
  },

  createGalleryCategory(payload: CreateGalleryCategoryPayload) {
    return api.post<GalleryCategoryAdmin>('/admin/gift-gallery/categories', payload)
  },

  patchGalleryCategory(sectionId: string, payload: PatchGalleryCategoryPayload) {
    return api.patch<GalleryCategoryAdmin>(
      `/admin/gift-gallery/categories/${sectionId}`,
      payload,
    )
  },

  addGiftsToGallery(sectionId: string, giftIds: string[]) {
    return api.post(`/admin/gift-gallery/categories/${sectionId}/gifts`, { giftIds })
  },

  removeGiftsFromGallery(sectionId: string, giftIds: string[]) {
    return api.delete(`/admin/gift-gallery/categories/${sectionId}/gifts`, { data: { giftIds } })
  },

  reorderGalleryCategories(orderedIds: string[]) {
    return api.post('/admin/gift-gallery/categories/reorder', { orderedIds })
  },

  deleteGalleryCategory(sectionId: string) {
    return api.delete(`/admin/gift-gallery/categories/${sectionId}`)
  },
}

export function normalizeGiftCategories(
  data: { categories?: GiftCategoryAdmin[] } | GiftCategoryAdmin[],
): GiftCategoryAdmin[] {
  if (Array.isArray(data)) return data
  return data.categories ?? []
}
