import { onMounted, onUnmounted, watch, type Ref } from 'vue'
import { useSupportNotificationsStore } from '@/stores/supportNotifications'

/** Poll open ticket detail while CSA views it (admin has no support-ticket WS room). */
const POLL_MS = 12_000

export function useSupportTicketLiveRefresh(
  reload: () => Promise<void>,
  enabled: Ref<boolean>,
) {
  const notif = useSupportNotificationsStore()
  let timer: ReturnType<typeof setInterval> | null = null
  let lastAwaiting = notif.badge.myAwaitingReply

  function tick() {
    if (enabled.value) void reload()
  }

  onMounted(() => {
    timer = setInterval(tick, POLL_MS)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  watch(enabled, (on) => {
    if (on) void reload()
  })

  watch(
    () => notif.badge.myAwaitingReply,
    (n) => {
      if (n !== lastAwaiting) {
        lastAwaiting = n
        tick()
      }
    },
  )

  watch(
    () => notif.badge.unreadCount,
    () => {
      tick()
    },
  )
}
