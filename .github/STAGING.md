# Staging deploy (ol-stag)

Same flow as this repo's `production.yml`: GitHub Actions builds Vite `dist`, SCPs the tarball to `/tmp`, then runs `.github/deploy/ec2-unpack-admin.sh` via `ssh … 'bash -s'`.

Do not use OIDC / S3 / SSM for staging. Secrets are already configured on Environment **staging**.

| | |
|---|---|
| Nginx root | `/var/www/admins3jinyu.offoolive.com` |
| URL | https://admin-staging.offoolive.com |
| API | `https://api-staging.offoolive.com/api/v1` |
| Live | `https://live-staging.offoolive.com/api` |

## GitHub

**Settings → Environments → `staging`**

| Secret | Value |
|---|---|
| `STAGING_EC2_HOST` | `3.110.118.179` |
| `STAGING_EC2_USER` | `ec2-user` |
| `STAGING_EC2_SSH_PRIVATE_KEY` | PEM for `ssh ol-stag` |

Deploy one app at a time on ol-stag.
