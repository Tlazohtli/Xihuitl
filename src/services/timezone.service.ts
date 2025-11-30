import { dynamoDBService, resolveTableName } from "./dynamodb.service";
import { UserTimezone, TimezoneData } from "../types";

// Table name caches
const userTableCache: { value: string | null } = { value: null };
const timezoneTableCache: { value: string | null } = { value: null };

async function resolveUserTableName(): Promise<string> {
    return resolveTableName("DYNAMO_TABLE", "/xiuh/user-table-name", userTableCache);
}

async function resolveTimezoneTableName(): Promise<string> {
    return resolveTableName("TIMEZONE_TABLE", "/xiuh/timezone-table-name", timezoneTableCache);
}

/**
 * Service for managing user timezone data in DynamoDB
 */
export class UserTimezoneService {
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

    public async saveUser(userId: string, timezone: string, location: string): Promise<void> {
        const tableName = await resolveUserTableName();
        const item: UserTimezone = {
            user_id: userId,
            timezone: timezone,
            display_location: location,
            fetched_at: Date.now()
        };

        await dynamoDBService.putItem(tableName, {
            user_id: userId,
            timezone: timezone,
            display_location: location
        });

        this.cache.set(userId, item);
    }

    private async batchFetch(userIds: string[]): Promise<UserTimezone[]> {
        const tableName = await resolveUserTableName();
        const keys = userIds.map(id => ({ user_id: id }));
        return dynamoDBService.batchGetItems<UserTimezone>(tableName, keys);
    }
}

/**
 * Service for managing location timezone data in DynamoDB
 */
export class LocationTimezoneService {
    public async getLocation(locationName: string): Promise<TimezoneData | null> {
        const tableName = await resolveTimezoneTableName();
        return dynamoDBService.getItem<TimezoneData>(tableName, { location_name: locationName });
    }

    public async setLocation(locationName: string, timezone: string, displayLocation: string): Promise<void> {
        const tableName = await resolveTimezoneTableName();
        
        const item: TimezoneData = {
            location_name: locationName,
            timezone: timezone,
            display_location: displayLocation,
            cached_at: Date.now()
        };

        await dynamoDBService.putItem(tableName, item);
    }
}

export const userTimezoneService = new UserTimezoneService();
export const locationTimezoneService = new LocationTimezoneService();
