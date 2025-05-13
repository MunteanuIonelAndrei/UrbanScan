# City Problem Reporter

A platform for citizens to report city problems with photos and location data. The application consists of:

1. Public frontend for citizens to report problems
2. Admin dashboard with authentication for city officials
3. Python backend with FastAPI
4. PostgreSQL database in a Docker container
5. OpenAI integration for report analysis

## System Requirements

- Node.js 16+ and npm
- Python 3.9+
- Docker and Docker Compose
- OpenAI API key

## Project Structure

```
cityProject/
├── frontend/
│   ├── client/         # Public frontend for citizens
│   │   └── ...
│   └── admin/          # Admin dashboard for city officials
│       └── ...
├── backend/
│   ├── app/            # FastAPI application
│   │   ├── api/        # API endpoints
│   │   ├── core/       # Core configurations
│   │   ├── db/         # Database setup
│   │   ├── models/     # SQLAlchemy models
│   │   ├── schemas/    # Pydantic schemas
│   │   └── utils/      # Utility functions
│   ├── migrations/     # Alembic migrations
│   └── ...
└── docker/
    └── docker-compose.yml  # Docker Compose for PostgreSQL
```

## Installation

### 1. Clone the repository

```bash
git clone [repository-url]
cd cityProject
```

### 2. Set up the environment

Copy the example environment file and edit it with your settings:

```bash
cp .env.example .env
```

Edit the `.env` file to set your:
- PostgreSQL credentials (default: user=andrei, password=andrei, port=5435)
- OpenAI API key
- Admin username and password

### 3. Set up PostgreSQL with Docker

```bash
cd docker
docker-compose up -d
```

This will start PostgreSQL on port 5435.

### 4. Install and run the backend

```bash
cd ../backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Verify database connection
python verify_db.py

# Initialize database
alembic upgrade head

# Create initial admin user
python -m app.initial_data

# Run the backend server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend API will be available at http://localhost:8000.

### 5. Install and run the client frontend

```bash
cd ../frontend/client
npm install
npm start
```

The client application will be available at http://localhost:3000.

### 6. Install and run the admin frontend

```bash
cd ../frontend/admin
npm install
npm start
```

The admin application will be available at http://localhost:3001.

## Usage

### Client Application

1. Access the client application at http://localhost:3000
2. Use the form to submit problem reports:
   - Take photos or upload images
   - Describe the problem
   - Specify the location
   - Use automatic location detection (on mobile devices)
   - Submit the report

### Admin Dashboard

1. Access the admin dashboard at http://localhost:3001
2. Log in with the admin credentials (default: admin/adminpassword)
3. View submitted reports on the dashboard
4. Filter and search reports
5. View report details, photos, and AI analysis
6. Update report status
7. Resolve reports with resolution notes

## API Documentation

The API documentation is available at http://localhost:8000/docs when the backend is running.

## Production Deployment

For production deployment:

1. Set `DEBUG=false` in the .env file
2. Build the frontend applications:

```bash
cd frontend/client
npm run build

cd ../admin
npm run build
```

3. Configure a reverse proxy (Nginx/Apache) to serve the application
4. Use a production WSGI server such as Gunicorn:

```bash
gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app
```

## Security

- Change all default passwords in production
- Generate a strong SECRET_KEY for JWT tokens
- Secure your OpenAI API key
- Consider using HTTPS for all connections

## Troubleshooting

### Database Issues

If you have issues with the database:

```bash
# Reset the database
docker-compose down -v
docker-compose up -d
alembic upgrade head
python -m app.initial_data
```

If you encounter connection issues:

1. Verify that PostgreSQL is running on port 5435:
```bash
docker ps
```

2. Test the connection directly:
```bash
psql -h localhost -p 5435 -U andrei -d city_reporter
```

3. Ensure your `.env` file and `app/core/config.py` have the correct settings:
   - POSTGRES_USER=andrei
   - POSTGRES_PASSWORD=andrei
   - POSTGRES_PORT=5435

### Authentication Issues

If you can't log in to the admin dashboard:

```bash
# Reset the admin password
python -c "from app.core.security import get_password_hash; print(get_password_hash('your-new-password'))"
```

Then update the password in the database.

## License

[MIT License]