# Admin views & endpoints catalog

Canonical map of **view name → allowed admin API endpoints** for this panel.

Use this when creating/editing views in **Admin Views** (`/admin/views`) or assigning views to CSAs.

**Format:** `METHOD /admin/path` (relative to `/api/v1`). Param names are interchangeable for matching (`:id` ≡ `:userId`).

**Keep in sync with:**

- Backend seed: `ol-node-rest/src/config/admin-default-views.ts` (`npm run seed:admin-views`)
- Panel routes: `src/constants/viewRoutes.ts`, `src/router/index.ts`, `src/components/layout/AdminSidebar.vue`

**Companions** (assigning the parent should also assign the detail view):

| Parent | Companion detail |
|--------|------------------|
| `UserListView` | `UserDetailView` |
| `AgencyListView` | `AgencyDetailView` |
| `AgencyPayrollView` | `AgencyPayrollAssignmentDetailView` |
| `CustomerSupportView` | `SupportTicketDetailView` |

**Always callable** (not gated by view assignment):  
`GET /admin/auth/me`, `POST /admin/auth/logout`, `GET /admin/views/me`,  
`GET /admin/support/notifications`, `GET /admin/support/notifications/badge`,  
`POST /admin/support/notifications/read`

**SUPER_ADMIN-only UI** (no view name / not assignable to restricted admins): `/admin/views` (Admin Views catalog).

---

## LoginView

Route: _(auth)_ · Sidebar: no

```
POST /admin/auth/login
```

## HomeView

Route: `/` · Sidebar: Home · Endpoints: _(none — nav only)_

## AboutView

Route: _(unused)_ · Endpoints: _(none — nav only)_

## UserListView

Route: `/admin/users` · Sidebar: Users

```
GET /admin/users/search
GET /admin/users/search/history
```

## UserDetailView

Route: `/admin/users/:id` · Sidebar: no (companion of UserListView)

```
GET /admin/users/search
GET /admin/users/search/history
GET /admin/users/:id
PATCH /admin/users/:id
PUT /admin/users/:id/tags
GET /admin/users/:id/wallet
GET /admin/users/:id/devices
GET /admin/users/:id/face-verification
DELETE /admin/users/:id/face-verification
GET /admin/users/:id/restrictions
POST /admin/users/:id/restrictions
DELETE /admin/users/:id/restrictions/:restrictionId
POST /admin/users/:id/restrictions/:type/clear
GET /admin/users/:id/vip
GET /admin/users/:id/guardians
GET /admin/users/:id/locations
GET /admin/users/transactions/filter-types
GET /admin/users/:id/transactions/coins
GET /admin/users/:id/transactions/points
GET /admin/users/:id/transactions/trading-coins
GET /admin/transactions/coins
GET /admin/transactions/points
GET /admin/transactions/trading-coins
GET /admin/transactions/coin-trading-transfers
GET /admin/transactions/gifts
GET /admin/transactions/subscriptions
GET /admin/transactions/vip-purchases
GET /admin/transactions/store-purchases
POST /admin/transactions/coins/:ledgerEntryId/revert
POST /admin/transactions/points/:ledgerEntryId/revert
POST /admin/transactions/coin-trading-transfers/:transferId/revert
POST /admin/transactions/gifts/:giftTransactionId/revert
POST /admin/users/:id/wallet/personal-coins/add
POST /admin/users/:id/wallet/personal-coins/deduct
POST /admin/users/:id/wallet/trading-coins/add
POST /admin/users/:id/wallet/trading-coins/deduct
POST /admin/users/:id/wallet/points/add
POST /admin/users/:id/wallet/points/deduct
POST /admin/users/:id/wallet/personal-coins/freeze
POST /admin/users/:id/wallet/personal-coins/unfreeze
POST /admin/users/:id/wallet/trading-coins/freeze
POST /admin/users/:id/wallet/trading-coins/unfreeze
POST /admin/users/:id/wallet/points/freeze
POST /admin/users/:id/wallet/points/unfreeze
POST /admin/users/:id/levels/:type
GET /admin/posts
GET /admin/posts/:postId
DELETE /admin/posts/:postId
POST /admin/posts/:postId/warn
POST /admin/users/:id/posting/suspend
POST /admin/users/:id/posting/ban
POST /admin/users/:id/posting/activate
POST /admin/users/:id/posting/restore
POST /admin/users/:id/password/reset
POST /admin/users/:id/profile/remove-avatar
POST /admin/users/:id/profile/remove-bio
POST /admin/users/:id/profile/reset-identity
POST /admin/users/:id/agency/remove
POST /admin/users/:id/devices/ban
DELETE /admin/devices/:deviceId/ban
```

## UserLocationsView

Route: `/admin/locations` · Sidebar: Locations

