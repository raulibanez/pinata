const pino = require('pino');

module.exports = pino({},
    pino.destination((process.env.NODE_ENV == 'dev') ? process.stdout : `${__dirname}/logger.log`)
);