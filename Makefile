# --- CONFIGURATION ---
EC2_USER = ec2-user
EC2_HOST = 1.2.3.4  # REPLACE WITH YOUR IP
SSH_KEY  = ./my-key.pem # REPLACE WITH YOUR KEY PATH
REMOTE_DIR = /home/ec2-user/xiuh-bot

.PHONY: all clean build package deploy

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
		tar -xzf bot-deploy.tar.gz && \
		npm install --production && \
		sudo systemctl restart discordbot"
	@echo "✅ Deployment Complete!"
	@rm -f bot-deploy.tar.gz