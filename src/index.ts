import { Client, GatewayIntentBits, Collection } from 'discord.js';
import * as dotenv from 'dotenv';
import { DateTime } from 'luxon';
import { awsService } from './services/aws.service';
import { Command } from './types';
import { timeCommand, handleTimeMentions } from './commands/time';

dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN!;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const commands = new Collection<string, Command>();
commands.set(timeCommand.data.name, timeCommand);

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        const reply = { content: 'There was an error executing this command!', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply);
        } else {
            await interaction.reply(reply);
        }
    }
});

client.on('messageCreate', handleTimeMentions);

client.once('clientReady', () => {
    console.log(`Logged in as ${client.user?.tag}`);
});

client.login(TOKEN);