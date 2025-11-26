import { Client, GatewayIntentBits, Collection } from 'discord.js';
import * as dotenv from 'dotenv';
import { DateTime } from 'luxon';
import { awsService } from './services/aws.service';
import { Command } from './types';
import { timeCommand } from './commands/time';

dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN!;
const COOLDOWN_MS = 2 * 60 * 60 * 1000;

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

const lastReplyTimes = new Map<string, number>();

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (message.mentions.users.size === 0) return;

    const now = Date.now();
    for (const [userId, user] of message.mentions.users) {
        if (user.bot) continue;

        const lastSeen = lastReplyTimes.get(userId);
        if (lastSeen && (now - lastSeen) < COOLDOWN_MS) continue;

        const data = await awsService.getSingleUser(userId);
        if (data) {
            const time = DateTime.now().setZone(data.timezone);
            await message.channel.send(`🕒 It is **${time.toFormat("hh:mm a")}** for <@${userId}>.`);
            lastReplyTimes.set(userId, now);
        }
    }
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user?.tag}`);
});

client.login(TOKEN);