```
GET /admin/locations
```

## AgencyListView

Route: `/admin/agency` · Sidebar: Agency

```
GET /admin/agency/stats
GET /admin/agency
GET /admin/agency/applications/pending
GET /admin/agency/applications/rejected
GET /admin/agency/applications/:userId/kyc
POST /admin/agency/:applicantUserId/approve
POST /admin/agency/applications/:applicantUserId/reject
```

## AgencyPayrollView

Route: `/admin/agency-payroll` · Sidebar: Payroll

```
GET /admin/agency/payroll/assignments
GET /admin/agency/payroll/assignments/:assignmentId
GET /admin/agency/payroll/disputed
GET /admin/agency/payroll/pending-platform
POST /admin/agency/withdrawal/:id/assign
POST /admin/agency/withdrawal/:id/reverse
POST /admin/agency/withdrawal/:id/resolve-dispute/favour-agent
POST /admin/agency/withdrawal/:id/resolve-dispute/favour-host
```

## AgencyPayrollAssignmentDetailView

Route: `/admin/agency-payroll/:assignmentId` · Sidebar: no (companion of AgencyPayrollView)

```
GET /admin/agency/payroll/assignments/:assignmentId
POST /admin/agency/withdrawal/:id/assign
POST /admin/agency/withdrawal/:id/reverse
POST /admin/agency/withdrawal/:id/resolve-dispute/favour-agent
POST /admin/agency/withdrawal/:id/resolve-dispute/favour-host
```

## AgencyDetailView

Route: `/admin/agency/:id` · Sidebar: no (companion of AgencyListView)

```
GET /admin/agency/:identifier
GET /admin/agency/:identifier/hosts/earnings
GET /admin/agency/:identifier/commission/history
POST /admin/agency/:identifier/recompute-level
POST /admin/agency/recompute/:agencyUserId
POST /admin/agency/recompute-master
GET /admin/agency/commission/config
PUT /admin/agency/commission/config
PATCH /admin/agency/:identifier/commission-tier
POST /admin/agency/:identifier/hosts
POST /admin/agency/:identifier/transfer-hosts
POST /admin/agency/:identifier/suspend
POST /admin/agency/:agencyUserId/unpause
PATCH /admin/agency/:identifier/payroll
POST /admin/agency/:identifier/ban
POST /admin/agency/barred/:userId/unbar
DELETE /admin/agency/:identifier
POST /admin/agency/users/:userId/wallet/credit
POST /admin/users/:userId/messages/system
```

## SystemSettingsView

Route: `/admin/system-settings` · Sidebar: Settings

Platform + agency coin/point rate catalogues (including Call Price caps). Hydrate once via aggregate GET; each section saves with its own PUT.

```
GET /admin/system-settings/rates
GET /admin/system-settings/host-revenue-shares
PUT /admin/system-settings/host-revenue-shares
GET /admin/system-settings/personal-exchange-rates
PUT /admin/system-settings/personal-exchange-rates
GET /admin/system-settings/coin-packages
PUT /admin/system-settings/coin-packages
GET /admin/system-settings/wallet-level-configs
PUT /admin/system-settings/wallet-level-configs
GET /admin/system-settings/video-call-price-caps
PUT /admin/system-settings/video-call-price-caps
GET /admin/agency/coin-trading/topup-rates
PUT /admin/agency/coin-trading/topup-rates
GET /admin/agency/coin-trading/exchange-rates
PUT /admin/agency/coin-trading/exchange-rates
GET /admin/agency/coin-trading/topup-packages
PUT /admin/agency/coin-trading/topup-packages
GET /admin/agency/commission/levels
PUT /admin/agency/commission/levels
GET /admin/agency/commission/config
PUT /admin/agency/commission/config
GET /admin/agency/payroll/config
PUT /admin/agency/payroll/config
```

## PlatformMessagesView

Route: `/admin/messages` · Sidebar: Messages

```
GET /admin/users/search
POST /admin/users/:userId/messages/system
POST /admin/users/:userId/messages/notification
POST /admin/messages/notifications/broadcast
```

## PushNotificationsView

Route: `/admin/push-notifications` · Sidebar: Push

```
GET /admin/notifications/push/users
GET /admin/notifications/push/stats/today
GET /admin/notifications/push/deliveries
POST /admin/notifications/push/user/:userId
POST /admin/notifications/push/broadcast
GET /admin/users/search
```

## LedgerAuditView

Route: `/admin/ledger-audit` · Sidebar: Ledger Audit

```
GET /admin/ledger-audit/flags
PATCH /admin/ledger-audit/flags/:id
POST /admin/ledger-audit/run
GET /admin/users/search
```

## TransactionsView

Route: `/admin/transactions` · Sidebar: Transactions

```
GET /admin/transactions/coins
GET /admin/transactions/points
GET /admin/transactions/trading-coins
GET /admin/transactions/coin-trading-transfers
GET /admin/transactions/gifts
GET /admin/transactions/subscriptions
GET /admin/transactions/vip-purchases
GET /admin/transactions/store-purchases
POST /admin/transactions/coins/:ledgerEntryId/revert
POST /admin/transactions/points/:ledgerEntryId/revert
POST /admin/transactions/coin-trading-transfers/:transferId/revert
POST /admin/transactions/gifts/:giftTransactionId/revert
GET /admin/users/search
```

## GiftAdminView

Route: `/admin/gifts` · Sidebar: Gifts

```
GET /admin/gifts/analytics
GET /admin/gifts
POST /admin/gifts
PATCH /admin/gifts/:giftId
DELETE /admin/gifts/:giftId
POST /admin/gifts/upload-url
GET /admin/gift-categories
POST /admin/gift-categories
PATCH /admin/gift-categories/:categoryId
POST /admin/gift-categories/reorder
GET /admin/gift-gallery/categories
POST /admin/gift-gallery/categories
PATCH /admin/gift-gallery/categories/:sectionId
POST /admin/gift-gallery/categories/:sectionId/gifts
POST /admin/gift-gallery/categories/reorder
DELETE /admin/gift-gallery/categories/:sectionId
```

## StoreAdminView

Route: `/admin/store` · Sidebar: Store

```
GET /admin/store/analytics
GET /admin/store/items
POST /admin/store/items
PATCH /admin/store/items/:id
DELETE /admin/store/items/:id
POST /admin/store/items/upload-url
GET /admin/users/search
GET /admin/users/:userId/store-items
```

## BannerAdminView

Route: `/admin/banners` · Sidebar: Banners

```
GET /admin/banners
POST /admin/banners
PATCH /admin/banners/:bannerId
DELETE /admin/banners/:bannerId
POST /admin/banners/upload-url
```

## CustomGiftAdminView

Route: `/admin/custom-gifts` · Sidebar: Custom Gifts

```
GET /admin/custom-gifts/config
PUT /admin/custom-gifts/config
GET /admin/custom-gifts/requests
GET /admin/custom-gifts/requests/:requestId
POST /admin/custom-gifts/requests/:requestId/complete
POST /admin/custom-gifts/requests/:requestId/fail
GET /admin/gifts
```

## CustomerSupportView

Route: `/admin/support` · Sidebar: Support

```
GET /admin/support/csas/overview
GET /admin/support/csas
GET /admin/support/csas/failed-logins
POST /admin/support/csas
PATCH /admin/support/csas/:adminId
PATCH /admin/support/csas/:adminId/status
GET /admin/support/csas/export
GET /admin/support/csas/:adminId
GET /admin/support/csas/:adminId/stats
GET /admin/support/csas/:adminId/tickets
GET /admin/support/csas/:adminId/ip-whitelist
POST /admin/support/csas/:adminId/ip-whitelist
DELETE /admin/support/csas/:adminId/ip-whitelist/:whitelistId
POST /admin/auth/admins/:adminId/password/reset
GET /admin/support/me/stats
GET /admin/support/tickets
GET /admin/support/tickets/:ticketId
POST /admin/support/tickets/:ticketId/reply
POST /admin/support/tickets/:ticketId/claim
POST /admin/support/tickets/:ticketId/resolve
POST /admin/support/tickets/:ticketId/close
POST /admin/support/tickets/:ticketId/assign
PATCH /admin/support/tickets/:ticketId/priority
POST /admin/support/tickets/:ticketId/notes
POST /admin/support/upload-url
GET /admin/support/reports
GET /admin/support/reports/:reportId
PATCH /admin/support/reports/:reportId/status
POST /admin/support/reports/:reportId/escalate
```

## SupportTicketDetailView

Route: `/admin/support/tickets/:ticketId` · Sidebar: no (companion of CustomerSupportView)

```
GET /admin/support/tickets/:ticketId
POST /admin/support/tickets/:ticketId/reply
POST /admin/support/tickets/:ticketId/claim
POST /admin/support/tickets/:ticketId/resolve
POST /admin/support/tickets/:ticketId/close
POST /admin/support/tickets/:ticketId/assign
PATCH /admin/support/tickets/:ticketId/priority
POST /admin/support/tickets/:ticketId/notes
POST /admin/support/upload-url
GET /admin/support/csas
```

## OtpAuditLogsView

Route: `/admin/otp-audit` · Sidebar: OTP Audit

```
GET /admin/otp-delivery/audits
GET /admin/otp-delivery/audits/summary
GET /admin/otp-delivery/cost-rates
GET /admin/otp-delivery/costs/monthly
GET /admin/otp-delivery/costs/by-country
```
