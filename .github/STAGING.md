# Staging deploy (ol-stag)

Same as `production.yml`: Vite build, pack `dist`, SCP, `ssh 'bash -s' < ec2-unpack-admin.sh`.

Build env points at staging API/live. Unpack uses `APP_USER=ec2-user` and `APP_DIR=/var/www/admins3jinyu.offoolive.com`.

Secrets on Environment `staging`: `STAGING_EC2_HOST`, `STAGING_EC2_USER`, `STAGING_EC2_SSH_PRIVATE_KEY`.

_Redeploy: 2026-08-25T11:42+05:30_
