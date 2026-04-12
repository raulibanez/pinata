require('dotenv').config({path: '../.env'});
const dedent = require('dedent-js');
const { t } = require('./i18n');
const path = require('path');

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const matchMsg = (member, match, avatarURL, lang = 'en') => {
    // Build message
    const description =
        t(`Ole! 💃 **<@{{match}}>** golpeó la piñata y ha salido ... 🎉`, lang, {match: member}) + '\n\n' +
        match.map((user) => { return `**${user}**` }).join(` ${t('y', lang)} \n`);

    const pinataEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setThumbnail(avatarURL)
        .setDescription(description)
        .addFields({ name: '\u200B', value: t('**Instrucciones** 🎊', lang) })
        .addFields({ name: '\u200B', value: t('➡️ Busca a tu pareja y salúdale (un «hola!» 👋 suele funcionar bien).', lang) });

    return pinataEmbed;
}

const pinataMsg = (lang = 'en') => {
    // Create message
    // Get random number fron 1 to 11
    const randomThumb = Math.floor(Math.random() * process.env.NUM_THUMBS) + 1;
    const thumbURL = `https://pinatabot.s3.eu-west-1.amazonaws.com/pinata${randomThumb}.jpg`;

    const pinataEmbed = new EmbedBuilder()
    .setTitle(t('Piñata', lang))
    .setColor('#0099ff')
    .setThumbnail(thumbURL)
    .setDescription(t('Pulsa el botón para abrir la piñata y ver quién te ha tocado!', lang))
    .setTimestamp()
    .setFooter({ text: 'getpinata.com', iconURL: 'https://pinatabot.s3.eu-west-1.amazonaws.com/pinata7.jpg' });
  
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('openPinata')
          .setEmoji('🎉')
          .setLabel(t('Abre la Piñata!', lang))
          .setStyle(ButtonStyle.Primary)
      );

    return { embeds: [pinataEmbed], components: [row] };
}

const languageModifiedMsg = (lang = 'en') => {
    return t('El idioma se ha configurado correctamente 👍', lang);
  }
  
const currentLanguageMsg = (lang = 'en') => {
    const languageString = 
        (lang == 'en') ? 'English' :
        (lang == 'es') ? 'Español' :
        t('Desconocido', lang);

    const languageEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .addFields(
        { name: t('Idioma', lang), value: languageString },
        { name: t('Ayuda', lang), value: t('Utiliza el comando `/language` seguido del idioma que quieras utilizar.', lang) },
        );

    return languageEmbed;
}

const publicMatchMsg = (member, match, avatarURL, lang = 'en') => {
    // Encouragement sentences
    const ramdonSentences = [
        '*¡Qué suerte!* 🍀',
        '*Ahora ya tienen un amigo para jugar!* 🕹️',
        '*Quién de ellos ganaría en una partida de Ping Pong* 🏓',
        '*Juntos dominarán la galaxia* ✨',
        '*Vaya vaya, que sorpresa* 😯',
        '*El cielo está enladrillado, pero ellos los desenladrillarán* 🧱',
        '*Se conocen de vista, pero ahora podrán ser amigos* 👋',
        '*Y se fueron en una, empezaro\' a la una* 🎵',
    ];

    // Build message
    const description =
        t(`Ole! 💃 **<@{{match}}>** golpeó la piñata y ha salido ... 🎉`, lang, {match: member}) + '\n\n' +
        match.map((user) => { return `**${user}**` }).join(` ${t('y', lang)} \n`) + '\n\n' +
        t(`INTRO_${Math.floor(Math.random() * process.env.NUM_INTROS) + 1}`, lang);

    const pinataEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setThumbnail(avatarURL)
        .setDescription(description);

    return pinataEmbed;
}

const visibilityModifiedMsg = (lang = 'en') => {
    return t('Message visibility has been changed 👍', lang);
}
  
const currentVisibilityMsg = (visibility, lang = 'en') => {
    const defaultMsg = t('_No configurado_', lang);

    const visibilityEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .addFields(
        { name: t('Message visibility', lang), value: t(visibility, lang) },
        { name: t('Ayuda', lang), value: t('Utiliza el comando `/visibility` para que los mensajes del bot sean públicos o privados.', lang) },
        );

    return visibilityEmbed;
}

const lateMatchingModifiedMsg = (lang = 'en') => {
    return t('Late matching has been changed 👍', lang);
}

const currentLateMatchingMsg = (lateMatching, lang = 'en') => {
    const value = lateMatching ? t(lateMatching, lang) : t('disabled', lang);

    const lateMatchingEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .addFields(
        { name: t('Late matching', lang), value: value },
        { name: t('Ayuda', lang), value: t('Utiliza el comando `/late` para activar o desactivar el emparejamiento tardío.', lang) },
        );

    return lateMatchingEmbed;
}

module.exports = {
    matchMsg,
    pinataMsg,
    languageModifiedMsg,
    currentLanguageMsg,
    publicMatchMsg,
    visibilityModifiedMsg,
    currentVisibilityMsg,
    lateMatchingModifiedMsg,
    currentLateMatchingMsg
};