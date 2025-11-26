# --- CONFIGURATION ---
ifneq (,$(wildcard ./.env))
include .env
export $(shell sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' .env)
endif

EC2_USER ?= ec2-user
REMOTE_DIR ?= /home/ec2-user/xiuh-bot

ifndef EC2_HOST
$(error EC2_HOST is not set. Add it to your .env (e.g. EC2_HOST=3.16.x.x))
endif

ifndef SSH_KEY
$(error SSH_KEY is not set. Add it to your .env (e.g. SSH_KEY=./my-key.pem))
endif

.PHONY: all clean build package deploy bootstrap deploy.commands

all: deploy

clean:
	rm -rf dist
	rm -f bot-deploy.tar.gz

build: clean
	npm install
	npx tsc

package: build
	tar -czf bot-deploy.tar.gz dist package.json package-lock.json .env

deploy: package
	@echo "🚀 Deploying to $(EC2_HOST)..."
	ssh -i $(SSH_KEY) -o StrictHostKeyChecking=no $(EC2_USER)@$(EC2_HOST) "mkdir -p $(REMOTE_DIR)"
	scp -i $(SSH_KEY) bot-deploy.tar.gz $(EC2_USER)@$(EC2_HOST):$(REMOTE_DIR)
	ssh -i $(SSH_KEY) $(EC2_USER)@$(EC2_HOST) "cd $(REMOTE_DIR) && \
		tar --warning=no-unknown-keyword -xzf bot-deploy.tar.gz && \
		npm ci --omit=dev && \
		sudo systemctl restart discordbot"
	@echo "✅ Deployment Complete!"
	@rm -f bot-deploy.tar.gz

bootstrap:
	chmod +x bootstrap.sh
	./bootstrap.sh

deploy.commands:
	npm run deploy-commands