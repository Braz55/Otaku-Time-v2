# Otaku Time Pro (v3.5)

**Your smart, cloud-based, and centralized Anime, Manga, TV Series & Movie tracker.**

Otaku Time Pro is a complete Fullstack ecosystem designed to **register, organize, and track the progress** of all your favorite works (Anime, Manga, TV Shows, and Movies). With a modern architecture that connects both your PC browser and your Android mobile app directly to a centralized cloud database, you can manage your library with real-time synchronization.

The platform automates release schedules via integrations with AniList and TMDB APIs, tracks manga chapters across multiple portals, supports TV Time JSON imports, and features a highly customizable and fluid interface.

A pre-compiled Android build is available at **[`testes_e_scripts/otakuTime_V3.apk`](testes_e_scripts/otakuTime_V3.apk)**, ready for installation.

Production Applications:
* Frontend Web & API: [https://otaku-time-v2.onrender.com](https://otaku-time-v2.onrender.com)
* Database: Hosted remotely on Aiven Cloud (PostgreSQL)

---

## Main Features & Updates (v3.5 - TV Time & TMDB Integration)

### 1. Cloud Ecosystem & Centralized Database (Aiven + Render)
* **PostgreSQL Database (Aiven)**: Remote cloud PostgreSQL accessed through a `pg` connection pool (Prisma `adapter-pg`) with SSL, keeping library state in sync across all user devices.
* **Continuous Hosting**: The NestJS API and React SPA are fully deployed and hosted on Render with automated CI/CD.
* **Keep-Awake System**: A GitHub Actions workflow ([`keep-awake.yml`](.github/workflows/keep-awake.yml)) pings the `/health` endpoint every 10 minutes during active hours so the Render free instance doesn't sleep. On the server, a `KeepAwakeService` tracks user activity and skips scheduled syncs when nobody has used the app in the last 2 hours, saving database resources.
* **Admin Sync Reports**: When a full anime/manga synchronization finishes, the server emails a report to admin accounts (via SMTP/Nodemailer) with its status and the list of synced titles.

### Security
* **HttpOnly Cookie Auth**: JWT access and refresh tokens are issued as HttpOnly cookies (`otaku_access_token` / `otaku_refresh_token`) instead of being stored in `localStorage`.
* **Rate Limiting**: Global request throttling (`@nestjs/throttler`, 100 requests/min) protects login and other endpoints against brute-force attempts.
* **Sanitized Responses**: Passwords and other sensitive fields are never returned by the API.

### 2. Native Android Experience (via Capacitor)
* **Direct Cloud Synchronization**: Real-time read and write operations to the cloud database directly from your Android mobile app.
* **Backup and Portability**: Easily generate and download JSON backup files of your entire library (items, progress, preferences) and restore them anytime.

### 3. Smart Random Draws (Gacha / Raffle)
* **Global Draw**: Pull a random popular title (rank 1 to 2000) directly from the AniList API using the dice button on the search bar.
* **Library Planner Draw**: A smart shuffle button in your library pulls a title from your planned list using a custom probability algorithm weighting priority (1 to 10) and publication status (75% FINISHED vs 25% RELEASING).

### 4. Multi-Category Premium Tracking Dashboard (Anime, Séries, Filmes & Mangas)
* **Unified Tracking Hub**: Home screen with dedicated tracking sections for "WATCH NEXT" (Anime & TV Series), "READ NEXT" (Manga), and "MOVIES" (Filmes).
* **Divided Library Structure**: Library catalog split into clean categories (Anime, Séries, Filmes, Manga) with filters for tracking status.
* **Optimistic UI Updates**: Immediate client-side progress updates when incrementing watched episodes or read chapters, syncing in the background with the server.
* **Automatic Progression**: Automatic library status transition to "WATCHING" / "READING" when changing progress from 0 to 1, and to "COMPLETED" when reaching the final episode or chapter (never while the work is still releasing).
* **Upcoming Section**: Anime that hasn't premiered yet gets its own section on the home page and moves automatically to "Watch Next" once its first episode airs.
* **Auto-Refresh on Resume**: The dashboard reloads when you return to the app, so the "Up Next" carousel always reflects the latest episodes.

### 5. TV Time-Style Personal Calendar
* **Airing Schedule Mapping**: Automatically maps upcoming release schedules for continuing works present in your personal library.
* **Interactive TV Time Layout**: A redesigned calendar layout featuring a compact date selector on the left and a scrollable list of releases on the right categorized into sections: Yesterday, Today, Tomorrow, Next Week, and Later.
* **Database Optimization**: Optimised performance for loading releases quickly by caching schedules locally, preventing loading slowness.
* **Time Zone Localization**: Localizes episode release schedules on-the-fly to the user's timezone.

### 6. Triple Chapter Tracking (Manga)
* **Multi-Source Engine**: Prevents chapter mismatches by querying MangaUpdates (Plan A) for accurate counts and special divisions, falling back to MangaDex (Plan B) or AniList API metadata (Plan C).

### 7. Interactive Native In-App Browser (Android Only)
* **Custom Web Browser**: Integration of a custom native Android web browser view (`MangaWebView`) accessible via a dedicated floating action button.
* **Enhanced Navigation Control**: Standard browser navigation where the Android back button navigates back in the browser's web history instead of exiting the view.
* **Chrome-like Multi-Tab Support**: Support for opening multiple tabs, easy tab switching, and seamless redirect/popup handling.
* **Background Bookmark Association**: An automated sync listener (`onAssociateBookmark`) that intercepts bookmarked sites in the native browser, extracts their domains, and automatically saves them as custom personal links under the active anime/manga details in the user's library.

### 8. Real-Time Release Notifications System
* **Automated Tracked Releases**: In-app notifications are automatically generated when background content synchronization runs and detects a new release (new episode/chapter, including special episodes) for works in the user's library. An hourly job checks locally stored airing schedules, and notifications older than 48 hours are automatically marked as read.
* **Targeted Library Subscriptions**: Only triggers notifications for works currently marked as "WATCHING" (Anime) or "READING" (Manga) to avoid unwanted alerts.
* **Interactive Inbox**: Custom interactive notifications dropdown/inbox on both desktop and mobile headers with options to mark individual items as read, clear all notifications, delete specific alerts, and navigate directly to the media details page on click.

### 9. Visual Themes & Preferences
* **Modern Themes**: Clean interface with Dark and Light modes and smooth transitions.
* **Color Palettes**: Features 6 interchangeable chromatic color themes: Classic Purple, Shounen Orange (Crunchyroll), Akatsuki Red (Naruto), Mutsu Green (Mushi-Shi), Solo Leveling Purple, and Visionary Blue (AniList).
* **Language & Filters**: Toggle languages (Portuguese/English) and adult content filters (NSFW) directly in user profile settings.
* **Custom Artwork**: Pick an alternative poster or banner for any title in your library through the artwork selector on the Details page.

### 10. Global Ratings & Community Comments
* **Dynamic Evaluations**: Score anime, series, movies, and manga titles, dynamically recalculating the average global score on the backend.
* **Community Comments**: Dedicated comment sections per media title with commenting, deletion, and authenticated likes (one like per user per comment).

### 11. Fun Achievement & Badge System
* **Dynamic Achievements**: Fun badges dynamically unlocked when users hit milestones. Includes image URL badges, descriptions, and rarity tiers (Common, Rare, Epic, Legendary).

### 12. Admin Panel
* **Administrative Controls**: An admin tab on the profile page with system stats, manual AutoSync triggering (anime & manga), user role management, achievement management, and recent sync logs. (The former PRO tier / Gift Code subscription system has been removed.)

### 13. Social Sharing & Public Profiles
* **Public Profiles**: Browse other users' libraries, stats, and top titles by visiting `/user/profile/:id`.
* **Top 3 Showcase**: Pin up to 3 favorite titles to showcase at the top of your public profile.
* **Custom Bio/Status**: Set a custom status message displayed under your profile banner.

### 14. Advanced Explore Catalog (Anime & Manga)
* **Hybrid Multiselect Filters**: Custom dropdown to filter titles by multiple genres concurrently, combined with an advanced tag selector modal categorizing hundreds of thematic tags (e.g., formats, themes, casts).
* **Targeted Search Parameters**: Custom query filters for release years, airing seasons, formats (TV, movie, special, OVA, ONA, manga, novel, one-shot), publishing status, and country of origin.
* **Local Library Exclusion**: Checkbox filters to isolate the search by hiding titles already present in the user's library or only showing active library items.
* **Flexible Sorting Options**: Fast sort orders including Em Alta (Trending), Mais Populares (Popularity), Mais Bem Avaliados (Score), and Mais Recentes (Start Date).

### 15. Personalized Thematic Recommendations ("Feito para si" - DIBI Engine)
* **DIBI Engine**: Dynamically builds a personalized recommendation feed for the user's Explore page based on their active library items.
* **Isolated Tastes Profile**: Tastes are extracted separately for Anime and Manga libraries to ensure targeted recommendations.
* **Thematic Co-Occurrence Clustering**: Groups similar genres and tags (e.g., `["Action", "Martial Arts", "Superpowers"]`) to retrieve multi-tag matches from the AniList API.
* **Local Overlap Re-ranking**: Dynamically re-ranks candidates based on tag overlap with the user's library profile.
* **Country Preference Support**: Detects preferred country of origin (e.g., Korea for Manhwa, Japan for Manga) and filters recommendation feeds accordingly.

### 16. Custom Lists System (Sistema de Listas Customizadas)
* **Custom Collections**: Create, manage, and delete custom lists beyond default statuses (e.g., "Favorites", "To Buy", "Summer Marathon").
* **Manual Reordering**: Supports custom reordering of list items, featuring HTML5 drag-and-drop on Web and custom sorting control arrows on mobile.
* **Visibility Control**: Configure individual custom lists to be public (visible to other users visiting your profile) or private.

### 17. Dynamic 50/50 Highlights Engine (Destaques Inteligentes)
* **Probability-Based Hero**: The HomePage hero highlight features a 50/50 probability system that selects either a recently active item (from the profile's recent activity) or an "Up Next" high-priority item that has been gathering dust (not updated in a long time).
* **Dynamic Badges**: Displays contextual tags depending on why it's highlighted: "A ver mais no momento" / "A ler mais no momento" for recent activity, or "A apanhar pó na lista" for long-neglected high-priority works.
* **Empty List Fallback**: If the user has no active items in progress (watching/reading), the hero banner falls back to suggesting a random work from their library list (prioritizing `PLANNED` and `PAUSED` items) with the badge `"Sugestão da tua lista"`.
* **New Release Badging**: Displays contextual tags like "Novidade" or "Novo EP" when new episodes or chapters are detected and synced.

### 18. User Recent Activity Feed (Atividade Recente)
* **Automatic Activity Logs**: Whenever you increment your watched episodes or read chapters, the system updates `lastProgressUpdate` in the database.
* **Profile Activity Feed**: Displays the 3 most recently updated items on the profile page, complete with relative time formats (e.g., "Updated 2 hours ago").

### 19. TMDB Integration & Multi-Category Library (Anime, Séries & Filmes)
* **Full TMDB API Engine**: Integrates with the TMDB (The Movie Database) API to query and track TV series, western shows, documentaries, and movies, broadening scope beyond traditional anime.
* **English Title Fallbacks**: Automatically fetches English titles from TMDB/AniList as fallbacks for titles not fully translated in Portuguese.

### 20. TV Time JSON Library Import
* **Seamless Sync**: Users can import their existing tracking history from TV Time by uploading standard export JSON files.
* **Smart Progress & Status Handler**: Mapped series are imported with correct episodes and seasons, and ongoing shows are automatically set to `WATCHING` (A ver) status rather than marking them as completed.

### 21. Interactive Episode Checklist & Season Selector
* **Detailed Progress Tracker**: Revamped Details page featuring an interactive list of episodes categorized by season (TV Time-style) to check off watched episodes individually.
* **Specials Tracking**: Supports checking off special episodes and seasons without disrupting the main episode progression.
* **Fresh Episode Data**: Opening the Details page refreshes episode counts and air dates in the background, and a dedicated button forces an update of the episode dates on demand.
### 22. Confirmed Continuations Section
* **Airing Status Planning**: Under the "Up to Date" (Em dia) page, a new section shows tracked anime/series that are officially confirmed to continue but do not have upcoming release dates scheduled yet.

### 23. Manga Chapter Flex-Tracking
* **Over-Limit Increments**: Allows marking chapters as read beyond the officially synchronized release count, updating progress while leaving other metadata intact.

---

## System Architecture

```mermaid
flowchart TD
    subgraph Cloud ["Cloud & Production (Render + Aiven)"]
        FE_Render["Frontend (Render SPA) \n otaku-time-v2.onrender.com"]
        BE_Render["Backend (Render Web Service) \n api-otaku-time"]
        DB_Aiven[(PostgreSQL - Aiven)]
        GH_Actions["GitHub Actions \n keep-awake ping"]
    end

    subgraph Device ["Local Client (Web & Mobile)"]
        Browser["Web Browser (Desktop/Mobile)"]
        Capacitor["Android App (Capacitor)"]
    end

    subgraph External_Sources ["External Data & Metadata Sources"]
        AniList["AniList GraphQL API"]
        BakaUpdates["Baka-Updates API"]
        MangaDex["MangaDex API"]
        TMDB["TMDB API (Series & Movies)"]
    end

    %% Communication relationships
    Browser -->|Accesses| FE_Render
    
    FE_Render -->|REST Requests| BE_Render
    Browser -->|REST Requests| BE_Render
    Capacitor -->|REST Requests| BE_Render
    
    BE_Render ---|"Prisma ORM"| DB_Aiven
    GH_Actions -->|"GET /health"| BE_Render
    
    BE_Render -->|Metadata & Releases| AniList
    BE_Render -->|Chapters & Seasons| BakaUpdates
    BE_Render -->|Chapter Fallback| MangaDex
    BE_Render -->|Metadata & Episodes| TMDB
```

### Synchronization Engine

For a detailed technical breakdown of our background synchronization engine (including cron schedules, anime/manga multi-source update flows, and auto-transition rules), please check the dedicated documentation:
* 📄 **[Mecanismos de Sincronização (PT-PT)](docs/sincronizacao.md)**

### Recommendation Engine (DIBI Algorithm)


```mermaid
graph TD
    A["User Library: Completed/Watching"] --> B["Separate by Media Type: Anime vs Manga"]
    B --> C["Extract Tag & Genre Weights"]
    B --> C2["Count paisOrigem to get Preferred Country"]
    C --> D["Identify Top Anchor Tastes"]
    D --> E["Build Thematic Co-occurrence Profiles"]
    E --> F1["Pool 1: Profile 1 + Preferred Country"]
    E --> F2["Pool 2: Profile 2 + Preferred Country"]
    E --> F3["Pool 3: Profile 3 + Preferred Country"]
    C2 --> F1 & F2 & F3 & F4["Pool 4: Global Trending + Preferred Country"]
    E --> F5["Pool 5: Unexplored Taste / Discovery"]
    F1 & F2 & F3 --> G["Local Overlap Re-ranking"]
    G & F4 & F5 --> H["Filter out items in User Library"]
    H --> I["Interleave Pools: round-robin sequence"]
    I --> J["Final Personal Feed: Explore Page"]
```

### Technologies Used

| Layer | Technology | Description |
| :--- | :--- | :--- |
| Backend | NestJS (v11) | Progressive Node.js framework with TypeScript, hosted on Render |
| Scheduling | @nestjs/schedule | Cron jobs for release sync and notifications |
| Database | PostgreSQL (Aiven) | Cloud database with `pg` connection pooling and SSL |
| ORM | Prisma (v7) | Relational database mapping via `@prisma/adapter-pg` |
| Email | Nodemailer (SMTP) | Admin synchronization reports |
| Frontend | React (v19) + Vite (v8) + TailwindCSS (v4) | Fast interface with theme system, Framer Motion animations, and modern CSS |
| Mobile | Capacitor (v8) | Hybrid wrapper for Android WebView with ES2020 target |
| APIs | AniList / TMDB / MangaUpdates / MangaDex | External integrations for metadata, calendar, and chapter lookups |

---

## Database Class Diagram

```mermaid
classDiagram
    class User {
        +Int id
        +String nome
        +String email
        +String password
        +String preferredLanguage
        +String theme
        +Boolean showAdultContent
        +Int tokenVersion
        +String tipoConta
        +String iconUrl
        +String bannerUrl
        +Json preferences
    }

    class Anime {
        +Int id
        +String titulo
        +String statusLancamento
        +String descricao
        +Json generos
        +String capaUrl
        +String bannerUrl
        +Int numEpisodiosTotal
        +Int numEpisodiosAired
        +Int proximoEpisodio
        +DateTime proximoEpisodioData
        +DateTime ultimoEpisodioEstreadoData
        +DateTime dataLancamento
        +String temporada
        +Int ano
        +String paisOrigem
        +String formato
        +String tipo
        +String materialOrigem
        +String linksExternos
        +Json episodesList
        +DateTime updatedAt
    }

    class UserAnime {
        +Int id
        +Int seasonAtual
        +Int epAtual
        +TrackingStatus status
        +Int prioridade
        +String linksPersonalizados
        +String notas
        +Int userId
        +Int animeId
        +Boolean wasDropped
        +DateTime lastProgressUpdate
        +Json watchedSpecials
        +DateTime updatedAt
    }

    class Manga {
        +Int id
        +String titulo
        +String statusLancamento
        +Float numCapitulosTotal
        +String capaUrl
        +String bannerUrl
        +Json generos
        +String formato
        +String materialOrigem
        +String descricao
        +DateTime proximoCapituloData
        +Float proximoCapituloNumero
        +String linksExternos
        +String paisOrigem
        +DateTime updatedAt
    }

    class UserManga {
        +Int id
        +Float capAtual
        +TrackingStatus status
        +Int prioridade
        +String linksPersonalizados
        +String notas
        +Int userId
        +Int mangaId
        +Boolean wasDropped
        +DateTime lastProgressUpdate
        +DateTime updatedAt
    }

    class ChatSession {
        +Int id
        +String titulo
        +DateTime createdAt
        +DateTime updatedAt
        +Int userId
    }

    class ChatMessage {
        +Int id
        +String role
        +String content
        +DateTime createdAt
        +Int sessionId
    }

    class SyncLog {
        +Int id
        +DateTime timestamp
        +String status
        +String details
    }

    class UserTopFavorite {
        +Int id
        +Int userId
        +Int anilistMediaId
        +MediaType mediaType
        +Int rankPosition
    }

    class UserStatistics {
        +Int userId
        +Int totalAnimeCompleted
        +Int totalEpisodesWatched
        +Int totalMangaRead
        +Float animeDaysWasted
        +Float mangaDaysWasted
    }

    class Achievement {
        +Int id
        +String name
        +String description
        +String badgeImageUrl
        +String rarity
    }

    class UserAchievement {
        +Int userId
        +Int achievementId
        +DateTime unlockedAt
    }

    class Notification {
        +Int id
        +Int userId
        +String title
        +String message
        +String type
        +Int mediaId
        +Boolean read
        +DateTime createdAt
    }

    class Media {
        +Int id
        +Float avaliacao_base
        +Int total_votos_users
        +Float soma_notas_users
        +Float avaliacao_geral
    }

    class UserRating {
        +Int id
        +Int userId
        +Int mediaId
        +Float score
    }

    class Comment {
        +Int id
        +Int userId
        +Int mediaId
        +String text
        +Int likes
        +DateTime createdAt
    }

    class CommentLike {
        +Int id
        +Int userId
        +Int commentId
        +DateTime createdAt
    }

    class GenreTag {
        +Int id
        +String name
        +String type
        +String category
        +String subcategory
        +Boolean isAdult
        +Boolean isExposed
    }

    class CustomList {
        +Int id
        +String name
        +String description
        +String coverUrl
        +Boolean isPublic
        +Json criteria
        +DateTime createdAt
        +DateTime updatedAt
        +Int userId
    }

    class CustomListItem {
        +Int id
        +Int listId
        +Int anilistMediaId
        +MediaType mediaType
        +Int position
        +DateTime addedAt
        +Int animeId
        +Int mangaId
    }

    class TrackingStatus {
        <<enumeration>>
        WATCHING
        PLANNED
        COMPLETED
        PAUSED
        DROPPED
    }

    class MediaType {
        <<enumeration>>
        ANIME
        MANGA
    }

    User "1" --> "*" UserAnime : has
    User "1" --> "*" UserManga : has
    User "1" --> "*" ChatSession : has
    User "1" --> "*" UserTopFavorite : has
    User "1" --> "0..1" UserStatistics : has
    User "1" --> "*" UserAchievement : has
    User "1" --> "*" UserRating : rates
    User "1" --> "*" Comment : comments
    User "1" --> "*" CommentLike : likes
    User "1" --> "*" Notification : receives
    Comment "1" --> "*" CommentLike : liked_by

    Anime "1" --> "*" UserAnime : associated
    Manga "1" --> "*" UserManga : associated

    ChatSession "1" --> "*" ChatMessage : contains

    Achievement "1" --> "*" UserAchievement : earned_by
    Media "1" --> "*" UserRating : rated_by
    Media "1" --> "*" Comment : has

    User "1" --> "*" CustomList : has
    CustomList "1" --> "*" CustomListItem : contains
    Anime "1" --> "*" CustomListItem : associated
    Manga "1" --> "*" CustomListItem : associated
```

---

## Folder Guide

```bash
Otaku-Time-v2/
├── .github/workflows/       # keep-awake.yml (pings Render every 10 min)
├── docs/                    # Project docs (sync engine, history, requirements, next steps)
├── prisma/                  # Prisma schema, migrations, and seed/backfill scripts
│   └── schema.prisma        # Definition of relational tables
├── prisma.config.ts         # Prisma 7 config (DATABASE_URL / DIRECT_URL)
├── src/                     # NestJS Backend
│   ├── anime/               # AniList + TMDB metadata, calendar, recommendations, TV Time import
│   ├── manga/               # MangaUpdates, MangaDex, and AniList integration
│   ├── list/                # Custom user lists
│   ├── sync/                # Scheduled release synchronization (cron jobs)
│   ├── notification/        # In-app release notifications
│   ├── email/               # SMTP email service (admin sync reports)
│   ├── rating/              # Global rating evaluation endpoints
│   ├── comment/             # Comments and likes
│   ├── user/ & auth/        # Users, achievements, backups, admin routes, JWT cookie auth
│   └── keep-awake.*         # Activity tracking / self-ping for Render
├── otaku-ui/                # React + Vite + Capacitor Frontend (Tailwind v4)
│   ├── android/             # Native Android project built by Capacitor
│   ├── src/
│   │   ├── components/      # Reusable UI (Header, MediaCard, details/, profile/ tabs, ...)
│   │   ├── pages/           # Home, Explore, Library, Calendar, Profile, Details, Lists, ListDetails, Login, Register
│   │   ├── services/        # apiBridge (Capacitor-aware fetch), storage, color palettes
│   │   ├── hooks/           # useIsMobile, useTranslation (PT/EN)
│   │   └── context/         # Auth, Media, and Toast contexts
│   └── capacitor.config.ts  # Capacitor mobile build settings
├── test/                    # E2E tests (Jest + Supertest)
└── testes_e_scripts/        # Prebuilt APK, scratch/maintenance scripts, sample TV Time exports
```

---

## Local Installation and Configuration

### Prerequisites
* Node.js (v20.19 or superior — required by Vite 8 and Prisma 7)
* A PostgreSQL database (local or cloud)
* Android Studio (for mobile compilation and testing)

---

### 1. Configure the Server (NestJS Backend)

In the project root folder:

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Configure the `.env` file:**
   Create a `.env` file in the root of the project with the following variables:
   ```env
   # Required
   DATABASE_URL="postgresql://user:password@your-host:5432/otakutime?sslmode=require"
   JWT_SECRET="your_secret_key_here"
   TMDB_API_KEY="your_tmdb_api_key"

   # Optional
   DIRECT_URL=""                      # Direct (non-pooled) connection for Prisma migrations
   PORT=3001
   FRONTEND_URL="https://your-frontend.example.com"  # Extra CORS origin (localhost & capacitor:// are always allowed)
   SECURE_COOKIES="false"             # "true" forces Secure cookies outside NODE_ENV=production

   # Email (admin sync reports)
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT=465
   SMTP_SECURE="true"
   SMTP_USER="you@example.com"
   SMTP_PASS="app_password"
   SMTP_FROM="Otaku Time <you@example.com>"

   # Keep-awake (Render)
   RENDER_URL="https://your-app.onrender.com"
   AWAKE_TIMEZONE="Europe/Lisbon"
   AWAKE_START_HOUR=7
   AWAKE_END_HOUR=2
   ```
   SSL is enabled automatically unless `DATABASE_URL` points to `localhost`.
3. **Generate the Prisma Client** (also runs automatically on `npm install`):
   ```bash
   npx prisma generate
   ```
4. **Apply or sync the Schema with the Database:**
   ```bash
   npx prisma db push
   ```
5. **Start the backend in development mode:**
   ```bash
   npm run start:dev
   ```
   *The backend will be available at `http://localhost:3001`.*

---

### 2. Configure the Client (React Frontend)

Navigate to the `otaku-ui` folder:

1. **Install dependencies:**
   ```bash
   cd otaku-ui
   npm install
   ```
2. **Configure the `.env` file in the Frontend (optional):**
   You can create a `.env` file inside the `otaku-ui` folder or let it use the default fallback in the `src/config.ts` file:
   ```env
   VITE_API_URL="http://localhost:3001"
   ```
3. **Start the Vite server:**
   ```bash
   npm run dev
   ```
   *The frontend will be available at `http://localhost:5173`.*

---

### 3. Configure the Mobile Application (Android/Capacitor)

To compile, build, and debug the mobile application:

1. **Generate the React build folder:**
   ```bash
   cd otaku-ui
   npm run build
   ```
2. **Sync the build with the Android project:**
   ```bash
   npx cap sync
   ```

#### A. Generating the APK via Android Studio (Recommended)
1. **Open the project in Android Studio:**
   ```bash
   npx cap open android
   ```
2. Wait for Gradle to finish syncing the project.
3. In the top menu, navigate to: **Build** ➔ **Build Bundle(s) / APK(s)** ➔ **Build APK(s)**.
4. Once completed, a popup notification will appear in the bottom-right corner. Click on **locate** to find your newly generated APK file (usually saved at `otaku-ui/android/app/build/outputs/apk/debug/app-debug.apk`).
5. Alternately, connect your Android device via USB (with USB Debugging enabled) and click the green **Run (Play)** button in the top toolbar to install and run it directly.

#### B. Generating the APK via CLI (Fastest)
Run the following commands from the root directory of your project:
* **Windows (PowerShell):**
  ```powershell
  cd otaku-ui/android
  ./gradlew assembleDebug
  ```
* **macOS / Linux:**
  ```bash
  cd otaku-ui/android
  ./gradlew assembleDebug
  ```
The generated APK will be available in:
`otaku-ui/android/app/build/outputs/apk/debug/app-debug.apk`

---

#### 4. Configure ADB Reverse for Local Server connection
If you are debugging on your physical device via USB cable, run the command below in your development machine terminal to allow the device to send requests to your local server:
```bash
adb reverse tcp:3001 tcp:3001
```

---

## Useful Commands

* **Visualize the Database (Prisma Studio Web Interface):**
  ```bash
  npx prisma studio
  ```
* **Apply manual changes to the Database Schema:**
  ```bash
  npx prisma db push
  ```
* **Run backend tests (unit / e2e):**
  ```bash
  npm test
  npm run test:e2e
  ```

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.