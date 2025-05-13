import os
import time
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Database connection parameters
db_params = {
    'host': 'localhost',
    'port': 5435,
    'user': 'andrei',
    'password': 'andrei',
    'database': 'city_reporter'
}

# SQL statements to create tables
create_droneaisetting_table = """
CREATE TABLE IF NOT EXISTS droneaisetting (
    id SERIAL PRIMARY KEY,
    key VARCHAR NOT NULL UNIQUE,
    value TEXT,
    description VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS ix_droneaisetting_id ON droneaisetting (id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_droneaisetting_key ON droneaisetting (key);
"""

create_dronereport_table = """
CREATE TABLE IF NOT EXISTS dronereport (
    id SERIAL PRIMARY KEY,
    report_id VARCHAR NOT NULL UNIQUE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    drone_id VARCHAR,
    frame_type VARCHAR NOT NULL,
    latitude FLOAT,
    longitude FLOAT,
    altitude FLOAT,
    location_description VARCHAR,
    category VARCHAR,
    severity VARCHAR,
    description TEXT,
    visible_details TEXT,
    thermal_details TEXT,
    recommendations TEXT,
    analysis_data JSONB,
    status VARCHAR DEFAULT 'new',
    has_been_viewed BOOLEAN DEFAULT FALSE,
    resolution_notes TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by INTEGER REFERENCES "user" (id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS ix_dronereport_id ON dronereport (id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_dronereport_report_id ON dronereport (report_id);
"""

create_dronereportphoto_table = """
CREATE TABLE IF NOT EXISTS dronereportphoto (
    id SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES dronereport (id) ON DELETE CASCADE,
    filename VARCHAR NOT NULL,
    file_path VARCHAR NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR,
    photo_type VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_dronereportphoto_id ON dronereportphoto (id);
"""

# Insert default settings
insert_default_settings = """
INSERT INTO droneaisetting (key, value, description)
VALUES 
    ('drone_ai_enabled', 'false', 'Enable or disable drone AI analysis'),
    ('drone_frame_type', 'regular', 'Type of frames to analyze (regular, thermal, or both)')
ON CONFLICT (key) DO NOTHING;
"""

try:
    # Connect to the database
    conn = psycopg2.connect(**db_params)
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()
    
    # Create tables
    print("Creating droneaisetting table...")
    cursor.execute(create_droneaisetting_table)
    
    print("Creating dronereport table...")
    cursor.execute(create_dronereport_table)
    
    print("Creating dronereportphoto table...")
    cursor.execute(create_dronereportphoto_table)
    
    # Insert default settings
    print("Inserting default settings...")
    cursor.execute(insert_default_settings)
    
    print("Database tables created successfully!")

except Exception as e:
    print(f"Error: {e}")
finally:
    # Close the cursor and connection
    if 'cursor' in locals():
        cursor.close()
    if 'conn' in locals():
        conn.close()