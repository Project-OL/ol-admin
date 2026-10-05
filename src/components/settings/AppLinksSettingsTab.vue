<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { format, parseISO } from 'date-fns'
import { appLinksApi, type AppLinksConfig } from '@/api/appLinks'
import { apiErrorMessage } from '@/utils/apiError'
import { showToast } from '@/utils/toast'

const VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,39}$/

const config = ref<AppLinksConfig | null>(null)
const loading = ref(false)
const loadError = ref('')

const linksForm = reactive({ iosUrl: '', playStoreUrl: '' })
const savingLinks = ref(false)
const linksError = ref('')

const apkFile = ref<File | null>(null)
const apkVersion = ref('')
const uploading = ref(false)
const uploadPercent = ref(0)
const uploadError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const switchingReleaseId = ref<string | null>(null)

function applyConfig(data: AppLinksConfig) {
  config.value = data
  linksForm.iosUrl = data.iosUrl ?? ''
  linksForm.playStoreUrl = data.playStoreUrl ?? ''
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await appLinksApi.get()
    applyConfig(data)
  } catch (e) {
    loadError.value = apiErrorMessage(e, 'Could not load app download links.')
  } finally {
    loading.value = false
  }
}

function formatDt(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), 'dd MMM yyyy HH:mm')
  } catch {
    return iso
  }
}

function formatSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function saveLinks() {
  linksError.value = ''
  savingLinks.value = true
  try {
    const { data } = await appLinksApi.updateLinks({
      iosUrl: linksForm.iosUrl.trim() || null,
      playStoreUrl: linksForm.playStoreUrl.trim() || null,
    })
    applyConfig(data)
    showToast('Store links saved', 'success')
  } catch (e) {
    linksError.value = apiErrorMessage(e, 'Could not save links.')
  } finally {
    savingLinks.value = false
  }
}

function onFileChange(event: Event) {
  uploadError.value = ''
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  if (!file) {
    apkFile.value = null
    return
  }
  if (!file.name.toLowerCase().endsWith('.apk')) {
    uploadError.value = 'Choose an .apk file.'
    apkFile.value = null
    return
  }
  if (config.value && file.size > config.value.maxApkBytes) {
    uploadError.value = `File is ${formatSize(file.size)}; the limit is ${formatSize(config.value.maxApkBytes)}.`
    apkFile.value = null
    return
  }
  apkFile.value = file
}

async function uploadApk() {
  uploadError.value = ''
  const version = apkVersion.value.trim()
  if (!apkFile.value) {
    uploadError.value = 'Choose an APK file first.'
    return
  }
  if (!VERSION_PATTERN.test(version)) {
    uploadError.value = 'Version may use letters, digits, . _ + - (e.g. 1.4.2).'
    return
  }
  uploading.value = true
  uploadPercent.value = 0
  try {
    const data = await appLinksApi.uploadApk(apkFile.value, version, (p) => {
      uploadPercent.value = p
    })
    applyConfig(data)
    apkFile.value = null
    apkVersion.value = ''
    if (fileInput.value) fileInput.value.value = ''
    showToast(`APK ${version} is now live on the website`, 'success')
  } catch (e) {
    uploadError.value = apiErrorMessage(
      e,
      'Upload failed. The previous APK is still live.',
    )
  } finally {
    uploading.value = false
  }
}

async function makeCurrent(releaseId: string) {
  switchingReleaseId.value = releaseId
  try {
    const { data } = await appLinksApi.setCurrentRelease(releaseId)
    applyConfig(data)
    showToast(`APK ${data.currentApk?.versionName ?? ''} is now live`, 'success')
  } catch {
    /* the API client already toasts the backend message */
  } finally {
    switchingReleaseId.value = null
  }
}

/** Closing the tab mid-upload would abort the PUT. */
function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (!uploading.value) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => {
  window.addEventListener('beforeunload', warnBeforeUnload)
  void load()
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnBeforeUnload))
</script>

