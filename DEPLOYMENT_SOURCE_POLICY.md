# EH Gameshop deployment source policy

- Uploaded project version: 1.2.15
- Canonical application source: repository root (mirror-synced from the project ZIP).
- The Docker build runs `npm run check` and `npm test`; a failure stops deployment.
- `.env`, `data.json`, `PrivateUploads`, `.github` and deployment files are preserved by the uploader.
