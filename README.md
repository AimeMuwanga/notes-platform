Architecture Overview
The system is divided into two primary services and two data stores, all orchestrated via Docker:

Auth Service (Port 3001): Handles user registration, JWT-based login, and profile management.

Notes Service (Port 3002): Manages CRUD operations for notes, linked to users via UUIDs.

PostgreSQL: The primary relational database (running on port 5433 host-side).

Redis: High-performance caching layer for session management and quick data retrieval.

🛠️ Tech Stack
Runtime: Node.js

Framework: Fastify (High performance, low overhead)

Database: PostgreSQL 15

Cache: Redis 7

Containerization: Docker & Docker Compose

Auth: JWT (JSON Web Tokens)

📋 Features
User Authentication: Secure registration and login with encrypted password handling.

Schema Validation: Strict request body validation using JSON Schemas to ensure data integrity.

Service Isolation: Independent scaling and deployment of Auth and Note logic.

Health Checks: Integrated Docker health checks to ensure database readiness before service start.

 Getting Started
Prerequisites
Docker & Docker Desktop

PostgreSQL Client (psql)

Installation & Setup
-Clone the repository:

-Start the infrastructure:

-Run Database Migrations: