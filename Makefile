# open-apiary monorepo orchestration.
#
# The targets run the pnpm workspace scripts. Some targets act on the whole
# repo. These targets clean build output and run the aggregate checks for CI.

# The default target shows this help.
.DEFAULT_GOAL := help

.PHONY: help install stub build prepare typecheck test lint format inspect clean check verify ci

help: ## List available targets
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "} {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install workspace dependencies
	pnpm install

stub: ## Link the packages to their source for development
	pnpm stub

build: ## Build every package to its .dist
	pnpm build

prepare: ## Run the workspace prepare hooks. Run build first
	pnpm -r prepare

typecheck: ## Check the types of every package
	pnpm typecheck

test: ## Run the test suite
	pnpm test

lint: ## Lint with oxlint
	pnpm lint

format: ## Format the repo with oxfmt
	pnpm format

inspect: ## Check the formatting with oxfmt
	pnpm inspect

clean: ## Remove the build output
	rm -rf .coverage
	find packages integrations -maxdepth 2 -name .dist -type d -prune -exec rm -rf {} +

check: lint typecheck test ## Run lint, typecheck, and test on the existing build output

verify: clean install build typecheck test ## Clean, install, build, typecheck, and test

ci: build prepare typecheck test lint inspect ## Build, prepare, typecheck, test, lint, and inspect
