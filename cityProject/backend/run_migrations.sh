#!/bin/bash

# Activate the virtual environment if it exists
if [ -d "cityProject" ]; then
    source cityProject/bin/activate
    echo "Activated virtual environment"
fi

# Run Alembic migrations
echo "Running database migrations..."
alembic upgrade head

echo "Migrations completed successfully!"