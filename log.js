const colorette = require('colorette');

const CONST = require('./constants.js');
const CONFIG = require('./config.js');


const SEVERITY_COLOUR_MAP = {
  [CONST.LOG_LEVEL_VERBOSE]: 'greenBright',
  [CONST.LOG_LEVEL_INFO]: 'blueBright',
  [CONST.LOG_LEVEL_MANDATORY]: 'yellowBright',
  [CONST.LOG_LEVEL_ERROR]: 'redBright',
};


const LOG = {
  blank: function () {
    console.log('');
  },

  fn: function (context, message, severity = CONST.LOG_LEVEL_VERBOSE, blankLineAfter = false) {
    // only output log message if severity is within current log output level config value
    if (severity <= CONFIG[CONST.CONFIG.LOG_LEVEL_TELETEXT_SERVER]) {
      let contextString = '';
      if (context) {
        contextString = Array.isArray(context) ?
          context.join('::') :
          context;

        contextString = `[${contextString}] `;
      }

      if (Array.isArray(message)) {
        for (let i in message) {
          console.log(
            colorette[SEVERITY_COLOUR_MAP[severity]](
              contextString + message[i]
            )
          );
        }

      } else {
        console.log(
          colorette[SEVERITY_COLOUR_MAP[severity]](
            contextString + message
          )
        );
      }

      if (blankLineAfter) {
        console.log('');
      }
    }
  },

  // re-export log levels for convenience
  LOG_LEVEL_VERBOSE: CONST.LOG_LEVEL_VERBOSE,
  LOG_LEVEL_INFO: CONST.LOG_LEVEL_INFO,
  LOG_LEVEL_MANDATORY: CONST.LOG_LEVEL_MANDATORY,
  LOG_LEVEL_ERROR: CONST.LOG_LEVEL_ERROR,
  LOG_LEVEL_NONE: CONST.LOG_LEVEL_NONE,
};


if (typeof exports === 'object') {
  module.exports = LOG;
}