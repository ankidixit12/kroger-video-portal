https://staffbase-qumu-service-gfh7bccrescea0fe.eastus-01.azurewebsites.net/staffbase-qumu/kulus?page=1&perPage=5&sort=-updatedAt  
qumu
qumu@123456

## Qumu Widget CORS Lock (Staffbase Origin)

This repository now includes Azure Static Web Apps CORS headers for the Staffbase widget build:

- `staffbase-widget/public/staticwebapp.config.json`
- Allowed origin: `https://kroger.staffbase.com`

Because `public/` is copied into `dist/` during build, this config is deployed with the widget files and applies to hosted static assets.

## Deploy + Install In Staffbase

1. Push this change to `main`.
2. Wait for GitHub Action `Azure Static Web Apps CI/CD` to finish.
3. Open the deployed widget script URL from your Azure SWA domain (for example `/kroger-video-widget.js`).
4. In Staffbase Admin, open the widget/plugin setup and use that script URL.
5. Verify in browser DevTools (Network) that widget responses include:
	- `Access-Control-Allow-Origin: https://kroger.staffbase.com`

## Important Limitation

This controls browser CORS policy for requests, but it is not a hard authentication mechanism. Direct URL access is still possible if someone knows the file URL.