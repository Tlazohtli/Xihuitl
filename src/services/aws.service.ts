import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import * as dotenv from "dotenv";
import { UserTimezone } from "../types";

dotenv.config();

const REGION = process.env.AWS_REGION || "us-east-2";

if (!REGION) {
    throw new Error("Missing AWS_REGION in environment. Set AWS_REGION in your .env file.");
}

const RESOLVED_REGION = REGION;

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({ region: RESOLVED_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const ssmClient = new SSMClient({ region: RESOLVED_REGION });

// Table name resolution: Try .env first, then SSM Parameter Store
let RESOLVED_TABLE: string | null = null;

async function resolveTableName(): Promise<string> {
    if (RESOLVED_TABLE) {
        return RESOLVED_TABLE;
    }

    // Try environment variable first
    if (process.env.DYNAMO_TABLE) {
        RESOLVED_TABLE = process.env.DYNAMO_TABLE;
        return RESOLVED_TABLE;
    }

    // Fall back to SSM Parameter Store (for EC2 runtime)
    try {
        const command = new GetParameterCommand({
            Name: "/xiuh/table-name",
        });
        const response = await ssmClient.send(command);
        
        if (response.Parameter?.Value) {
            RESOLVED_TABLE = response.Parameter.Value;
            console.log(`Resolved table name from SSM: ${RESOLVED_TABLE}`);
            return RESOLVED_TABLE;
        }
    } catch (error) {
        console.error("Failed to fetch table name from SSM:", error);
    }

    throw new Error(
        "Missing DYNAMO_TABLE in environment and unable to fetch from SSM Parameter Store. " +
        "Set DYNAMO_TABLE in your .env file or ensure /xiuh/table-name parameter exists in SSM."
    );
}

class AWSService {
    private cache: Map<string, UserTimezone> = new Map();
    private cacheTTL = 1000 * 60 * 60 * 24 * 7; // 7 Days

    private isFresh(userId: string): boolean {
        const item = this.cache.get(userId);
        if (!item || !item.fetched_at) return false;
        return (Date.now() - item.fetched_at) < this.cacheTTL;
    }

    public async getUsers(userIds: string[]): Promise<UserTimezone[]> {
        const finalResults: UserTimezone[] = [];
        const toFetch: string[] = [];

        for (const uid of userIds) {
            if (this.isFresh(uid)) {
                finalResults.push(this.cache.get(uid)!);
            } else {
                toFetch.push(uid);
            }
        }

        if (toFetch.length > 0) {
            const fetched = await this.batchFetch(toFetch);
            for (const item of fetched) {
                item.fetched_at = Date.now();
                this.cache.set(item.user_id, item);
                finalResults.push(item);
            }
        }
        return finalResults;
    }

    public async getSingleUser(userId: string): Promise<UserTimezone | null> {
        const res = await this.getUsers([userId]);
        return res.length > 0 ? res[0] : null;
    }

    public async saveUser(userId: string, timezone: string, location: string) {
        const tableName = await resolveTableName();
        const item: UserTimezone = {
            user_id: userId,
            timezone: timezone,
            display_location: location,
            fetched_at: Date.now()
        };

        await docClient.send(new PutCommand({
            TableName: tableName,
            Item: { user_id: userId, timezone: timezone, display_location: location }
        }));

        this.cache.set(userId, item);
    }

    private async batchFetch(userIds: string[]): Promise<UserTimezone[]> {
        const tableName = await resolveTableName();
        const results: UserTimezone[] = [];
        for (let i = 0; i < userIds.length; i += 100) {
            const chunk = userIds.slice(i, i + 100);
            const keys = chunk.map(id => ({ user_id: id }));

            try {
                const command = new BatchGetCommand({
                    RequestItems: { [tableName]: { Keys: keys } }
                });
                const response = await docClient.send(command);
                if (response.Responses && response.Responses[tableName]) {
                    results.push(...(response.Responses[tableName] as UserTimezone[]));
                }
            } catch (e) {
                console.error("DynamoDB Batch Error:", e);
            }
        }
        return results;
    }
}

export const awsService = new AWSService();
