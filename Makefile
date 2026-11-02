.PHONY:db-prod
db-prod:
		docker-compose -f ./devops/prod/docker-compose.db.yml up

.PHONY:db-prod-down
db-prod-down:
		docker-compose -f ./devops/prod/docker-compose.db.yml down

.PHONY:db-dev
db-dev:
		docker-compose -f ./devops/dev/docker-compose.db.yml up

.PHONY:db-dev-down
db-dev-down:
		docker-compose -f ./devops/dev/docker-compose.db.yml down
