ENVIRONMENT ?= dev
COMPOSE_PROJECT_NAME ?= skope-ui
PULL ?= 1

API_URL_dev := http://localhost:8001
API_URL_staging := https://staging-api.openskope.org
API_URL_prod := https://api.openskope.org
API_BASE_OVERRIDE := $(NUXT_PUBLIC_API_BASE)
SKOPE_API_HOST_URL ?= $(or $(API_BASE_OVERRIDE),$(API_URL_$(ENVIRONMENT)))
# Resolve lazily so target-specific deploy/test environments select their own URL.
override NUXT_PUBLIC_API_BASE = $(SKOPE_API_HOST_URL)
export NUXT_PUBLIC_API_BASE
export SKOPE_BUILD_ID ?= $(shell git describe --tags --always --dirty)

COMPOSE = docker compose --project-name $(COMPOSE_PROJECT_NAME) \
	--project-directory . \
	-f base.yml \
	-f $(ENVIRONMENT).yml
TEST_COMPOSE = docker compose --project-name $(COMPOSE_PROJECT_NAME)-test \
	--project-directory . \
	-f base.yml \
	-f dev.yml

CITATION_TXT_FILE := app/generated/citation.txt
CITATION_BIB_FILE := app/generated/citation.bib
CFFCONVERT_IMAGE := ghcr.io/scicodes/cffconvert:v2026.09

.DEFAULT_GOAL := help

.PHONY: help check-environment citations config build buildprod deploy \
	deploy-dev deploy-staging deploy-production down restart logs ps lint format \
	test typecheck clean

help: ##- Show available targets
	@echo "usage: make [target] [ENVIRONMENT=dev|staging|prod]"
	@echo "targets:"
	@sed -e '/#\{2\}-/!d; s/\\$$//; s/:[^#\t]*/:/; s/#\{2\}- *//' $(MAKEFILE_LIST)

check-environment:
	@case "$(PULL)" in 0|1) ;; *) echo 'PULL must be 0 or 1' >&2; exit 2;; esac
	@case "$(ENVIRONMENT)" in \
	  dev|staging|prod) ;; \
	  *) echo "ENVIRONMENT must be dev, staging, or prod (got '$(ENVIRONMENT)')" 1>&2; exit 2;; \
	esac
	@test -n "$(SKOPE_API_HOST_URL)" || { echo "No API URL configured for $(ENVIRONMENT)" 1>&2; exit 2; }

$(CITATION_TXT_FILE) $(CITATION_BIB_FILE) &: CITATION.cff
	mkdir -p app/generated
	rm -f $(CITATION_TXT_FILE) $(CITATION_BIB_FILE)
	docker run --rm -i $(CFFCONVERT_IMAGE) -i /dev/stdin -f apalike < CITATION.cff > $(CITATION_TXT_FILE)
	docker run --rm -i $(CFFCONVERT_IMAGE) -i /dev/stdin -f bibtex < CITATION.cff > $(CITATION_BIB_FILE)

citations: $(CITATION_TXT_FILE) $(CITATION_BIB_FILE) ##- Generate citation text used by the application

config: check-environment ##- Render and validate the selected Compose configuration
	@$(COMPOSE) config

build: check-environment citations ##- Build the selected environment's image
	@$(COMPOSE) config --quiet
	$(COMPOSE) build $(if $(filter 1,$(PULL)),--pull)

# Backwards-compatible alias used by existing CI and deployment notes.
buildprod: override ENVIRONMENT=prod
buildprod: build

deploy: build ##- Deploy ENVIRONMENT (defaults to dev) and wait for a healthy service
	$(COMPOSE) up -d --remove-orphans $(if $(filter dev,$(ENVIRONMENT)),--force-recreate --renew-anon-volumes) --wait --wait-timeout 120

deploy-dev: override ENVIRONMENT=dev
deploy-dev: deploy ##- Build and deploy the local development environment

deploy-staging: override ENVIRONMENT=staging
deploy-staging: deploy ##- Build and deploy staging against staging-api.openskope.org

deploy-production: override ENVIRONMENT=prod
deploy-production: deploy ##- Build and deploy production against api.openskope.org

down: check-environment ##- Stop and remove the selected environment's containers
	$(COMPOSE) down

restart: check-environment ##- Restart the selected environment's services
	$(COMPOSE) restart

logs: check-environment ##- Follow logs for the selected environment
	$(COMPOSE) logs --follow --tail=200

ps: check-environment ##- Show service status for the selected environment
	$(COMPOSE) ps

lint: override ENVIRONMENT=dev
lint: build ##- Run ESLint with automatic fixes
	$(COMPOSE) run --rm web npm run lintfix

format: override ENVIRONMENT=dev
format: build ##- Format source files and run ESLint fixes
	$(COMPOSE) run --rm -v $(PWD):/repo web npm run format

test: ##- Run complete Nuxt type checking and the Vitest suite
typecheck: ##- Run complete Nuxt type checking, including Vue templates and tests
test typecheck: override ENVIRONMENT=dev
test typecheck: check-environment citations
	@$(TEST_COMPOSE) config --quiet
	$(TEST_COMPOSE) build web
	@trap '$(TEST_COMPOSE) down --remove-orphans' EXIT INT TERM; \
		$(TEST_COMPOSE) run --rm web npm run $@

clean: ##- Remove generated local build inputs
	rm -f $(CITATION_TXT_FILE) $(CITATION_BIB_FILE)
