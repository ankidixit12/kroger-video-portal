https://staffbase-qumu-service-gfh7bccrescea0fe.eastus-01.azurewebsites.net/staffbase-qumu/kulus?page=1&perPage=5&sort=-updatedAt  
qumu
qumu@123456

https://www.youtube.com/watch?v=62XccJOh9Lg&list=RD62XccJOh9Lg&start_radio=1

https://krogertest.staffbase.com/api/v3/contents/6a14117c2177a638300f8553

https://krogertest.staffbase.com/api/articles/6a14117c2177a638300f8553

https://krogertest.staffbase.com/api/iframely?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D62XccJOh9Lg%26list%3DRD62XccJOh9Lg%26start_radio%3D1&nowrap=on&callback=

front door-> https://videowidget-frontdoor-gxfwf7a3cygtbjf7.a01.azurefd.net/
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

POC if Custom widget can access, use, and respect the user's active Staffbase session — without requiring separate authentication.



Selected


Improve work item

Key details
Acceptance Criteria

Confirm which session/auth fields are accessible via the widget SDK

Document token lifecycle (expiry, refresh) from within a widget

Proof-of-concept: widget making an authenticated API call using the session token

Description

Explore what the Widget SDK / web component lifecycle exposes (e.g., accessToken, user claims, locale.
Session Expiry & Re-auth Handling in the Widget


curl --location --request PUT 'https://krogertest.staffbase.com/api/posts/6a34f73e8ca631260ef03dc0' \
--header 'Content-Type: application/json' \
--header 'Accept: application/json' \
--header 'Authorization: Basic NmEwMzhmMWExMGIwZGQ3Mzc5NDI0Nzk2OnZHSkR3NSYhS2hoXm4uS3pwJkZxfjR+WXFyTkg5TiktTmxiOylJaFRuelNfZC0wM2FUMHlbMDBWcVRdN0gpdX4=' \
--data '{
    "contents": {
        "en_US": {
            "image": "https://cdn.qumucloud.com/asset/kroger-sbx.qumucloud.com/6X1uKGKZ5rEW1ft4PNTBar;wc=1920;hc=1080?delivery=INLINE&format=canonical&qedtoken=eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJxdW11Y2xvdWQ6a3JvZ2VyLXNieCIsInN1YiI6IiQkT1JJR0lORE9XTkxPQUQkJCIsIm5iZiI6MTc4MTg1NDc3NywicXVtdTpxdWVyeUhhc2giOiI0NGEyMDUxZGM3N2NmNTAwNTc0MzIwOTk2MTBhMGJiODRjYjFkMTJjMDJkMTc4ZTA5NDY5OGQ5M2IzMzU3YWVmIiwicXVtdTpwYXRoSGFzaCI6ImIyN2U4MmFkM2U3OTM4YjQwOWI3MzBmYjI0NGJiYTE4NzdkOGZmOTViOTM4ODYwNmRhZjk4MGYwMmI1OTMxODgiLCJpc3MiOiJrcm9nZXItc2J4LmRzLnF1bXVjbG91ZC5jb20iLCJleHAiOjE3ODIxMTM5Nzd9.LnzWcZjGTEaewZaq3OY91FjERPMXC2gfFAYUmF2ggDY%22,
            "teaser": "This teaser should be text only."
        }
    },
    "notificationChannels": [
        "email",
        "push"
    ]
}'