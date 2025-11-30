# Xihuitl

A Discord bot that helps users manage and display timezones across different locations.

## Project Structure

```
Xihuitl/
├── src/                  	# Discord bot application code
│   ├── commands/        	# Bot slash commands
│   ├── services/        	# AWS and geo services
│   └── index.ts         	# Bot entry point
├── infra/               	# AWS CDK infrastructure code
│   ├── bin/infra.ts     	# CDK app entry
│   └── lib/xiuh-stack.ts	# Stack definition
├── dist/                	# Compiled JavaScript (gitignored)
├── package.json
├── tsconfig.json        	# TypeScript config for bot
├── cdk.json             	# CDK configuration
├── Makefile             	# Deployment commands
└── CDK_SETUP.md         	# Detailed infrastructure setup guide
```

## Quick Start

### 1. Infrastructure Setup (One-time)

Deploy AWS infrastructure using CDK:

```bash
# Install dependencies
npm install

# Deploy infrastructure (EC2, DynamoDB, IAM, etc.)
npm run cdk:deploy
```

See **[CDK_SETUP.md](CDK_SETUP.md)** for detailed setup instructions including:
- AWS credentials configuration
- CDK bootstrap
- SSM parameter setup
- EC2 key pair creation

### 2. Environment Variables

Create a `.env` in the project root:

```bash
# Discord Configuration
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here

# AWS Configuration
AWS_REGION=your_region
DYNAMO_TABLE=table_name

# EC2 Deployment Configuration
EC2_HOST=ec2_host_address  # From CDK outputs
EC2_USER=ec2_user
SSH_KEY=~/.ssh/key.pem
REMOTE_DIR=/home/ec2-user/xiuh-bot
```

### 3. Deploy Bot Application

```bash
# Build and deploy bot code to EC2
make deploy
```

### 4. Register Slash Commands

```bash
# Register Discord slash commands
make deploy.commands
```

## Development

```bash
# Build TypeScript
make build

# Run bot locally (requires AWS credentials)
npm run dev

# Start compiled bot (on your local machine)
npm start
```

## Infrastructure Management

```bash
# View infrastructure changes
make infra.diff

# Update infrastructure
make infra.deploy

# Destroy infrastructure (WARNING: deletes EC2)
make infra.destroy
```

## Monitoring

SSH into your EC2 instance to monitor the bot:

```bash
ssh -i ~/.ssh/xiuh-bot-key.pem ec2-user@YOUR_EC2_IP

# Check bot status
sudo systemctl status xiuh-bot

# View logs
sudo journalctl -u xiuh-bot -f
```

## Architecture

- **EC2 Instance** (t3.micro): Runs the Discord bot 24/7
- **DynamoDB**: Stores user timezone preferences
- **IAM Role**: Grants EC2 permissions for DynamoDB and SSM
- **Security Group**: SSH access for deployment
- **SSM Parameter Store**: Manages configuration secrets

See `infra/` directory for complete infrastructure code.
