-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'lobby',
    "rating_window_seconds" INTEGER NOT NULL DEFAULT 30,
    "max_songs" INTEGER NOT NULL DEFAULT 20,
    "songs_per_user" INTEGER NOT NULL DEFAULT 3,
    "show_scores" BOOLEAN NOT NULL DEFAULT false,
    "host_id" TEXT,
    "current_song_id" TEXT,
    "spotify_access_token" TEXT,
    "spotify_refresh_token" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "spotify_access_token" TEXT,
    "spotify_refresh_token" TEXT,
    CONSTRAINT "User_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Song" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "party_id" TEXT NOT NULL,
    "spotify_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "cover_url" TEXT NOT NULL,
    "added_by" TEXT NOT NULL,
    "added_by_user_id" TEXT,
    "order" INTEGER NOT NULL,
    "start_time_ms" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Song_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "song_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "voted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Rating_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "Song" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Rating_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Rating_song_id_user_id_key" ON "Rating"("song_id", "user_id");
