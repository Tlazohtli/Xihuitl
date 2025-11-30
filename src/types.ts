import { SlashCommandBuilder, ChatInputCommandInteraction, SlashCommandSubcommandsOnlyBuilder } from "discord.js";

export interface UserTimezone {
    user_id: string;
    timezone: string;
    display_location: string;
    fetched_at?: number;
}

export interface TimezoneData {
    location_name: string;
    timezone: string;
    display_location: string;
    cached_at: number;
}

export interface Command {
    data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}
