# AWS CDK Setup Guide for Xihuitl Discord Bot

This guide walks you through deploying the Xihuitl Discord bot infrastructure using AWS CDK.

## Prerequisites

### 1. Install AWS CLI
```bash
# macOS
brew install awscli

# Or download from: https://aws.amazon.com/cli/
```

### 2. Install AWS CDK CLI
```bash
npm install -g aws-cdk
```

### 3. Configure AWS Credentials

```bash
aws configure
```

Enter your:
- AWS Access Key ID
- AWS Secret Access Key  
- Default region: `us-east-1`
- Default output format: `json`

### 4. Verify Your Setup

```bash
aws sts get-caller-identity
cdk --version
```

## Initial Setup

### Step 1: Bootstrap CDK in Your AWS Account

This is a one-time setup per AWS account/region:

```bash
cdk bootstrap aws://ACCOUNT-NUMBER/us-east-2
```

Replace `ACCOUNT-NUMBER` with your AWS account ID (from `aws sts get-caller-identity`).

### Step 2: Create Required SSM Parameters

Before deploying infrastructure, you need to create two SSM parameters:

#### a) EC2 Key Pair Name

First, create an EC2 key pair if you don't have one:

```bash
# Create a new key pair
aws ec2 create-key-pair \
  --key-name xiuh-bot-key \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/xiuh-bot-key.pem

# Set proper permissions
chmod 400 ~/.ssh/xiuh-bot-key.pem

# Verify key pair was created
aws ec2 describe-key-pairs --key-names xiuh-bot-key
```

Then store the key pair name in SSM:

```bash
aws ssm put-parameter \
  --name "/xiuh/ec2-keypair-name" \
  --value "xiuh-bot-key" \
  --type "String" \
  --description "EC2 key pair name for Xihuitl bot"
```

#### b) Discord Bot Token

Store your Discord bot token as a SecureString:

```bash
aws ssm put-parameter \
  --name "/xiuh/discord-token" \
  --value "YOUR_DISCORD_BOT_TOKEN_HERE" \
  --type "SecureString" \
  --description "Discord bot token for Xihuitl"
```

**Important**: Replace `YOUR_DISCORD_BOT_TOKEN_HERE` with your actual Discord bot token.

#### c) Verify Parameters

```bash
# Verify parameters were created
aws ssm get-parameters-by-path --path "/xiuh"

# Or check individual parameters
aws ssm get-parameter --name "/xiuh/ec2-keypair-name"
aws ssm get-parameter --name "/xiuh/discord-token" --with-decryption
```

### Step 3: Install Project Dependencies

```bash
npm install
```

### Step 4: Deploy the Infrastructure

```bash
make infra.deploy
```

This will:
- Create a DynamoDB table (`xiuh-users`)
- Launch an EC2 instance (t3.micro)
- Set up IAM roles with appropriate permissions
- Configure security groups
- Bootstrap the EC2 instance with Node.js and systemd service

**Note**: The deployment will show you a summary and ask for confirmation. Type `y` to proceed.

### Step 5: Save the Outputs

After deployment completes, CDK will output important information:

```
Outputs:
XiuhStack.InstancePublicIp = xxx.xxx.xxx.xxx
XiuhStack.InstancePublicDnsName = ec2-xxx-xxx-xxx-xxx.us-east-2.compute.amazonaws.com
XiuhStack.DynamoDBTableName = xiuh-users
XiuhStack.BotRoleArn = arn:aws:iam::...
XiuhStack.SecurityGroupId = sg-...
```

**Save the InstancePublicIp** - you'll need it for deployment!

### Step 6: Update Your .env File

Create or update your `.env` file with the following:

```bash
# Discord Configuration
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here

# AWS Configuration
AWS_REGION=us-east-2
DYNAMO_TABLE=xiuh-users

# EC2 Configuration (for deployment)
EC2_HOST=xxx.xxx.xxx.xxx  # Use the InstancePublicIp from CDK outputs
EC2_USER=ec2-user
SSH_KEY=~/.ssh/xiuh-bot-key.pem
REMOTE_DIR=/home/ec2-user/xiuh-bot
```

**Note**: `DYNAMO_TABLE` is optional in `.env` as the bot can fetch it from SSM Parameter Store automatically.

### Step 7: Wait for EC2 Bootstrap to Complete

The EC2 instance needs a few minutes to complete its initialization:

```bash
# Wait 2-3 minutes, then check bootstrap log
ssh -i ~/.ssh/xiuh-bot-key.pem ec2-user@$EC2_HOST \
  "cat /var/log/xiuh-bootstrap.log"

# Should show: "Bootstrap complete at [timestamp]"
```
### Step 8: Deploy the Bot Application

Now you can deploy your bot code to the EC2 instance:

```bash
make deploy
```

This will:
1. Build your TypeScript code
2. Package the application
3. Upload to EC2
4. Install dependencies
5. Restart the bot service

### Step 9: Register Discord Slash Commands

```bash
make deploy.commands
```

## Ongoing Usage

