# Notes Platform Microservices

A containerised backend system utilising a microservices architecture to handle user authentication and note management. This project demonstrates modern backend practices, including service-to-service communication, database migrations, and container orchestration.

**Architecture Overview** 
The system is divided into two primary services and two data stores, all implemented via Docker. 

- Auth Service (Port 3001): Handles user registration, JWT-based login, and profile management.

- Notes Service (Port 3002): Manages CRUD operations for notes, linked to users via UUIDs.

- PostgreSQL: The primary relational database (running on port 5432 host-side).

- Redis: High-performance caching layer for session management and quick data retrieval.

 **Features**
- User Authentication: Secure registration and login with encrypted password handling.

- Schema Validation: Strict request body validation using JSON Schemas to ensure data integrity.

- Service Isolation: Independent scaling and deployment of Auth and Note logic.

- Health Checks: Integrated Docker health checks to ensure database readiness before service start.

**Prerequisites**
- Docker & Docker Desktop
- PostgreSQL Client (psql)

**Installation & Setup**
1. Install dependencies:
   `npm install`
   `npm --prefix services/auth-service install`
   `npm --prefix services/notes-service install`
2. Start the stack:
   `docker compose up --build`
3. Docker Compose runs the auth and notes migrations before the APIs start.

**API Endpoints**
Auth Service (:3001/api/auth)
POST /register - Register a new user.
POST /login - Returns a JWT token.
GET /me - Returns current user profile (Requires Auth Header).

Notes Service (:3002/api/notes)
GET /notes - List notes for the authenticated user.
POST /notes - Create a note for the authenticated user.
GET /notes/:id - Read a single owned note.
PUT /notes/:id - Update a single owned note.
DELETE /notes/:id - Delete a single owned note.

All notes endpoints require `Authorization: Bearer <token>`. Do not send `user_id`; the notes service derives it from the JWT subject.
