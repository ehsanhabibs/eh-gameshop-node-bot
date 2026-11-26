# EH Gameshop deployment source policy

- Uploaded project version: 1.2.12
- Canonical application source: repository root.
- Railway Dockerfile builds directly from the repository root.
- `ehgs-source.zip` is obsolete and is not a build input.
- Never nest an application ZIP inside another deployment ZIP.
- Future project ZIP uploads must be mirror-synced into the repository root.
- The uploader preserves `.github`, deployment files, secrets, MongoDB-backed data configuration and `PrivateUploads`.
- Docker build runs `npm run check` and `npm test`; a failed check/test stops deployment.
- Runtime logs print the package version and canonical source marker.