### Deploying Code Updates

After making changes to your bot code, deploy with:

```bash
make deploy
```

This only updates your application code, not the infrastructure.

### Updating Infrastructure

If you modify the CDK stack (in `infra/lib/xiuh-stack.ts`), deploy infrastructure changes with:

```bash
# Preview changes first
make infra.diff

# Deploy infrastructure changes
make infra.deploy
```

Or using npm scripts:

```bash
npm run cdk:diff
npm run cdk:deploy
```

### Checking Bot Status

SSH into your instance to check the bot:

```bash
ssh -i ~/.ssh/xiuh-bot-key.pem ec2-user@xxx.xxx.xxx.xxx

# Check bot status
sudo systemctl status xiuh-bot

# View logs
sudo journalctl -u xiuh-bot -f
```

### Destroying Infrastructure

To tear down all infrastructure (WARNING: This will delete your EC2 instance):

```bash
# Using Makefile (includes 5-second safety delay)
make infra.destroy

# Or using npm scripts
npm run cdk:destroy
```

**Note**: The DynamoDB table has `RETAIN` policy and won't be deleted. You must delete it manually if desired.

To delete the table:

```bash
aws dynamodb delete-table --table-name xiuh-users
```

## Free Tier Considerations

This setup is designed to stay within AWS Free Tier limits:

- **EC2**: t3.micro instance (750 hours/month free for 12 months)
- **DynamoDB**: On-demand pricing (25 GB storage free forever)
- **SSM Parameter Store**: Standard parameters are free
- **Data Transfer**: First 100 GB/month outbound is free

**Important**: 
- Running the instance 24/7 = ~720 hours/month (within free tier)
- After 12 months, t3.micro costs ~$7.50/month
- DynamoDB on-demand is typically under $1/month for this use case

## Troubleshooting

### CDK Bootstrap Error

If you get a bootstrap error:
```bash
cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-2
```

### SSM Parameter Not Found

Verify your parameters exist:

```bash
# List all xiuh parameters
aws ssm get-parameters-by-path --path "/xiuh"

# Check individual parameters
aws ssm get-parameter --name "/xiuh/ec2-keypair-name"
aws ssm get-parameter --name "/xiuh/discord-token" --with-decryption
```

### EC2 Instance Not Accessible

Check security group allows your IP:

```bash
# Get your current IP
curl -s ifconfig.me

# Add your current IP to security group (get sg-id from CDK outputs)
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxxx \
  --protocol tcp \
  --port 22 \
  --cidr $(curl -s ifconfig.me)/32
```

### Bot Won't Start

SSH into the instance and check:
```bash
# Check Node.js is installed
node --version

# Check systemd service exists
systemctl list-unit-files | grep xiuh

# Check service status
sudo systemctl status xiuh-bot

# View full logs
sudo journalctl -u xiuh-bot --no-pager
```

## Architecture Overview

```
┌──────────────────────────────────────┐
│           AWS us-east-2              │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ EC2 Instance (t3.micro)        │  │
│  │ - Amazon Linux 2023            │  │
│  │ - Node.js 18                   │  │
│  │ - Xihuitl Discord Bot          │  │
│  │ - systemd service              │  │
│  └────────┬───────────────────────┘  │
│           │                          │
│           │ IAM Role                 │
│           │                          │
│  ┌────────▼───────────────────────┐  │
│  │ DynamoDB Table                 │  │
│  │ xiuh-users                     │  │
│  │ - Partition Key: user_id       │  │
│  │ - On-demand billing            │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ SSM Parameter Store            │  │
│  │ - /xiuh/table-name             │  │
│  │ - /xiuh/discord-token          │  │
│  │ - /xiuh/ec2-keypair-name       │  │
│  └────────────────────────────────┘  │
│                                      │
└──────────────────────────────────────┘
```

## Quick Reference

### Makefile Commands

```bash
# Infrastructure
make infra.synth      # Synthesize CloudFormation template
make infra.deploy     # Deploy infrastructure
make infra.diff       # Show infrastructure changes
make infra.destroy    # Destroy infrastructure (with safety delay)

# Bot Application
make deploy           # Deploy bot code to EC2
make deploy.commands  # Register Discord slash commands
make build            # Build TypeScript
make clean            # Clean build artifacts
```

### Useful AWS Commands

```bash
# Check EC2 instances
aws ec2 describe-instances --filters "Name=instance-state-name,Values=running" \
  --query 'Reservations[*].Instances[*].[InstanceId,PublicIpAddress,State.Name]' --output table

# Check DynamoDB tables
aws dynamodb list-tables

# Check SSM parameters
aws ssm get-parameters-by-path --path "/xiuh"

# View CloudFormation stack
aws cloudformation describe-stacks --stack-name XiuhStack
```

## Next Steps

1. Deploy your Discord commands: `make deploy.commands`
2. Invite the bot to your Discord server
3. Test the `/time` command
4. Monitor the bot with `sudo journalctl -u xiuh-bot -f`

For more information on Discord.js, visit: https://discord.js.org/
