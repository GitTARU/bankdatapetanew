# Cartotheca v2 — Map Archive with Road Pins

A local Node.js web app to archive old map images and annotate them with interactive road pins. Backed by PostgreSQL.

## Project Structure

```
cartotheca-v2/
├── server.js             ← Express entry point
├── package.json
├── .env                  ← DB credentials (edit this first)
├── src/
│   ├── db.js             ← PostgreSQL connection pool
│   └── setup-db.js       ← Creates database & tables
├── routes-maps.js        ← /api/maps CRUD
├── routes-pins.js        ← /api/maps/:id/pins CRUD
└── public/
    ├── index.html        ← Full frontend SPA
    └── uploads/          ← Image files stored here (auto-created)
```

## Setup

### 1. Prerequisites
- Node.js v16+ — https://nodejs.org
- PostgreSQL running locally

### 2. Configure database credentials
Edit `.env`:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cartotheca
DB_USER=postgres
DB_PASSWORD=your_password_here
PORT=3000
```

### 3. Install dependencies
```bash
npm install
```

### 4. Create the database and tables
```bash
npm run setup-db
```
This creates the `cartotheca` database (if it doesn't exist) and the `maps` and `road_pins` tables.

### 5. Start the server
```bash
npm start
```

### 6. Open the app
Visit http://localhost:3000

---

## Database Schema

### maps
| Column        | Type        | Notes                    |
|---------------|-------------|--------------------------|
| id            | UUID (PK)   | auto-generated           |
| name          | TEXT        | display name             |
| notes         | TEXT        | optional description     |
| filename      | TEXT        | stored filename in /uploads |
| original_name | TEXT        | original upload filename |
| file_size     | BIGINT      | bytes                    |
| uploaded_at   | TIMESTAMPTZ | auto                     |
| updated_at    | TIMESTAMPTZ | set on edit              |

### road_pins
| Column     | Type         | Notes                          |
|------------|--------------|--------------------------------|
| id         | UUID (PK)    | auto-generated                 |
| map_id     | UUID (FK)    | references maps(id) ON DELETE CASCADE |
| road_name  | TEXT         | name of the road               |
| notes      | TEXT         | optional notes                 |
| x_pct      | NUMERIC(6,3) | horizontal position (0–100%)   |
| y_pct      | NUMERIC(6,3) | vertical position (0–100%)     |
| created_at | TIMESTAMPTZ  | auto                           |
| updated_at | TIMESTAMPTZ  | set on edit                    |

## API Reference

| Method | Endpoint                          | Description              |
|--------|-----------------------------------|--------------------------|
| GET    | /api/maps                         | List all maps            |
| GET    | /api/maps?q=text                  | Search maps by name      |
| GET    | /api/maps/:id                     | Get map + its pins       |
| POST   | /api/maps                         | Upload new map           |
| PUT    | /api/maps/:id                     | Edit map metadata        |
| DELETE | /api/maps/:id                     | Delete map + image file  |
| GET    | /api/maps/:id/pins                | List pins for a map      |
| POST   | /api/maps/:id/pins                | Add a pin                |
| PUT    | /api/maps/:id/pins/:pinId         | Edit a pin               |
| DELETE | /api/maps/:id/pins/:pinId         | Delete a pin             |

## Features

- Upload map images (up to 100MB each), stored as files on disk
- PostgreSQL stores all metadata with proper relational structure
- Click on any map thumbnail to open the detail view
- **Pin mode**: toggle "Drop a new pin", click anywhere on the map image to place a pin, name the road and add notes
- Pins are numbered and listed in the side panel
- Hover a pin on the map to see the road name tooltip
- Click a pin in the list to highlight it on the map
- Edit or delete individual pins
- Search maps by name (server-side ILIKE query)
- Pin count badge shown on gallery cards
