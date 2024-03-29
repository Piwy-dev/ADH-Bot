const d = require('discord.js');

const mongo = require('../../db/mongo.js')

const muteSchema = require('../../db/mute-schema.js')

const config = require('../../config.json')

module.exports = {
    data: new d.SlashCommandBuilder()
        .setName("tempmute")
        .setDescription("Empêche un membre de parler pendant un certain temps.")
        .addUserOption((option) => option
            .setName("membre")
            .setDescription("Le membre qui sera unmute")
            .setRequired(true)
        )
        .addNumberOption((option) => option
            .setName("temps")
            .setDescription("Le temps de mute")
            .setRequired(true)
        )
        .addStringOption((option) => option
            .setName("raison")
            .setDescription("La raison du tempmute")
        )
        .setDefaultMemberPermissions(d.PermissionFlagsBits.ManageRoles),

    async execute(interaction, client) {
        const { member, guild, options, channel } = interaction

        await interaction.deferReply({ ephemeral: true }, )

        // Récupère le membre à mute
        const target = guild.members.cache.get(options.getUser("membre").id)

        if (!target) {
            interaction.editReply("Je n'ai pas pu trouver ce membre!");
            return;
        }

        // Récupère le rôle de mute
        const muteRole = guild.roles.cache.get(config.muteRoles[guild.id])
        if (!muteRole) return interaction.editReply("Je n'ai pas pu trouvé le role mute!")

        if (!target.roles.cache.has(muteRole.id)) return interaction.editReply("Ce membre n'est pas mute.")

        target.roles.remove(muteRole)

        await mongo().then(async(mongoose) => {
            try {
                // Trouve la liste des membres mutes
                const result = await muteSchema.findOne({ _id: guild.id })
                if (!result) return interaction.editReply("Il n'y a pas de membres mute dans le serveur.")

                // Trouve le membre cyble dans la liste
                const user = result.Users.findIndex((prop) => prop === target.id)
                if (user == -1) return interaction.editReply("Ce membre n'est pas mute")

                // Supprime le membre de la liste
                await result.Users.splice(user, 1)
                await result.save()
            } finally {
                mongoose.connection.close()
            }
        })

        // Envoie un message de confirmation
        interaction.editReply({
            content: `${target} a été unmute.`,
            ephemeral: true
        })

        // Envoie un message d'alerte aux membres du serveur
        const muteEmbed = new d.EmbedBuilder()
            .setColor('#1a965c')
            .setTitle('Un membre a été unmute !')
            .setDescription(`${target} a été unmute par ${member} !`)

        channel.send({
            embeds: [muteEmbed]
        })
    }
}