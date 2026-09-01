<script setup lang="ts">
import { computed, ref } from 'vue'
import { format } from 'date-fns'
import type { Post } from '@/types/user'
import BaseDialog from '@/components/shared/BaseDialog.vue'
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog.vue'
import { useUserDetailStore } from '@/stores/userDetail'
import { usePlatformMessagesStore } from '@/stores/platformMessages'
import SortableTh from '@/components/shared/SortableTh.vue'
import { useSortableRows } from '@/composables/useSortableRows'

const props = defineProps<{
  userId: string
  posts: Post[]
}>()

const store = useUserDetailStore()
const platformStore = usePlatformMessagesStore()

const viewPost = ref<Post | null>(null)
const deletePostId = ref<string | null>(null)
const warnPostId = ref<string | null>(null)
const suspendOpen = ref(false)
const postBanOpen = ref(false)
const suspendUntil = ref('')
const warnMessage = ref('Your post violated community guidelines.')
const loadingDetail = ref(false)
const activating = ref(false)

const postingBanned = computed(() => Boolean(store.user?.postingBanned))
const postingSuspendedUntil = computed(() => store.user?.postingSuspendedUntil ?? null)

const postingRestricted = computed(() => {
  if (postingBanned.value) return true
  const until = postingSuspendedUntil.value
  if (!until) return false
  return new Date(until).getTime() > Date.now()
})

const postingStatusLabel = computed(() => {
  if (postingBanned.value) return 'Posting banned'
  const until = postingSuspendedUntil.value
  if (until && new Date(until).getTime() > Date.now()) {
    return `Suspended until ${format(new Date(until), 'dd MMM yyyy HH:mm')}`
  }
  return 'Posting allowed'
})

const postsRef = computed(() => props.posts)
const {
  sortKey: postsSortKey,
  sortDir: postsSortDir,
  sortedRows: sortedPosts,
  toggleSort: togglePostsSort,
} = useSortableRows(postsRef, (post, key) => {
  switch (key) {
    case 'caption':
      return (post.caption || '').toLowerCase()
    case 'type':
      return post.type ?? ''
    case 'date':
      return post.date ? new Date(post.date).getTime() : 0
    default:
      return undefined
  }
})

async function openPost(post: Post) {
  loadingDetail.value = true
  try {
    const detail = await store.fetchPostDetail(post.id)
    viewPost.value = detail ?? post
  } finally {
    loadingDetail.value = false
  }
}

async function handleDelete() {
  if (!deletePostId.value) return
  await store.deletePost(deletePostId.value)
  deletePostId.value = null
}

async function handleWarn(payload: { reason?: string }) {
  if (!warnPostId.value) return
  await platformStore.sendSystemMessage(
    props.userId,
    payload.reason ?? warnMessage.value,
  )
  warnPostId.value = null
}

async function handleSuspend() {
  if (!suspendUntil.value) return
  await store.suspendPosting(props.userId, new Date(suspendUntil.value).toISOString())
  suspendOpen.value = false
  suspendUntil.value = ''
}

async function handlePostBan() {
  await store.banPosting(props.userId)
  postBanOpen.value = false
}

async function handleActivatePosting() {
  if (activating.value) return
  activating.value = true
  try {
    await store.activatePosting(props.userId)
  } finally {
    activating.value = false
  }
}
</script>

