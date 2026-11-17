.DEFAULT_GOAL := help
.PHONY: help install dev dev-host lint build preview clean reset

PORT ?= 5173

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

node_modules: package.json package-lock.json
	npm install
	@touch node_modules

install: node_modules ## Install dependencies

dev: node_modules ## Start dev server (PORT=5173)
	npm run dev -- --port $(PORT)

dev-host: node_modules ## Start dev server exposed on the network (LAN/phone testing)
	npm run dev -- --port $(PORT) --host

lint: node_modules ## Run linter
	npm run lint

build: node_modules ## Build for production into dist/
	npm run build

preview: build ## Build and preview the production bundle locally
	npm run preview

clean: ## Remove build output
	rm -rf dist

reset: clean ## Remove dist/ and node_modules/, then reinstall
	rm -rf node_modules
	npm install
