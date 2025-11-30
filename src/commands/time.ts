import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, Message } from 'discord.js';
import { DateTime } from 'luxon';
import { awsService } from '../services/aws.service';
import { getTimezoneFromLocation } from '../services/geo.service';
import { Command } from '../types';

const COOLDOWN_MS = 2 * 60 * 60 * 1000;
const lastReplyTimes = new Map<string, number>();

export const timeCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('time')
        .setDescription('Manage timezone settings')
        .addSubcommand(sub => 
            sub.setName('set')
            .setDescription('Set your location')
            .addStringOption(opt => opt.setName('location').setDescription('Location name').setRequired(true))
        )
        .addSubcommand(sub => 
            sub.setName('get')
            .setDescription('Get time for a user or location')
            .addUserOption(opt => opt.setName('user').setDescription('Select a user'))
            .addStringOption(opt => opt.setName('location').setDescription('Type a location'))
        )
        .addSubcommand(sub => 
            sub.setName('all')
            .setDescription('List time for everyone in this server')
        ),

    execute: async (interaction: ChatInputCommandInteraction) => {
        const sub = interaction.options.getSubcommand();

        if (sub === 'set') {
            await interaction.deferReply();
            const location = interaction.options.getString('location', true);
            const result = await getTimezoneFromLocation(location);

            if (!result) {
                await interaction.editReply("❌ Could not find that location. Please try again.");
                return;
            }

            await awsService.saveUser(interaction.user.id, result.timezone, result.address);
            
            const embed = new EmbedBuilder()
                .setTitle("📍 Location Updated")
                .setColor("Green")
                .setDescription(`**<@${interaction.user.id}>** set to:\n\`${result.address}\``);
            await interaction.editReply({ embeds: [embed] });
        }

        else if (sub === 'get') {
            const user = interaction.options.getUser('user');
            const location = interaction.options.getString('location');

            if ((user && location) || (!user && !location)) {
                await interaction.reply({ content: "❌ Please provide EITHER a user OR a location.", ephemeral: true });
                return;
            }

            if (user) {
                const data = await awsService.getSingleUser(user.id);
                if (!data) {
                    await interaction.reply({ content: "❌ That user hasn't set their timezone.", ephemeral: true });
                    return;
                }
                const time = DateTime.now().setZone(data.timezone);
                const embed = new EmbedBuilder()
                    .setColor("Blue")
                    .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
                    .setDescription(`🕒 **${time.toFormat("hh:mm a")}**\n📍 ${data.display_location}`);
                await interaction.reply({ embeds: [embed] });
            } 
            else if (location) {
                await interaction.deferReply();
                const result = await getTimezoneFromLocation(location);
                if (!result) {
                    await interaction.editReply("❌ Location not found. Please try again.");
                    return;
                }
                const time = DateTime.now().setZone(result.timezone);
                const embed = new EmbedBuilder()
                    .setTitle(`🕒 Time in ${result.address}`)
                    .setColor("Orange")
                    .setDescription(`**${time.toFormat("hh:mm a LLL dd")}**`);
                await interaction.editReply({ embeds: [embed] });
            }
        }

        else if (sub === 'all') {
            await interaction.deferReply();
            const members = await interaction.guild?.members.fetch();
            if (!members) return;

            const humanIds = members.filter(m => !m.user.bot).map(m => m.id);
            const usersData = await awsService.getUsers(humanIds);

            if (usersData.length === 0) {
                await interaction.editReply("No users have set their timezone.");
                return;
            }

            const sorted = usersData.map(u => {
                const time = DateTime.now().setZone(u.timezone);
                const member = members.get(u.user_id);
                return {
                    offset: time.offset,
                    text: `\`${time.toFormat("hh:mm a LLL dd")}\`\t**${member?.displayName || "Unknown"}**`
                };
            }).sort((a, b) => a.offset - b.offset);

            const chunk = sorted.map(s => s.text).slice(0, 20); 

            const embed = new EmbedBuilder()
                .setTitle("🌎 Server Timezones")
                .setColor("Blurple")
                .setDescription(chunk.join("\n"));
            await interaction.editReply({ embeds: [embed] });
        }
    }
};

export const handleTimeMentions = async (message: Message) => {
    if (!message.inGuild()) return;
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
            const displayName = message.guild?.members.cache.get(userId)?.displayName ?? user.username;
            await message.channel.send(`It is **${time.toFormat("hh:mm a")}** for ${displayName}.`);
            lastReplyTimes.set(userId, now);
        }
    }
};