<template>
  <div class="admin-card">
    <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-admin-subtext">
      Post Moderation
    </h2>

    <div
      class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-3"
      :class="
        postingRestricted
          ? 'border-admin-warn/40 bg-admin-warn/5'
          : 'border-admin-border bg-admin-bg'
      "
    >
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-admin-subtext">
          Posting privileges
        </p>
        <p
          class="mt-0.5 text-sm font-medium"
          :class="postingRestricted ? 'text-admin-warn' : 'text-admin-text'"
        >
          {{ postingStatusLabel }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <template v-if="postingRestricted">
          <button
            type="button"
            class="admin-btn-primary text-xs"
            :disabled="activating"
            @click="handleActivatePosting"
          >
            {{ activating ? 'Activating…' : 'Activate posting' }}
          </button>
        </template>
        <template v-else>
          <button type="button" class="admin-btn-secondary text-xs" @click="suspendOpen = true">
            Suspend posting
          </button>
          <button type="button" class="admin-btn-danger text-xs" @click="postBanOpen = true">
            Ban posting
          </button>
        </template>
      </div>
    </div>

    <div class="admin-table-wrap">

      <table class="admin-table">

        <thead>

          <tr>

            <th>Thumbnail</th>

            <SortableTh label="Caption" sort-key="caption" :active-key="postsSortKey" :direction="postsSortDir" @sort="togglePostsSort" />

            <SortableTh label="Type" sort-key="type" :active-key="postsSortKey" :direction="postsSortDir" @sort="togglePostsSort" />

            <SortableTh label="Date" sort-key="date" :active-key="postsSortKey" :direction="postsSortDir" @sort="togglePostsSort" />

            <th>Actions</th>

          </tr>

        </thead>

        <tbody>

          <tr v-for="post in sortedPosts" :key="post.id">

            <td>

              <img

                v-if="post.thumbnail"

                :src="post.thumbnail"

                :alt="post.caption"

                class="h-12 w-12 rounded object-cover"

              />

              <div v-else class="h-12 w-12 rounded bg-admin-bg" />

            </td>

            <td class="max-w-[200px] truncate">{{ post.caption || '—' }}</td>

            <td>

              <span

                :class="[

                  'rounded px-2 py-0.5 text-xs font-medium capitalize',

                  post.type === 'video' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400',

                ]"

              >

                {{ post.type }}

              </span>

            </td>

            <td class="text-xs whitespace-nowrap">{{ format(new Date(post.date), 'dd MMM yyyy') }}</td>

            <td>

              <div class="flex gap-1">

                <button

                  type="button"

                  title="Delete Post"

                  class="rounded p-1.5 text-admin-danger hover:bg-admin-danger/10"

                  @click="deletePostId = post.id"

                >

                  🗑

                </button>

                <button

                  type="button"

                  title="Warn User"

                  class="rounded p-1.5 text-admin-warn hover:bg-admin-warn/10"

                  @click="warnPostId = post.id"

                >

                  ⚠️

                </button>

                <button
                  v-if="!postingRestricted"
                  type="button"
                  title="Suspend Posting"
                  class="rounded p-1.5 text-admin-warn hover:bg-admin-warn/10"
                  @click="suspendOpen = true"
                >
                  🔇
                </button>
                <button
                  v-if="!postingRestricted"
                  type="button"
                  title="Permanent Post Ban"
                  class="rounded p-1.5 text-admin-danger hover:bg-admin-danger/10"
                  @click="postBanOpen = true"
                >
                  🚫
                </button>
                <button
                  v-else
                  type="button"
                  title="Activate posting"
                  class="rounded p-1.5 text-admin-success hover:bg-admin-success/10"
                  @click="handleActivatePosting"
                >
                  ✓
                </button>

                <button

                  type="button"

                  title="View Post"

                  class="rounded p-1.5 text-admin-accent hover:bg-admin-accent/10"

                  :disabled="loadingDetail"

                  @click="openPost(post)"

                >

                  👁

                </button>

              </div>

            </td>

          </tr>

          <tr v-if="!posts.length">

            <td colspan="5" class="py-8 text-center text-admin-muted">No posts found</td>

          </tr>

        </tbody>

      </table>

    </div>



    <BaseDialog :open="!!viewPost" title="View Post" size="lg" @close="viewPost = null">

      <template #body>

        <div v-if="viewPost" class="space-y-3">

          <video

            v-if="viewPost.type === 'video' && (viewPost.url ?? viewPost.thumbnail)"

            :src="viewPost.url ?? viewPost.thumbnail"

            controls

            class="w-full rounded-lg"

          />

          <img

            v-else-if="viewPost.url ?? viewPost.thumbnail"

            :src="viewPost.url ?? viewPost.thumbnail"

            :alt="viewPost.caption"

            class="w-full rounded-lg"

          />

          <p class="text-sm">{{ viewPost.caption || 'No caption' }}</p>

          <p class="text-xs text-admin-subtext">{{ format(new Date(viewPost.date), 'dd MMM yyyy HH:mm') }}</p>

        </div>

      </template>

    </BaseDialog>



    <ConfirmActionDialog

      :open="!!deletePostId"

      title="Delete Post"

      message="This action cannot be undone. The post will be permanently deleted."

      confirm-label="Delete"

      variant="danger"

      :require-confirm-text="true"

      @close="deletePostId = null"

      @confirm="handleDelete"

    />



    <ConfirmActionDialog

      :open="!!warnPostId"

      title="Send System Warning"

      message="Send a SYSTEM platform message to the post author about this content."

      confirm-label="Send Warning"

      variant="warn"

      :require-reason="true"

      @close="warnPostId = null"

      @confirm="handleWarn"

    />



    <BaseDialog :open="suspendOpen" title="Suspend Posting" @close="suspendOpen = false">

      <template #body>

        <div class="space-y-3">

          <div>

            <label class="mb-1 block text-xs text-admin-subtext">Suspended until (ISO datetime)</label>

            <input v-model="suspendUntil" type="datetime-local" class="admin-input" />

          </div>

        </div>

      </template>

      <template #footer>

        <button type="button" class="admin-btn-secondary" @click="suspendOpen = false">Cancel</button>

        <button type="button" class="admin-btn-warn" :disabled="!suspendUntil" @click="handleSuspend">

          Suspend Posting

        </button>

      </template>

    </BaseDialog>



    <ConfirmActionDialog

      :open="postBanOpen"

      title="Permanent Post Ban"

      message="This will permanently ban the user from posting."

      confirm-label="Ban Posting"

      variant="danger"

      :require-confirm-text="true"

      @close="postBanOpen = false"

      @confirm="handlePostBan"

    />

  </div>

</template>

