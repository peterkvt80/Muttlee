const CONST = require('./constants.js');


const CONFIG = {
  [CONST.CONFIG.LOG_LEVEL_TELETEXT_SERVER]: CONST.LOG_LEVEL_VERBOSE,
  [CONST.CONFIG.LOG_LEVEL_TELETEXT_VIEWER]: CONST.LOG_LEVEL_VERBOSE,

  [CONST.CONFIG.BASE_DIR]: '/var/www/',

  [CONST.CONFIG.LOGO_SVG_PATH]: '/var/www/private/muttlee_logo.svg',
  [CONST.CONFIG.SHOW_CONSOLE_LOGO]: true,
  [CONST.CONFIG.CONSOLE_LOGO_CHAR_ARRAY]: [
    '████████████          ███     ███   ███              ',
    '███ ██ ██ ██ ███ ██ ███████ ███████ ███ ██████ ██████',
    '███ ██ ██ ██ ███ ██   ███     ███   ███ ███ ██ ███ ██',
    '███ ██ ██ ██ ███ ██   ███     ███   ███ ██████ ██████',
    '███ ██ ██ ██ ███ ██   ███     ███   ███ ███    ███   ',
    '███ ██ ██ ██ ██████   █████   █████ ███ ██████ ██████',
  ],

  [CONST.CONFIG.TITLE]: 'Muttlee',
  [CONST.CONFIG.HEADER_TITLE]: 'Teefax',

  // Banned IP addresses, all of them Amazon AWS bots making annoying connections during debugging
  [CONST.CONFIG.BANNED_IP_ADDRESSES]: [
    '54.159.215.81',
    '54.161.11.39',
    '54.235.50.87',
    '54.162.45.98',
    '54.162.186.216',
  ],

  // Which teletext socket.io server should the viewer connect to?
  // (Note: set a protocol independent url, so that http and https can both be accommodated)
  //
  // To use this local teletext server, set TELETEXT_SERVER_URL to '//localhost'
  // (also ensure that TELETEXT_SERVER_PORT matches one of the enabled
  //  TELETEXT_VIEWER_SERVE_HTTPS_PORT or TELETEXT_VIEWER_SERVE_HTTPS_PORT below)
  [CONST.CONFIG.TELETEXT_SERVER_URL]: '//www.xenoxxx.com',
  [CONST.CONFIG.TELETEXT_SERVER_PORT]: 80,

  [CONST.CONFIG.TELETEXT_VIEWER_SERVE_HTTP]: true,
  [CONST.CONFIG.TELETEXT_VIEWER_SERVE_HTTP_PORT]: 8080,

  [CONST.CONFIG.TELETEXT_VIEWER_SERVE_HTTPS]: false,
  [CONST.CONFIG.TELETEXT_VIEWER_SERVE_HTTPS_PORT]: 443,

  // Use LetsEncrypt (recommended), or otherwise OpenSSL to generate a local unsigned certificate
  // (will raise a warning in the visitor's web browser):
  //    > openssl req -x509 -newkey rsa:2048 -keyout keytmp.pem -out cert.pem -days 365
  //    > openssl rsa -in keytmp.pem -out key.pem
  [CONST.CONFIG.TELETEXT_VIEWER_SERVE_HTTPS_KEY_PATH]: '/var/www/key.pem',
  [CONST.CONFIG.TELETEXT_VIEWER_SERVE_HTTPS_CERT_PATH]: '/var/www/cert.pem',

  // Allow the viewer to make HTTPS socket.io connections even if SSL certificate is not fully valid?
  // DO NOT SET THIS TO TRUE IN PRODUCTION!
  [CONST.CONFIG.TELETEXT_VIEWER_HTTPS_REJECT_UNAUTHORIZED]: false,

  [CONST.CONFIG.DEFAULT_MENU_OPEN]: true,

  [CONST.CONFIG.DEFAULT_SCALE]: 1,

  [CONST.CONFIG.CANVAS_WIDTH]: 600,
  [CONST.CONFIG.CANVAS_HEIGHT]: 550,


  // explicitly whitelist config values that are available in the frontend
  [CONST.CONFIG.FRONTEND_CONFIG_KEYS]: [
    CONST.CONFIG.LOG_LEVEL_TELETEXT_VIEWER,

    CONST.CONFIG.TITLE,
    CONST.CONFIG.HEADER_TITLE,

    CONST.CONFIG.TELETEXT_SERVER_URL,
    CONST.CONFIG.TELETEXT_SERVER_PORT,

    CONST.CONFIG.TELETEXT_VIEWER_SERVE_HTTP,
    CONST.CONFIG.TELETEXT_VIEWER_SERVE_HTTP_PORT,

    CONST.CONFIG.TELETEXT_VIEWER_SERVE_HTTPS,
    CONST.CONFIG.TELETEXT_VIEWER_SERVE_HTTPS_PORT,

    CONST.CONFIG.TELETEXT_VIEWER_HTTPS_REJECT_UNAUTHORIZED,

    CONST.CONFIG.DEFAULT_MENU_OPEN,

    CONST.CONFIG.DEFAULT_SCALE,

    CONST.CONFIG.CANVAS_WIDTH,
    CONST.CONFIG.CANVAS_HEIGHT,
  ],
};


if (typeof exports === 'object') {
  module.exports = CONFIG;
}