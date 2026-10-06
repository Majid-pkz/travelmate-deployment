# Travelmate

TravelMate is a web application built with the MERN stack and GraphQL. It aims to connect like-minded individuals who are seeking travel companionship, making it easier to find travelmates based on destination, trip types, and shared interests. The app allows users to connect with potential travel buddies before embarking on their journeys, enabling them to make new friends and enhance their travel experiences.


## Features

* User Registration and Login: Users can create accounts, log in, and manage their profiles.
* Search for Travelmates: Users can search for travelmates based on destinations.
* Connect: Users can connect join trips of other travellers.
* User Profiles: Users can create and manage their profiles, including adding personal information, profile pictures, and travel preferences.

## Technologies Used

* Front-end: React, Vite, Apollo Client, HTML, CSS, MaterialUI, Bootstrap
* Back-end: Node.js, Express, GraphQL, MongoDB
* Authentication: JWT (JSON Web Tokens)
* Image Upload: Multer
* Original deployment: Heroku, MongoDB Atlas
* 2026 modernization: in progress on `modernize-2026`


## Contributing

Contributions to TravelMate are welcome! If you find any bugs, have suggestions for improvements, or would like to add new features, please open an issue or submit a pull request.

## 2026 modernization

This branch continues the original 2023 project and preserves its commit history.
Private environment configuration replaces the hardcoded JWT secret with a
required runtime value. The frontend now uses React 18 and Vite, with standalone
Oxlint checks, updated Axios and React Router 7 packages, and the unused legacy
libraries removed. React components use the `.jsx` extension; the existing
application and routes remain in place. Backend ownership checks, password handling, dependency updates and durable
profile photos are included. Live Atlas validation and deployment remain in progress. These initial updates do not make the application ready for
public use.

Page bundles load on demand. Bootstrap CSS is bundled locally, and navigation,
slideshow and profile-edit controls use keyboard-accessible buttons. Lint checks
cover JavaScript correctness, hook dependencies and accessibility. React Compiler
purity and effect-state checks are not enabled because this app does not use the
React Compiler.

## Private local configuration

1. Install Node.js 24 LTS.
2. Reset any database-user password previously committed to the TravelMate
   repositories. Removing a file from the current tree does not remove older copies.
   Atlas database-user credentials are different from your Atlas account login.
3. Copy `.env.example` to `.env` at the project root.
4. Set `MONGODB_URI` to your connection string with fresh credentials. The example
   uses a separate local database named `travelmate_portfolio`. The application
   reads `MONGODB_URI`, not the historical `MONGO_URI` name.
5. Generate a JWT secret locally and paste its output into `JWT_SECRET`:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

The server loads the root `.env` file automatically from either working directory.
Hosting runtime environment variables take precedence. Never put `JWT_SECRET`
or database credentials in frontend variables or committed files.

Run the configuration checks without installing third-party packages:

```sh
npm run test:config
```

These checks verify environment loading, runtime-variable precedence, required
secret validation and optional DNS configuration. They do not verify database connectivity or complete user flows.
Live Atlas and hosting checks remain pending.

## Local frontend development

From the repository root, install the committed frontend dependency versions:

```sh
npm ci --prefix client
```

Keep the configured backend running on port 3001 in one terminal. Start the
frontend in a second terminal:

```sh
npm start --prefix client
```

Open `http://localhost:3000`. Vite forwards `/graphql`, `/api` and `/images`
requests to `http://127.0.0.1:3001`. It refuses to silently choose another port
when 3000 is already occupied.

## Production frontend build

```sh
npm run build --prefix client
```

This command runs lint checks before building. Output remains in `client/build`,
which matches the existing Express production static-file configuration. To
check that output locally, stop the frontend development server, leave the
backend running, and run:

```sh
npm run preview --prefix client
```

The local preview uses port 3000 and the same API and image proxies. A deployed
frontend needs those requests served or forwarded to the deployed backend;
Vite's local proxy is not part of the static build. Public hosting setup is still
pending.

GitHub Actions checks installation, lint, build, frontend dependency audit, root
configuration tests, and development/preview request forwarding. The frontend
smoke check uses a stub API and does not verify Atlas, account creation, or
authorization.

## Optional local DNS override

If the server reports `querySrv ECONNREFUSED` but `nslookup` successfully resolves
Atlas's SRV record, you can configure a working DNS resolver for the Node process.
For example, add this line to your private root `.env` after checking that Google
Public DNS resolves your cluster:

```dotenv
DNS_SERVERS=8.8.8.8,8.8.4.4
```

Then restart the backend with `npm start` from the `server` directory. This optional
setting accepts comma-separated IPv4 or IPv6 addresses and is applied before the
database connection starts. It affects Node's DNS resolution in this process.
Leave it blank or omit it to use the normal resolver in other environments,
including hosting. Hosted values take precedence over a local file.

