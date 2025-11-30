# Infrastructure (AWS CDK)

This directory contains the AWS CDK infrastructure code for the Xihuitl Discord bot.

## Structure

```
infra/
├── bin/
│   └── infra.ts          # CDK app entry point
├── lib/
│   └── xiuh-stack.ts     # Stack definition with all resources
├── tsconfig.json         # TypeScript config for CDK code
└── README.md             # This file
```

## What's Provisioned

The CDK stack (`XiuhStack`) provisions:

- **EC2 Instance** (t3.micro) - Runs the Discord bot
- **DynamoDB Table** (`xiuh-user-timezones`) - Stores user timezone preferences
- **IAM Role** (`xiuh-bot-role`) - EC2 instance permissions
- **Security Group** (`xiuh-bot-sg`) - SSH access for deployment
- **SSM Parameters** - Configuration management

## Commands

Run these from the **project root** (not this directory):

```bash
# Synthesize CloudFormation template
npm run cdk:synth

# Deploy infrastructure
npm run cdk:deploy

# View infrastructure changes
npm run cdk:diff

# Destroy infrastructure
npm run cdk:destroy
```

## Setup

See the main `CDK_SETUP.md` in the project root for complete setup instructions.

## Note

This is CDK infrastructure code only. The actual Discord bot application code is in the `src/` directory at the project root.
