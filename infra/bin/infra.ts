#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { XiuhStack } from '../lib/xiuh-stack';

// Xihuitl Discord Bot Infrastructure
const app = new cdk.App();

new XiuhStack(app, 'XiuhStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-2',
  },
  description: 'Xihuitl Discord Bot - Infrastructure for EC2, DynamoDB, and IAM',
});

app.synth();