## Profile, form and city experience

The profile page uses a round avatar and an explicit Add/Change profile photo action.
The photo editor closes after a successful upload and shows a confirmation; normal
visits keep upload controls hidden. Profile details, interests and created trips
have a responsive layout, with one Edit profile form and visible save/cancel states.
This form includes first name, last name and login email as well as traveller
details. Changing the email requires the current password and rejects an email
already used by another account. Names and email refresh in the profile and trip
cards after saving. Account and traveller changes use separate mutations; if only
the account update succeeds, the editor reports that partial save and remains open
for retry. Passwords are never displayed in the profile: a separate Change password
form checks the current password and confirmation, then signs out all existing
sessions and returns to login with a confirmation.

Sign up, log in, profile creation/editing, trip creation and search use native form
submission. Enter submits ordinary input fields, selects a highlighted city/interest
suggestion first, and keeps newline behavior in biographies and trip descriptions.
Trip validation stays quiet initially, then shows errors on blur or submission;
missing fields and reversed date ranges cannot create a trip. Calendar date values
are sent as YYYY-MM-DD so dates do not shift when a user is in a different timezone.

City suggestions are available in home search, trip departure/destination, and
profile creation/editing. Type at least three characters; results include region
and country hints, and accept free text if a place is missing or the service is down.
Selected values retain the city name to keep existing string-based trips searchable;
region/country hints are not persisted or used as structured geographic filters.

GET /api/locations uses [Open-Meteo geocoding](https://open-meteo.com/en/docs/geocoding-api)
with [GeoNames](https://www.geonames.org/) attribution. It needs no API key on the
[non-commercial free tier](https://open-meteo.com/en/pricing), which has usage limits
and no uptime guarantee. Requests are debounced, bounded to eight results, cached
for one day in a bounded server cache, coalesced and rate limited. There are no new
package dependencies. Review the provider's terms before commercial use.

## Backend validation and durable profile photos

The API now uses Apollo Server 5 with the existing Express app. Account,
profile and trip changes verify the signed-in account and record ownership.
Password changes run the model's hashing hook and revoke older tokens.
Passwords are absent from GraphQL responses. Contact emails are available to
account owners and participants on the same trip, rather than public visitors.

Private pages redirect anonymous, expired or malformed sessions to login.
An account without a profile opens the creation form. My trips includes both
organized and joined trips in separate sections. Search and My trips share compact
cards with organizer profile photos (or initials), readable description previews,
and expandable trip details. Your trips carry an amber Organizing badge; joined
trips carry a green Joined badge and background. Joining does not change a card's
collapsed height. Organizers cannot join their own trip, including through the API.
Older self-membership records display the account only as organizer without deleting
stored records. Profile photos on trip cards reflect the organizer's current photo.

Authenticated users with a profile can upload PNG/JPEG photos up to 2 MB.
The server validates and re-encodes them, limits input to 16 million pixels,
resizes to at most 512 by 512 pixels and removes original image metadata.
New photos live in MongoDB and are served through /api/images; hosting restarts
do not delete them. The original checked-in image URLs remain usable.
Photo storage is subject to the Atlas tier's database capacity.

Trip creation accepts an optional PNG/JPEG photo up to 2 MB, with a local preview.
An organizer can also add or replace a photo on an existing trip from My trips.
The API checks ownership before processing the upload, validates the file and
re-encodes it as JPEG at no more than 1200 by 800 pixels. Trip photos live in
MongoDB and survive server restarts. Search results and My trips show the saved
photo, with the bundled default for trips without one or with an unavailable image.
If an upload fails after trip creation, Retry photo updates the existing trip;
it does not create a second trip.

After pulling, stop both processes and install the locked dependencies:

~~~sh
npm ci --prefix server
npm ci --prefix client
npm run test:config
npm run test:server
~~~

Initialize the interest/trip-type catalogue when needed:

~~~sh
npm run seed
~~~

This command adds missing catalogue entries and preserves accounts, profiles
and trips. It replaces the original destructive demo-data seeder and can be
run again.

Watch mode now uses Node's built-in watcher. For the combined development command,
install the root development dependency without running the old install hook:

~~~sh
npm ci --ignore-scripts
npm run develop
~~~

GitHub Actions uses a disposable MongoDB service for ownership, password,
profile, trip and image integration tests. A Chromium test also completes the
real production signup, profile/photo editing, trip creation/joining and
logout/login flows. It never uses the private Atlas connection.

Local integration tests require MONGODB_TEST_URI to explicitly identify a
disposable local database whose name starts with travelmate_test_. The tests
clear that database. They do not read MONGODB_URI.

~~~sh
npm run test:integration --prefix server
~~~

Live Atlas checks, hosting, image-asset optimization and portfolio presentation
remain to be completed.
