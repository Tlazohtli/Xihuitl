import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, Message } from 'discord.js';
import { DateTime } from 'luxon';
import { userTimezoneService } from '../services/timezone.service';
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

            await userTimezoneService.saveUser(interaction.user.id, result.timezone, result.address);
            
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
                const data = await userTimezoneService.getSingleUser(user.id);
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
            const usersData = await userTimezoneService.getUsers(humanIds);

            if (usersData.length === 0) {
                await interaction.editReply("No users have set their timezone.");
                return;
            }

            // Group users by timezone
            const timezoneGroups = new Map<string, typeof usersData>();
            for (const user of usersData) {
                if (!timezoneGroups.has(user.timezone)) {
                    timezoneGroups.set(user.timezone, []);
                }
                timezoneGroups.get(user.timezone)!.push(user);
            }

            // Build the formatted output
            const timezoneEntries = Array.from(timezoneGroups.entries()).map(([timezone, users]) => {
                const time = DateTime.now().setZone(timezone);
                const offsetMinutes = time.offset;
                
                // Format offset as UTC±HH or UTC±HH:MM (e.g., UTC+05, UTC-08:00)
                const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
                const offsetMins = Math.abs(offsetMinutes) % 60;
                const offsetSign = offsetMinutes >= 0 ? '+' : '-';
                const offsetString = offsetMins === 0
                    ? `UTC${offsetSign}${offsetHours.toString().padStart(2, '0')}`
                    : `UTC${offsetSign}${offsetHours.toString().padStart(2, '0')}:${offsetMins.toString().padStart(2, '0')}`;
                
                // Use canonical IANA timezone identifier (e.g., "America/New_York")
                const zoneName = timezone.replace(/_/g, ' ');

                // Format users in this timezone
                const userList = users.map(u => {
                    const member = members.get(u.user_id);
                    return `\u2003${member?.displayName || "Unknown"}`;
                }).join("\n");

                return {
                    offset: offsetMinutes,
                    text: `\`${time.toFormat("hh:mm a LLL dd")}\` - **${zoneName}**\n${userList}`
                };
            }).sort((a, b) => a.offset - b.offset);

            const description = timezoneEntries.map(e => e.text).join("\n");

            const embed = new EmbedBuilder()
                .setTitle("🌎 Server Timezones")
                .setColor("Blurple")
                .setDescription(description);
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

        const data = await userTimezoneService.getSingleUser(userId);
        if (data) {
            const time = DateTime.now().setZone(data.timezone);
            const displayName = message.guild?.members.cache.get(userId)?.displayName ?? user.username;
            await message.channel.send(`It is **${time.toFormat("hh:mm a")}** for ${displayName}.`);
            lastReplyTimes.set(userId, now);
        }
    }
};
