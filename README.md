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
application and routes remain in place. Authorization, password handling, UI
reliability, backend dependency updates, durable image uploads and deployment
remain in progress. These initial updates do not make the application ready for
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
Complete user flows and backend security still need validation.

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
