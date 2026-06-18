# Otaku Time Pro (v2.5)

**Your smart, cloud-based, and centralized Anime & Manga tracker.**

Otaku Time Pro is a complete Fullstack ecosystem designed to **register, organize, and track the progress** of all your favorite works. With a modern architecture that connects both your PC browser and your Android mobile app directly to a centralized cloud database, you can manage your library with real-time synchronization.

The platform automates release time zones for episodes, tracks chapters across multiple portals, and features a highly customizable and fluid interface.

In this repository, you will find the **otaku_Time.apk** file, which is the pre-compiled Android application ready for installation.

Production Applications:
* Frontend Web & API: [https://otaku-time-v2.onrender.com](https://otaku-time-v2.onrender.com)
* Database: Hosted remotely on Neon Cloud (PostgreSQL)

---

## Main Features & Updates (v2.5)

### 1. Cloud Ecosystem & Automated Deployment (Neon DB + Render)
* PostgreSQL Database (Neon DB): Transition from local SQLite to remote PostgreSQL, featuring optimized connection pooling and secure SSL certificates to ensure resilience and stability.
* Hosting on Render: The NestJS backend and React frontend (SPA) are hosted on Render with continuous integration (CI/CD) linked directly to the main branch of the GitHub repository.

### 2. Native Android Experience (via Capacitor)
* Centralized Cloud Data: Direct access and real-time writing to the centralized PostgreSQL database on Neon DB, ensuring your library is synchronized across all web browsers and Android devices.
* Backup and Portability: Generate JSON backups of your library (items, status, progress, priorities) to easily transfer, archive, or restore data.

### 3. Smart Random Draws (Gacha / Raffle)
* Global Draw (Search): Click the dice button (casino) on the search bar to draw a random work based on popularity (rank 1 to 2000) directly from the AniList API.
* Planned Draw (Library): Click the cross-arrows button (shuffle) in the library to draw a title from your planned list (PLANNED). The selection uses a cascade probability algorithm:
  1. Priority (1 to 10): Works with higher priority/ranking have substantially higher weights.
  2. Publication Status: Prioritizes finished works (75% chance for FINISHED) over ongoing works (25% chance for RELEASING).
  3. Attempts with Fallback: Resilient algorithm with up to 100 attempts and a safe fallback.

### 4. Premium Tracking Dashboard (To-Watch/Read)
* Dual-Column View: Home panel with dedicated sections for "WATCH NEXT" (Anime) and "READ NEXT" (Manga).
* Optimistic UI: Immediate progress updates on the frontend when clicking quick "SEEN" or "READ" buttons, syncing with the server in the background to eliminate waiting times.
* Automatic Progression: Automatic update to WATCHING / READING status when changing progress from 0 to 1, and to COMPLETED when reaching the last episode/chapter.

### 5. Dynamic Personal Calendar
* Maps upcoming releases only for works in RELEASING status present in your personal list.
* Automatically converts the original release timestamps (Japan Standard Time - JST) obtained via the AniList API to the user's local time zone.

### 6. Triple Chapter Tracking (Manga)
Resolves inconsistencies from external portals using a 3-layer system:
* Plan A (Baka-Updates): Queries MangaUpdates to get exact counts and season/special split details.
* Plan B (MangaDex): Smart fallback with search by AniList ID or approximate title.
* Plan C (AniList): Final fallback for completed works.

### 7. Visual Themes & Profile Settings
* Modern interface with full support for Dark and Light modes with clean CSS transitions.
* Selector with 6 chromatic color palettes: Classic Purple (Default), Shounen Orange (Crunchyroll), Akatsuki Red (Naruto), Mutsu Green (Mushi-Shi), Solo Leveling Purple, and Visionary Blue (AniList).
* User preference management directly in the Profile: preferred language (Portuguese/English) and adult content filtering (NSFW).

### 8. Black Screen Fix & Android Compatibility
* ES2020 Compatibility: The Vite frontend build and TypeScript target have been adjusted to es2020, ensuring full compatibility with older Android WebViews.
* Cache-Busting & Loader: Added an interceptor script in index.html to clean up obsolete static assets saved in cache after new updates, alongside a premium animated loading screen.

### 9. Global Ratings & Comments System (Community)
* Dynamic Evaluations: Users can submit custom ratings on animes and mangas, recalculating the average global score dynamically on the NestJS backend.
* Community Comments: Detailed user commenting functionality. Comment threads are populated and linked per work, visible to all registered users on the media details page.

### 10. Fun Achievement & Badge System
* Dynamic Achievements: Fun badges dynamically unlocked when users hit milestones. Includes image URL badges, descriptions, and rarity tiers (Common, Rare, Epic, Legendary).
* Database Seeding: Embedded automated seed utility in administration tools to easily populate standard achievements.

### 11. PRO Tier & Gift Code Subscriptions
* Code Redemption: Users can upgrade their accounts to the "PREMIUM" status by redeeming active Gift Codes.
* Expiration Control: Fully managed subscriptions with automated current period ending controls.

### 12. Complete Administrative Dashboard
* System Overview: Admin panel endpoints to view total users, subscription tiers, and overall system stats.
* Code Management: Secure commands to generate custom duration Gift Codes, limit usage, set custom expiration dates, and list/manage subscriptions and active/unlocked achievements.

### 13. Social Sharing & Public Profiles
* User Interconnection: Allows users to visit and view other members' profiles (`/user/profile/:id`) including their public libraries, statistics, and top lists.
* Top 3 Favorites: Pin up to 3 Anime/Manga titles directly in a highlighted top list visible to anyone visiting the profile.
* Custom Phrase: Profile status features where users can write a customized phrase/status shown under their banner.

### 14. Keep-Alive Middleware & Smart Syncing
* Auto-Wake Service: Dynamic ping middleware triggered automatically on client navigation keeping the NestJS server active on Render to avoid cold starts.
* Background Sync: Checks and syncs with the AniList database every 4 hours automatically.

---

## System Architecture

```mermaid
flowchart TD
    subgraph Cloud ["Cloud & Production (Render + Neon)"]
        FE_Render["Frontend (Render SPA) \n otaku-time-v2.onrender.com"]
        BE_Render["Backend (Render Web Service) \n api-otaku-time"]
        DB_Neon[(PostgreSQL - Neon DB)]
    end

    subgraph Device ["Local Client (Web & Mobile)"]
        Browser["Web Browser (Desktop/Mobile)"]
        Capacitor["Android App (Capacitor)"]
    end

    subgraph External_Sources ["External Data & Metadata Sources"]
        AniList["AniList GraphQL API"]
        BakaUpdates["Baka-Updates API"]
        MangaDex["MangaDex API"]
    end

    %% Communication relationships
    Browser -->|Accesses| FE_Render
    
    FE_Render -->|REST Requests| BE_Render
    Browser -->|REST Requests| BE_Render
    Capacitor -->|REST Requests| BE_Render
    
    BE_Render ---|"Prisma ORM"| DB_Neon
    
    BE_Render -->|Metadata & Releases| AniList
    BE_Render -->|Chapters & Seasons| BakaUpdates
    BE_Render -->|Chapter Fallback| MangaDex
```

### Technologies Used

| Layer | Technology | Description |
| :--- | :--- | :--- |
| Backend | NestJS (v11) | Progressive Node.js framework with TypeScript, hosted on Render |
| Database | PostgreSQL (Neon DB) | Cloud database with connection pooling and active SSL |
| ORM | Prisma (v7) | Relational database mapping and efficient migrations |
| Frontend | React (v19) + Vite + TailwindCSS (v4) | Fast interface with theme system, useIsMobile hook, and modern CSS |
| Mobile | Capacitor (v8) | Hybrid wrapper for Android WebView with ES2020 target |
| APIs | AniList / MangaUpdates / MangaDex | External integrations for metadata, calendar, and chapter lookups |

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
        +String generos
        +String capaUrl
        +Int numEpisodiosTotal
        +Int proximoEpisodio
        +DateTime proximoEpisodioData
        +DateTime dataLancamento
        +String temporada
        +Int ano
        +String linksExternos
        +DateTime updatedAt
    }

    class UserAnime {
        +Int id
        +Int epAtual
        +TrackingStatus status
        +Int prioridade
        +String linksPersonalizados
        +Int userId
        +Int animeId
        +Boolean wasDropped
        +DateTime updatedAt
    }

    class Manga {
        +Int id
        +String titulo
        +String statusLancamento
        +Float numCapitulosTotal
        +String capaUrl
        +String generos
        +String autor
        +String descricao
        +DateTime proximoCapituloData
        +Float proximoCapituloNumero
        +String linksExternos
        +DateTime updatedAt
    }

    class UserManga {
        +Int id
        +Float capAtual
        +TrackingStatus status
        +Int prioridade
        +String linksPersonalizados
        +Int userId
        +Int mangaId
        +Boolean wasDropped
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

    class UserSubscription {
        +Int id
        +Int userId
        +String planType
        +SubscriptionStatus status
        +DateTime startDate
        +DateTime currentPeriodEnd
        +String externalSubscriptionId
    }

    class GiftCode {
        +Int id
        +String code
        +Int durationDays
        +Boolean isUsed
        +Int redeemedByUserId
        +DateTime redeemedAt
        +DateTime expiresAt
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

    class SubscriptionStatus {
        <<enumeration>>
        ACTIVE
        CANCELED
        EXPIRED
        PAST_DUE
    }

    User "1" --> "*" UserAnime : has
    User "1" --> "*" UserManga : has
    User "1" --> "*" ChatSession : has
    User "1" --> "*" UserTopFavorite : has
    User "1" --> "0..1" UserStatistics : has
    User "1" --> "*" UserAchievement : has
    User "1" --> "0..1" UserSubscription : has
    User "1" --> "*" GiftCode : redeems
    User "1" --> "*" UserRating : rates
    User "1" --> "*" Comment : comments

    Anime "1" --> "*" UserAnime : associated
    Manga "1" --> "*" UserManga : associated

    ChatSession "1" --> "*" ChatMessage : contains

    Achievement "1" --> "*" UserAchievement : earned_by
    Media "1" --> "*" UserRating : rated_by
    Media "1" --> "*" Comment : has
```

---

## Folder Guide

```bash
Otaku-Time-v2/
├── prisma/                  # PostgreSQL (Neon) configuration and Prisma Schema
│   └── schema.prisma        # Definition of relational tables
├── src/                     # NestJS Backend
│   ├── anime/               # AniList metadata and calendar
│   ├── manga/               # MangaUpdates, MangaDex, and AniList integration
│   ├── sync/                # Release updates synchronization logic
│   ├── rating/              # Global rating evaluation endpoints
│   ├── comment/             # Global comment and community interaction
│   └── user/ & auth/        # User management, subscription tier, and achievements
├── otaku-ui/                # React + Vite + Capacitor Frontend (Tailwind v4)
│   ├── android/             # Native Android project built by Capacitor
│   ├── src/                 
│   │   ├── pages/           # Dashboard, Library, Calendar, Profile, and Details
│   │   ├── services/        
│   │   │   └── apiBridge.ts # Communication helper with CORS bypass for Capacitor
│   │   └── context/         # Global navigation, themes, and category states
│   └── capacitor.config.ts  # Capacitor mobile build settings
```

---

## Local Installation and Configuration

### Prerequisites
* Node.js (v18 or superior)
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
   DATABASE_URL="postgresql://utilizador:password@ep-cold-surf.eu-central-1.aws.neon.tech/otakutime?sslmode=require"
   JWT_SECRET="your_secret_key_here"
   ```
3. **Generate the Prisma Client:**
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