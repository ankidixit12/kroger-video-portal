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

The UI changes needed are mainly around integrating the QUMU Search API and Master Data API so Staffbase can support video discovery, pagination, title search, metadata filters, and playback.

1. Authentication update
All UI API calls should use the Staffbase Bearer token going forward instead of Basic Auth.

Current header:



Authorization: Basic <encoded-credentials>
Expected future header:



Authorization: Bearer <staffbase-token>
This applies to both QUMU APIs:



GET /staffbase-qumu/kulus
POST /staffbase-qumu/kulus
GET /staffbase-qumu/kulus/masterdata/kulutypes
Base URL:



https://staffbase-qumu-gfe9e3e8ced6g3cu.eastus2-01.azurewebsites.net
2. Video listing with pagination
The UI should call the QUMU Search API to retrieve videos in pages.

API:



GET /staffbase-qumu/kulus?offset={offset}&limit={limit}
Example:



GET https://staffbase-qumu-gfe9e3e8ced6g3cu.eastus2-01.azurewebsites.net/staffbase-qumu/kulus?offset=0&limit=10
UI expectation:

Add pagination or infinite scroll.

Use offset and limit to fetch the next set of videos.

Use the total value from the response to know when all videos are loaded.

Render videos from kulus[].

Important response fields for UI:



{
  "kulus": [],
  "total": 12
}
3. Title-based video search
The UI should support searching videos by title using the search query parameter.

API:



GET /staffbase-qumu/kulus?offset={offset}&limit={limit}&search=title,is,{searchText}
Example:



GET https://staffbase-qumu-gfe9e3e8ced6g3cu.eastus2-01.azurewebsites.net/staffbase-qumu/kulus?offset=0&limit=10&search=title,is,Go%20blink
UI expectation:

Add a search input field.

On user search, call the GET endpoint with the search parameter.

Reset offset to 0 when a new search is performed.

Display matching videos and update pagination based on the returned total.

4. Division/category filter dropdowns
The UI should show metadata filters such as Division and Category. These dropdown options should not be hardcoded. They should come from the Master Data API.

API to fetch filter options:



GET /staffbase-qumu/kulus/masterdata/kulutypes?titles={titles}
Single title example:



GET https://staffbase-qumu-gfe9e3e8ced6g3cu.eastus2-01.azurewebsites.net/staffbase-qumu/kulus/masterdata/kulutypes?titles=Division
Multiple titles example:



GET https://staffbase-qumu-gfe9e3e8ced6g3cu.eastus2-01.azurewebsites.net/staffbase-qumu/kulus/masterdata/kulutypes?titles=Division%2CCategory
UI expectation:

On widget load, call the Master Data API.

Populate dropdowns using metadata[].options[].

Display readable values like Fred Meyer, Atlanta, New Hire.

Store/use the corresponding GUIDs when making filtered search requests.

Example mapping from response:



{
  "guid": "Twqc1qOMKchTv3teaUYulJ",
  "title": "Division",
  "options": [
    {
      "guid": "9PNJ20vcUeiJaxyiMOKbnh",
      "value": "Fred Meyer"
    }
  ]
}
Here:

Twqc1qOMKchTv3teaUYulJ = Division field GUID

9PNJ20vcUeiJaxyiMOKbnh = Fred Meyer option GUID

5. Filtered video search using POST
When the user selects Division, Category, or other metadata filters, the UI should call the same QUMU Search API using POST.

API:



POST /staffbase-qumu/kulus?offset={offset}&limit={limit}
Example:



POST https://staffbase-qumu-gfe9e3e8ced6g3cu.eastus2-01.azurewebsites.net/staffbase-qumu/kulus?offset=0&limit=10
Request body:



{
  "playlist": {
    "matchAll": false,
    "rules": [
      {
        "comparator": "CONTAINS",
        "field": {
          "guid": "Twqc1qOMKchTv3teaUYulJ"
        },
        "value": "9PNJ20vcUeiJaxyiMOKbnh"
      }
    ]
  }
}
UI expectation:

Build playlist.rules[] based on selected filter values.

Use the metadata field GUID from the Master Data API.

Use the selected option GUID as the rule value.

Use matchAll: false if results can match any selected filter.

Use matchAll: true if results must match all selected filters.

Reset pagination when filters change.

6. Video card rendering
The UI should render each video from the kulus[] response as a video card.

API source:



GET /staffbase-qumu/kulus
POST /staffbase-qumu/kulus
Fields to use:

UI element

Response field

Video title

kulus[].title

Thumbnail

kulus[].thumbnail.cdnUrl or kulus[].thumbnail.url

Duration

kulus[].duration

Publisher

kulus[].publisher.name

Author

metadata[] where title = "Author"

Division

metadata[] where title = "Division"

Category

metadata[] where title = "Category"

State

kulus[].state

Player URL

kulus[].player

Media URL

kulus[].media.url or kulus[].media.variants[]

UI expectation:

Show thumbnail, title, duration, publisher/author, and metadata tags.

Convert duration from milliseconds to readable format, for example 333083 → 05:33.

Use thumbnail.cdnUrl first if available; otherwise fallback to thumbnail.url.

Open or embed playback using player.

Optionally use media.variants[] for direct MP4 playback if required.

7. Published vs withdrawn video handling
The API returns video state in:



"state": "PUBLISHED"
or



"state": "WITHDRAWN"
UI expectation:

In Viewer Mode, show only PUBLISHED videos if withdrawn content should not be visible to associates.

In Editor/Admin Mode, optionally show a badge for video state.

Clearly distinguish WITHDRAWN videos if they are shown in authoring mode.

Short version
UI needs to integrate these APIs:



GET /staffbase-qumu/kulus?offset={offset}&limit={limit}
For paginated video listing.



GET /staffbase-qumu/kulus?offset={offset}&limit={limit}&search=title,is,{searchText}
For title search.



POST /staffbase-qumu/kulus?offset={offset}&limit={limit}
For Division/Category filtered video search using playlist rules.



GET /staffbase-qumu/kulus/masterdata/kulutypes?titles=Division
or



GET /staffbase-qumu/kulus/masterdata/kulutypes?titles=Division%2CCategory
For loading filter dropdown values and GUID mappings.

Overall, the UI needs to support Bearer token authentication, paginated video listing, title search, metadata-driven filters, video card rendering, and state handling for PUBLISHED vs WITHDRAWN content.