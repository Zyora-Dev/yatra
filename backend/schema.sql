CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE CHECK (email = lower(email)),
    whatsapp VARCHAR(16) NOT NULL UNIQUE CHECK (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
    password_hash TEXT NOT NULL,
    location VARCHAR(160) NOT NULL CHECK (length(trim(location)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash CHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS together_trips (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    destination VARCHAR(160) NOT NULL,
    days INTEGER NOT NULL CHECK (days BETWEEN 1 AND 14),
    currency VARCHAR(3) NOT NULL,
    proposed_cost DOUBLE PRECISION CHECK (proposed_cost >= 0 AND proposed_cost <= 100000000),
    invite_hash CHAR(64) UNIQUE,
    invite_expires TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS together_members (
    trip_id UUID NOT NULL REFERENCES together_trips(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alias VARCHAR(40) NOT NULL,
    preferences JSONB,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (trip_id, user_id)
);

CREATE INDEX IF NOT EXISTS together_members_user_idx ON together_members(user_id);