/* global CONST, CONFIG */
'use strict'
const LOG = {
  blank: function () {
    console.log('')
  },

  fn: function (context, message, severity = CONST.LOG_LEVEL_VERBOSE, blankLineAfter = false) {
    // only output log message if severity is within current log output level config value
    if (severity <= CONFIG[CONST.CONFIG.LOG_LEVEL_TELETEXT_VIEWER]) {
      let contextString = ''
      if (context) {
        contextString = Array.isArray(context)
          ? context.join('::')
          : context

        contextString = `[${contextString}] `
      }

      if (Array.isArray(message)) {
        for (const i in message) {
          console.log(contextString + message[i])
        }
      } else {
        console.log(contextString + message)
      }

      if (blankLineAfter) {
        console.log('')
      }
    }
  },

  // re-export log levels for convenience
  LOG_LEVEL_VERBOSE: CONST.LOG_LEVEL_VERBOSE,
  LOG_LEVEL_INFO: CONST.LOG_LEVEL_INFO,
  LOG_LEVEL_MANDATORY: CONST.LOG_LEVEL_MANDATORY,
  LOG_LEVEL_ERROR: CONST.LOG_LEVEL_ERROR,
  LOG_LEVEL_NONE: CONST.LOG_LEVEL_NONE
}

if (typeof exports === 'object') {
  module.exports = LOG
}
