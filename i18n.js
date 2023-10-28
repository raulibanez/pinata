const { I18n, __ } = require('i18n');

// Setup i18n
const i18n = new I18n();
i18n.configure({
  locales: ['en', 'es'],
  defaultLocale: 'en',
  directory: './locales'
});

// function translate
function t (p, l = 'en', ph) {
  return i18n.__({ phrase: p, locale: l}, ph)
}

module.exports = {
    i18n, t
};