<template>
  <div class="space-y-3">
    <div v-if="loading" class="admin-card py-6 text-center text-xs text-admin-subtext">
      Loading app download links…
    </div>

    <div v-else-if="loadError" class="admin-card space-y-2">
      <p class="text-xs text-admin-danger">{{ loadError }}</p>
      <button type="button" class="admin-btn-secondary text-xs" @click="load">Retry</button>
    </div>

    <template v-else-if="config">
      <!-- Store links -->
      <section class="admin-card max-w-xl space-y-3">
        <div>
          <h2 class="text-sm font-semibold text-admin-text">Store links</h2>
          <p class="mt-0.5 text-xs text-admin-subtext">
            Used by the App Store and Google Play buttons on offoolive.com (home page and footer).
            The website picks up changes within about 5 minutes. Leave a field empty to show
            “Coming soon” for that button.
          </p>
        </div>

        <form class="space-y-2" @submit.prevent="saveLinks">
          <div>
            <label class="mb-0.5 block text-[11px] text-admin-subtext">
              App Store button (TestFlight or App Store link)
            </label>
            <div class="flex gap-1.5">
              <input
                v-model="linksForm.iosUrl"
                type="url"
                class="admin-input flex-1"
                placeholder="https://testflight.apple.com/join/…"
                :disabled="savingLinks"
              />
              <a
                v-if="config.iosUrl"
                :href="config.iosUrl"
                target="_blank"
                rel="noopener"
                class="admin-btn-secondary text-xs"
              >
                Test
              </a>
            </div>
          </div>
          <div>
            <label class="mb-0.5 block text-[11px] text-admin-subtext">Google Play button</label>
            <div class="flex gap-1.5">
              <input
                v-model="linksForm.playStoreUrl"
                type="url"
                class="admin-input flex-1"
                placeholder="https://play.google.com/store/apps/details?id=…"
                :disabled="savingLinks"
              />
              <a
                v-if="config.playStoreUrl"
                :href="config.playStoreUrl"
                target="_blank"
                rel="noopener"
                class="admin-btn-secondary text-xs"
              >
                Test
              </a>
            </div>
          </div>

          <p class="text-xs text-admin-subtext">Last updated {{ formatDt(config.updatedAt) }}</p>
          <p v-if="linksError" class="text-xs text-admin-danger">{{ linksError }}</p>

          <button type="submit" class="admin-btn-primary" :disabled="savingLinks">
            {{ savingLinks ? 'Saving…' : 'Save store links' }}
          </button>
        </form>
      </section>

      <!-- Android APK -->
      <section class="admin-card max-w-xl space-y-3">
        <div>
          <h2 class="text-sm font-semibold text-admin-text">Android APK</h2>
          <p class="mt-0.5 text-xs text-admin-subtext">
            Downloaded by the Android button on offoolive.com. A new upload goes live only after it
            finishes; if it fails, the current APK stays live. Max {{ formatSize(config.maxApkBytes) }}.
          </p>
        </div>

        <dl class="grid grid-cols-1 gap-2 rounded-md bg-admin-bg px-2.5 py-2 text-xs sm:grid-cols-3">
          <div>
            <dt class="text-admin-subtext">Live version</dt>
            <dd class="font-medium text-admin-text">{{ config.currentApk?.versionName ?? '—' }}</dd>
          </div>
          <div>
            <dt class="text-admin-subtext">Size</dt>
            <dd class="font-medium text-admin-text">
              {{ config.currentApk ? formatSize(config.currentApk.sizeBytes) : '—' }}
            </dd>
          </div>
          <div>
            <dt class="text-admin-subtext">Uploaded</dt>
            <dd class="font-medium text-admin-text">{{ formatDt(config.currentApk?.createdAt) }}</dd>
          </div>
        </dl>

        <form class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_8rem]" @submit.prevent="uploadApk">
          <div>
            <label class="mb-0.5 block text-[11px] text-admin-subtext">APK file</label>
            <input
              ref="fileInput"
              type="file"
              accept=".apk,application/vnd.android.package-archive"
              class="admin-input"
              :disabled="uploading"
              @change="onFileChange"
            />
          </div>
          <div>
            <label class="mb-0.5 block text-[11px] text-admin-subtext">Version</label>
            <input
              v-model="apkVersion"
              type="text"
              class="admin-input"
              placeholder="1.4.2"
              maxlength="40"
              :disabled="uploading"
            />
          </div>

          <div v-if="uploading" class="sm:col-span-2 space-y-1">
            <div class="h-1.5 overflow-hidden rounded bg-admin-bg">
              <div
                class="h-full bg-admin-accent transition-[width]"
                :style="{ width: `${uploadPercent}%` }"
              />
            </div>
            <p class="text-xs text-admin-subtext">
              {{ uploadPercent < 100 ? `Uploading… ${uploadPercent}%` : 'Verifying upload…' }}
              Keep this tab open.
            </p>
          </div>

          <p v-if="uploadError" class="sm:col-span-2 text-xs text-admin-danger">{{ uploadError }}</p>

          <div class="sm:col-span-2">
            <button type="submit" class="admin-btn-primary" :disabled="uploading || !apkFile">
              {{ uploading ? 'Uploading…' : 'Upload and make live' }}
            </button>
          </div>
        </form>
      </section>

      <!-- Release history -->
      <section v-if="config.releases.length" class="admin-card max-w-xl space-y-2">
        <div>
          <h2 class="text-sm font-semibold text-admin-text">APK history</h2>
          <p class="mt-0.5 text-xs text-admin-subtext">
            Previous uploads are kept. Make one live again to roll back.
          </p>
        </div>
        <ul class="divide-y divide-admin-border text-xs">
          <li
            v-for="r in config.releases"
            :key="r.id"
            class="flex flex-wrap items-center justify-between gap-2 py-1.5"
          >
            <div>
              <span class="font-medium text-admin-text">{{ r.versionName }}</span>
              <span class="ml-2 text-admin-subtext">
                {{ formatSize(r.sizeBytes) }} · {{ formatDt(r.createdAt) }}
              </span>
            </div>
            <div class="flex items-center gap-1.5">
              <a :href="r.url" class="text-admin-accent hover:underline">Download</a>
              <span
                v-if="config.currentApk?.id === r.id"
                class="rounded bg-admin-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-admin-accent"
              >
                Live
              </span>
              <button
                v-else
                type="button"
                class="admin-btn-secondary text-[11px]"
                :disabled="switchingReleaseId !== null || uploading"
                @click="makeCurrent(r.id)"
              >
                {{ switchingReleaseId === r.id ? 'Switching…' : 'Make live' }}
              </button>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
