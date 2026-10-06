# TravelMate on Render Free

Deploy the `modernize-2026` branch of `Majid-pkz/travelmate-deployment` as two
services, with the existing MongoDB Atlas **Free** cluster. Keep the workspace
on **Hobby** and the backend compute plan on **Free**. Use the included
`onrender.com` addresses; a custom domain is optional and may cost money.

The static frontend is served by Render's CDN and opens even when the API is
asleep. Render Free web services sleep after 15 minutes without requests and
usually need about a minute to restart. The frontend requests the health endpoint
when a visitor opens it, displays a starting message if needed, and stops retries
after 90 seconds with a Try again button. Mounted GraphQL reads refresh when the
API becomes ready after a delay; account/trip submissions are not automatically
retried. This is a portfolio demo with free-tier availability limits.

Both services use included bandwidth/build quotas; the API also shares the
workspace's 750 free instance hours each month. Keep other free services in mind.
If no payment method is added, exceeding applicable quotas suspends services or
disables new builds instead of billing for overages. Track usage in Render Billing.
Do not select paid compute, disks, databases or workspace upgrades for this setup.

## 1. Backend web service

In the [Render dashboard](https://dashboard.render.com), choose **New → Web
Service**, connect GitHub, and select `Majid-pkz/travelmate-deployment`.

| Setting | Value |
| --- | --- |
| Name | `travelmate-api` (or another available name) |
| Branch | `modernize-2026` |
| Runtime | Node |
| Region | Prefer the region closest to your Atlas cluster |
| Root directory | `server` |
| Build command | `npm ci --omit=dev` |
| Start command | `npm start` |
| Compute plan | **Free** |
| Health check path | `/api/health` |

Set these environment variables in Render, not GitHub or the frontend:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Your existing private Atlas connection string |
| `JWT_SECRET` | A private signing secret of at least 32 characters |
| `SERVE_CLIENT` | `false` |
| `TRUST_PROXY_HOPS` | `1` initially; verify the platform proxy path |

`ALLOWED_ORIGINS` is added in step 3 after the frontend address exists. Node 24 is
selected by `server/package.json`. Leave `PORT` to Render and omit `DNS_SERVERS`
unless a hosted DNS failure needs investigation. Do not copy the local `.env`
file wholesale: its port, DNS and development settings are local settings.

Create the service. Copy its real public HTTPS address; do not assume the example
name is available. In the service's **Connect → Outbound** panel, copy the outbound
IP ranges and add those ranges to Atlas **Network Access**. Keep your current local
IP entry if you still test locally. Allowing `0.0.0.0/0` is unnecessary for this
setup. If the first startup failed while Atlas was blocked, deploy again after the
network entries become active. `/api/health` should then return `{"status":"ok"}`.

The existing catalogue is already seeded. Do not run a destructive database reset
or create a new paid database. Profile/trip images are stored in Atlas and survive
Render restarts; there is no persistent disk requirement.

## 2. Frontend static site

Choose **New → Static Site**, connect the same repository, and use:

| Setting | Value |
| --- | --- |
| Name | `travelmate` (or another available name) |
| Branch | `modernize-2026` |
| Root directory | `client` |
| Build command | `npm ci --include=dev && npm run build` |
| Publish directory | `build` |
| Environment variable | `VITE_API_URL=https://YOUR-ACTUAL-API-ADDRESS.onrender.com` |

Use only the backend's origin for `VITE_API_URL`, without `/graphql` or other path.
This value is public and compiled into JavaScript. Changing it requires a rebuild.
No database URI or JWT secret belongs in a static site's environment.

Under **Redirects/Rewrites**, add:

| Source | Destination | Action |
| --- | --- | --- |
| `/*` | `/index.html` | **Rewrite** |

This allows direct visits and refreshes at `/login`, `/trips`, `/my-profile` and
other React routes. Existing asset files are served normally.

## 3. Connect the two addresses

On the backend, set `ALLOWED_ORIGINS` to the frontend's exact public origin,
for example `https://YOUR-ACTUAL-SITE.onrender.com`, without a trailing slash.
Save/redeploy. CORS preflights allow JSON and bearer-token requests from those
configured origins. They do not bypass authentication or ownership checks.
If you later add a custom domain, add its exact HTTPS origin here too, separated
by a comma. Avoid automatic PR preview deployments until their origins are
explicitly configured.

The default proxy setting trusts one hop and takes the nearest forwarded IP,
not an arbitrary client-supplied prefix. Before sharing the demo, verify that
Render forwards the real client address in that position. If the platform has
more hops, inspect its documented/header behavior before changing the count;
never enable unrestricted `trust proxy: true`. Local servers default to no proxy.

## 4. Check the public demo

Open the static-site URL in a private browser window. Check direct page refreshes,
signup/login, profile creation/editing, photo uploads, search, trip creation and
joining as a second account. Confirm that you cannot join your own trip and that
profile/trip photos still load after a backend restart. After 15 minutes without
traffic, revisit the static frontend: the page should open immediately and show
the startup status only while the API is waking.

GitHub checks run real MongoDB/browser workflows in both combined and separate
hosting modes. Public Render/Atlas configuration and cold starts must still be
checked after deployment; a local/CI success does not verify those accounts.

## References

- [Render free services and quotas](https://render.com/docs/free)
- [Render static sites](https://render.com/docs/static-sites)
- [Render web services](https://render.com/docs/web-services)
- [Render outbound IP addresses](https://render.com/docs/outbound-ip-addresses)
- [Static-site rewrites](https://render.com/docs/redirects-rewrites)
- [Express proxy configuration](https://expressjs.com/en/guide/behind-proxies/)
