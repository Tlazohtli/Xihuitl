# Xihuitl

## Environment Variables
Create a `.env` in the project root with at least:

```
DISCORD_TOKEN=...
CLIENT_ID=...
AWS_REGION=us-east-1
DYNAMO_TABLE={tablename}
EC2_HOST={host}
SSH_KEY=./my-key.pem
EC2_USER={user}
REMOTE_DIR=/home/ec2-user/xiuh-bot
# optional overrides:
# NODE_BIN=/usr/bin/node
# SERVICE_FILE=/etc/systemd/system/discordbot.service
```

## Deploying
1. **First-time setup:** `make bootstrap`  
   Installs Node.js on the EC2 host (if missing), creates the remote working directory, and provisions the `discordbot` systemd service.
2. **Regular deploys:** `make deploy`  
   Builds the TypeScript project, bundles artifacts, uploads them to EC2, installs production dependencies, and restarts the systemd service.
3. **Slash commands:** After changing `/time`, run `make deploy.commands` locally to refresh Discord slash commands.

Monitor the bot with `ssh -i $SSH_KEY $EC2_USER@$EC2_HOST` and `journalctl -u discordbot -f`.