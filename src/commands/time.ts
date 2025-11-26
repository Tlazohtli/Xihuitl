import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { DateTime } from 'luxon';
import { awsService } from '../services/aws.service';
import { getTimezoneFromCity } from '../services/geo.service';
import { Command } from '../types';

export const timeCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('time')
        .setDescription('Manage timezone settings')
        .addSubcommand(sub => 
            sub.setName('set')
            .setDescription('Set your location')
            .addStringOption(opt => opt.setName('city').setDescription('City name').setRequired(true))
        )
        .addSubcommand(sub => 
            sub.setName('get')
            .setDescription('Get time for a user or city')
            .addUserOption(opt => opt.setName('user').setDescription('Select a user'))
            .addStringOption(opt => opt.setName('city').setDescription('Type a city'))
        )
        .addSubcommand(sub => 
            sub.setName('all')
            .setDescription('List time for everyone in this server')
        ),

    execute: async (interaction: ChatInputCommandInteraction) => {
        const sub = interaction.options.getSubcommand();

        if (sub === 'set') {
            await interaction.deferReply();
            const city = interaction.options.getString('city', true);
            const result = await getTimezoneFromCity(city);

            if (!result) {
                await interaction.editReply("❌ Could not find that location.");
                return;
            }

            await awsService.saveUser(interaction.user.id, result.timezone, result.address);
            
            const embed = new EmbedBuilder()
                .setTitle("🌍 Location Updated")
                .setColor("Green")
                .setDescription(`**<@${interaction.user.id}>** set to:\n\`${result.address}\``);
            await interaction.editReply({ embeds: [embed] });
        }

        else if (sub === 'get') {
            const user = interaction.options.getUser('user');
            const city = interaction.options.getString('city');

            if ((user && city) || (!user && !city)) {
                await interaction.reply({ content: "❌ Please provide EITHER a user OR a city.", ephemeral: true });
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
            else if (city) {
                await interaction.deferReply();
                const result = await getTimezoneFromCity(city);
                if (!result) {
                    await interaction.editReply("❌ City not found.");
                    return;
                }
                const time = DateTime.now().setZone(result.timezone);
                const embed = new EmbedBuilder()
                    .setTitle(`🕒 Time in ${city}`)
                    .setColor("Orange")
                    .setDescription(`**${time.toFormat("hh:mm a")}**\n\`${result.address}\``);
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
                    text: `\`${time.toFormat("hh:mm a")}\` **${member?.displayName || "Unknown"}**`
                };
            }).sort((a, b) => a.offset - b.offset);

            const chunk = sorted.map(s => s.text).slice(0, 20); 

            const embed = new EmbedBuilder()
                .setTitle("🌍 Server Timezones")
                .setColor("Blurple")
                .setDescription(chunk.join("\n"));

            await interaction.editReply({ embeds: [embed] });
        }
    }
};