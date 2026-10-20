.PHONY: dev build start lint db-generate db-studio db-migrate help

# Default target
.DEFAULT_GOAL := help

# Load environment variables from .env.local
ifneq (,$(wildcard ./.env.local))
    include .env.local
    export
endif

# Development server
dev:
	npm run dev

# Production build
build:
	npm run build

# Start production server
start:
	npm start

# Run linter
lint:
	npm run lint

# Generate database migrations
db-generate:
	npm run db:generate

# Open Drizzle Studio
db-studio:
	npm run db:studio

# Apply drizzle/ migrations to DATABASE_URL (DATABASE.md)
db-migrate:
	npm run db:migrate

# Show help
help:
	@echo "Available commands:"
	@echo "  make dev         - Start development server"
	@echo "  make build       - Build for production"
	@echo "  make start       - Start production server"
	@echo "  make lint        - Run linter"
	@echo "  make db-generate - Generate database migrations"
	@echo "  make db-studio   - Open Drizzle Studio"
	@echo "  make db-migrate  - Run database migrations"
