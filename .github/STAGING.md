# Staging deploy (ol-stag)

Push to `staging` builds the Vite admin SPA on GitHub Actions (pointed at staging API/live URLs) and unpacks it to the nginx root on **ol-stag**.

- App dir: `/var/www/admins3jinyu.offoolive.com`
- URL: https://admin-staging.offoolive.com
- Build-time env: `VITE_API_BASE_URL=https://api-staging.offoolive.com/api/v1`, `VITE_LIVE_API_BASE_URL=https://live-staging.offoolive.com/api`

## GitHub configuration (once)

**Settings → Environments → New environment → `staging`**

Secrets (on that environment or repo Actions secrets):

| Name | Value |
|---|---|
| `STAGING_EC2_HOST` | `3.110.118.179` |
| `STAGING_EC2_USER` | `ec2-user` |
| `STAGING_EC2_SSH_PRIVATE_KEY` | Full PEM for `ssh ol-stag` |

Same three secrets must exist on **ol-node**, **Live-server**, and **ol-admin**.

ol-stag security group must allow inbound **TCP 22** from GitHub-hosted runners (or `0.0.0.0/0` if you already open SSH that way).
