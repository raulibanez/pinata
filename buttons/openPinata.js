module.exports = {
    name: 'openPinata',
	async execute(interaction) {
        interaction.client.commands.get('pinata').execute(interaction);
    },
}