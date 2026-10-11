::: {align="center"}
LastPlate
Good Food Deserves Another Chance.
A food-rescue platform that connects surplus food donors with verified
nonprofits, shelters, and community kitchens---with volunteers helping
move food to the people who need it.
Live Demo · GitHub
Repository
:::
---
Overview
LastPlate helps reduce avoidable food waste by making surplus-food
redistribution easier to coordinate and track. Restaurants, hotels,
cafés, hostels, and event organisers can list available food; verified
recipient organisations can request suitable donations; and volunteers
can coordinate pickups and handovers.
The platform supports four roles---Donor, Recipient, Volunteer, and
Admin---with role-specific workflows and recorded donation and
delivery status changes.
Key Features
Donors
Create, edit, draft, publish, and cancel surplus-food listings.
Add food details, photos, pickup information, and deadlines.
Review recipient requests and track donation status.
Recipients
Discover available donations on a map.
Filter and sort listings and request suitable food.
View a handover code after a pickup is confirmed.
Volunteers
Find pickup tasks within their service radius.
Accept and manage delivery tasks.
Complete handovers using a recipient's four-digit code or report an
issue.
Administrators
Review and verify organisations.
Manage users and moderate listings or reports.
View operational analytics, audit logs, and AI-assisted or
rule-based insights.
Shared capabilities
Account registration, login, logout, and password recovery.
Role-based access and organisation verification.
Notifications and optional email delivery when SMTP is configured.
Donation and delivery status history.
Donation discovery using Leaflet and OpenStreetMap.
Optional AI-assisted listing suggestions and platform guidance, with
rule-based fallbacks when an AI provider is not configured.
> **Food-safety note:** AI features do not determine whether food is
> safe, fresh, or edible. Food safety must be assessed by people
> following appropriate procedures.
Tech Stack
The repository is built around the following technologies and
integrations:
Area                         Technologies
---
Full-stack framework         Next.js 16 (App Router)
Language                     TypeScript
Database                     PostgreSQL
ORM / database access        Prisma
Styling                      Tailwind CSS
Validation                   Zod
Maps                         Leaflet, OpenStreetMap
Testing                      Vitest
Local database environment   Docker Compose
Deployment configuration     Render
Optional integrations such as an AI provider and SMTP email service
depend on environment configuration.
Getting Started
Prerequisites
Install the following before running the project locally:
Node.js 20.19 or newer
npm
PostgreSQL 16, or Docker with Docker Compose
1. Clone the repository
``` bash
git clone https://github.com/Ayush-Parihar-Singh/my-new-project-on-fsd.git
cd my-new-project-on-fsd
```
2. Install dependencies
``` bash
npm install
```
3. Start PostgreSQL
If you use the included Docker Compose configuration:
``` bash
docker compose up -d db
```
Alternatively, use an existing PostgreSQL instance and configure its
connection string in your environment file.
4. Configure environment variables
Copy the example file:
``` bash
cp .env.example .env
```
On Windows Command Prompt, use:
``` bat
copy .env.example .env
```
Update the values in `.env` for your local setup. At minimum, configure
the variables required by the application, including:
`APP_URL`
`APP_ENV`
`APP_SECRET`
`DATABASE_URL`
`DIRECT_URL`
For production or scheduled expiry processing, configure `CRON_SECRET`
as well. Optional AI, email, and storage settings are documented in
`.env.example`.
Security: Never commit `.env` or publish real credentials, API keys,
or production secrets.
5. Apply database migrations and seed demo data
``` bash
npm run db:apply-sql
npm run db:seed
```
The seed command creates fictional demo organisations, donations, and
activity records for exploring the app.
6. Run the development server
``` bash
npm run dev
```
Open http://localhost:3000 in your browser.
Demo Accounts
The seed data creates demo accounts for the main roles. Use the
credentials documented in the repository's current README and
environment configuration. Demo accounts and records are intended for
local evaluation; do not use demo credentials in production.
Useful Commands
Command                      Purpose
---
`npm run dev`                Start the development server
`npm run build`              Build the production application
`npm run start`              Start the production build
`npm test`                   Run the test suite
`npm run test:unit`          Run unit tests
`npm run test:integration`   Run integration tests
`npx tsc --noEmit`           Run TypeScript type checking
`npm run db:seed`            Seed demo data
`npm run db:generate`        Generate the Prisma client
See `package.json` for the complete list of available scripts.
Project Structure
``` text
.
├── docs/              # Architecture and deployment documentation
├── prisma/            # Database schema and SQL migrations
├── public/             # Static assets
├── scripts/            # Database and maintenance scripts
├── src/
│   ├── app/            # Next.js routes and API route handlers
│   ├── components/     # UI, forms, dashboards, maps, and shared components
│   ├── domain/         # Domain rules and workflows
│   ├── server/
│   │   ├── auth/       # Authentication and access guards
│   │   ├── services/   # Application business logic
│   │   ├── repositories/ # Database access
│   │   └── integrations/ # Email, storage, and AI integrations
│   ├── validation/     # Shared validation schemas
│   └── lib/            # Shared utilities and configuration
└── tests/              # Unit and integration tests
```
Security and Privacy
Passwords are hashed and sessions use secure cookie settings.
Sensitive operations enforce authorization on the server.
Rate limits protect authentication and other important write
operations.
Exact pickup details are restricted to relevant participants rather
than exposed publicly.
Application secrets must be configured through environment
variables.
Review the project documentation and deployment configuration before
deploying to production.
Deployment
The live application is available at:
https://lastplate.onrender.com/
Deployment-specific instructions and environment configuration should be
reviewed in the `docs/DEPLOYMENT.md` file and `render.yaml` before
deploying another instance.
Future Improvements
Potential areas for further development include: - More granular impact
reporting for rescued meals and participating organisations. -
Additional accessibility and usability testing. - Scalable private image
storage and background processing for production workloads. - More
robust notification delivery and monitoring.
Contributing
Contributions and suggestions are welcome. For a change, create a
branch, make focused updates, run the relevant tests, and open a pull
request with a clear summary.
License
Check the repository for the applicable license before redistributing or
reusing this project.
---
::: {align="center"}
LastPlate --- helping good food reach people, not landfills.
:::