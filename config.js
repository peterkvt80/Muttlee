const CONST = require('./constants.js');


const CONFIG = {
  [CONST.CONFIG.IS_DEV]: false,

  [CONST.CONFIG.LOG_LEVEL_TELETEXT_SERVER]: CONST.LOG_LEVEL_VERBOSE,
  [CONST.CONFIG.LOG_LEVEL_TELETEXT_VIEWER]: CONST.LOG_LEVEL_INFO,

  // this is used by `update-service-pages.js` as the place where the
  // raw source service pages directories (likely SVN repositories)
  // are located.
  // (Note: service pages are not actually served by Muttlee from here
  //  they need additional renaming first, and are then served from
  //  CONST.CONFIG.SERVICE_PAGES_SERVE_DIR defined below).
  [CONST.CONFIG.SERVICE_PAGES_DIR]: '/var/www/teletext-services',

  // (Note: this is the root directory for the live service pages,
  //  within it should be individual service subdirectories
  //  e.g. /var/www/private/onair/teefax, /var/www/private/onair/d2k,
  //  etc. matching the id's of the services defined below in
  //  CONST.CONFIG.SERVICES_AVAILABLE)
  [CONST.CONFIG.SERVICE_PAGES_SERVE_DIR]: '/var/www/private/onair',

  [CONST.CONFIG.PAGE_404_PATH]: '/var/www/private/p404.tti',
  [CONST.CONFIG.PAGE_404_EDITABLE_PATH]: '/var/www/private/p404_editable.tti',

  [CONST.CONFIG.LOGO_SVG_PATH]: '/var/www/private/muttlee_logo.svg',
  [CONST.CONFIG.ZAPPER_STANDARD_SVG_PATH]: '/var/www/private/zapper_standard.svg',
  [CONST.CONFIG.ZAPPER_COMPACT_SVG_PATH]: '/var/www/private/zapper_compact.svg',

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


  // service definitions, in the following format:
  //   [id_of_service]: {
  //     // (optional) group name of service
  //     group: str,
  //     // display name of service
  //     name: str,
  //     // (optional) service credit
  //     credit: str,
  //
  //     // url should be protocol independent (start with //), so that http and https can both be accommodated)
  //     //
  //     // To use this local teletext server, set `url` to '//localhost'
  //     // (also ensure that `port` matches one of the enabled
  //     //  TELETEXT_VIEWER_SERVE_HTTPS_PORT or TELETEXT_VIEWER_SERVE_HTTPS_PORT above)
  //     url: str,
  //     port: int,
  //
  //     // (optional) whether the service is considered editable - false if not defined
  //     isEditable: bool,
  //
  //     // (optional) a SVN repository containing the service's pages
  //     updateUrl: str,
  //     // (optional) number of minutes to wait before checking for updates
  //     updateInterval: int,
  //   }
  [CONST.CONFIG.SERVICES_AVAILABLE]: {
    [CONST.SERVICE_TEEFAX]: {
      name: 'Teefax',
      url: '//www.xenoxxx.com',
      port: 80,

      updateUrl: 'http://teastop.plus.com/svn/teletext/',
      updateInterval: 60,
    },

    // [CONST.SERVICE_AMIGAROB]: {
    //   name: 'Amiga Rob',
    //   url: '//www.xenoxxx.com',
    //   port: 80,
    //
    //   isEditable: true,
    // },

    [CONST.SERVICE_ARTFAX]: {
      name: 'Artfax',
      url: '//www.xenoxxx.com',
      port: 80,

      isEditable: true,
    },

    [CONST.SERVICE_BBC1980]: {
      name: 'BBC 1980',
      url: '//www.xenoxxx.com',
      port: 80,
    },

    // [CONST.SERVICE_CHANNEL19]: {
    //   name: 'Channel 19',
    //   url: '//www.xenoxxx.com',
    //   port: 80,
    //
    //   isEditable: true,
    // },

    // [CONST.SERVICE_CHRISLUCA]: {
    //   name: 'Chris Luca',
    //   url: '//www.xenoxxx.com',
    //   port: 80,
    // },

    [CONST.SERVICE_DIGITISER]: {
      name: 'Digitiser2000',
      url: '//www.xenoxxx.com',
      port: 80,

      updateUrl: 'http://teastop.plus.com/svn/digitiser2k/',
      updateInterval: 60,
    },

    [CONST.SERVICE_KINDIE]: {
      name: 'Kindie',
      url: '//www.xenoxxx.com',
      port: 80,
    },

    [CONST.SERVICE_ARCHIVE]: {
      name: 'Archive',
      url: '//www.xenoxxx.com',
      port: 80,
    },

    [CONST.SERVICE_TURNER]: {
      name: 'Turner the Worm',
      url: '//www.xenoxxx.com',
      port: 80,
    },

    [CONST.SERVICE_WIKI]: {
      name: 'Wiki',
      url: '//www.xenoxxx.com',
      port: 80,

      isEditable: true,
    },


    // NMS Ceefax services
    [CONST.SERVICE_NMS_CEEFAX__WORLDWIDE]: {
      group: 'NMS Ceefax',
      name: 'Worldwide',
      credit: 'Pages via <a href="https://www.nathanmediaservices.co.uk/teletext-viewer/">NMS Ceefax</a>',
      url: '//www.xenoxxx.com',
      port: 80,

      updateUrl: 'https://internal.nathanmediaservices.co.uk/svn/ceefax/Worldwide',
      updateInterval: 30,
    },

    [CONST.SERVICE_NMS_CEEFAX__NATIONAL]: {
      group: 'NMS Ceefax',
      name: 'National',
      credit: 'Pages via <a href="https://www.nathanmediaservices.co.uk/teletext-viewer/">NMS Ceefax</a>',
      url: '//www.xenoxxx.com',
      port: 80,

      updateUrl: 'https://internal.nathanmediaservices.co.uk/svn/ceefax/national',
      updateInterval: 30,
    },

    [CONST.SERVICE_NMS_CEEFAX__EAST]: {
      group: 'NMS Ceefax',
      name: 'East',
      credit: 'Pages via <a href="https://www.nathanmediaservices.co.uk/teletext-viewer/">NMS Ceefax</a>',
      url: '//www.xenoxxx.com',
      port: 80,

      updateUrl: 'https://internal.nathanmediaservices.co.uk/svn/ceefax/East',
      updateInterval: 30,
    },

    [CONST.SERVICE_NMS_CEEFAX__EASTMIDLANDS]: {
      group: 'NMS Ceefax',
      name: 'East Midlands',
      credit: 'Pages via <a href="https://www.nathanmediaservices.co.uk/teletext-viewer/">NMS Ceefax</a>',
      url: '//www.xenoxxx.com',
      port: 80,

      updateUrl: 'https://internal.nathanmediaservices.co.uk/svn/ceefax/EastMidlands',
      updateInterval: 30,
    },

    [CONST.SERVICE_NMS_CEEFAX__LONDON]: {
      group: 'NMS Ceefax',
      name: 'London',
      credit: 'Pages via <a href="https://www.nathanmediaservices.co.uk/teletext-viewer/">NMS Ceefax</a>',
      url: '//www.xenoxxx.com',
      port: 80,

      updateUrl: 'https://internal.nathanmediaservices.co.uk/svn/ceefax/London',
      updateInterval: 30,
    },

    [CONST.SERVICE_NMS_CEEFAX__NORTHERNIRELAND]: {
      group: 'NMS Ceefax',
      name: 'Northern Ireland',
      credit: 'Pages via <a href="https://www.nathanmediaservices.co.uk/teletext-viewer/">NMS Ceefax</a>',
      url: '//www.xenoxxx.com',
      port: 80,

      updateUrl: 'https://internal.nathanmediaservices.co.uk/svn/ceefax/NorthernIreland',
      updateInterval: 30,
    },

    [CONST.SERVICE_NMS_CEEFAX__SCOTLAND]: {
      group: 'NMS Ceefax',
      name: 'Scotland',
      credit: 'Pages via <a href="https://www.nathanmediaservices.co.uk/teletext-viewer/">NMS Ceefax</a>',
      url: '//www.xenoxxx.com',
      port: 80,

      updateUrl: 'https://internal.nathanmediaservices.co.uk/svn/ceefax/Scotland',
      updateInterval: 30,
    },

    [CONST.SERVICE_NMS_CEEFAX__SOUTH]: {
      group: 'NMS Ceefax',
      name: 'South',
      credit: 'Pages via <a href="https://www.nathanmediaservices.co.uk/teletext-viewer/">NMS Ceefax</a>',
      url: '//www.xenoxxx.com',
      port: 80,

      updateUrl: 'https://internal.nathanmediaservices.co.uk/svn/ceefax/South',
      updateInterval: 30,
    },

    [CONST.SERVICE_NMS_CEEFAX__SOUTHWEST]: {
      group: 'NMS Ceefax',
      name: 'South West',
      credit: 'Pages via <a href="https://www.nathanmediaservices.co.uk/teletext-viewer/">NMS Ceefax</a>',
      url: '//www.xenoxxx.com',
      port: 80,

      updateUrl: 'https://internal.nathanmediaservices.co.uk/svn/ceefax/SouthWest',
      updateInterval: 30,
    },

    [CONST.SERVICE_NMS_CEEFAX__WEST]: {
      group: 'NMS Ceefax',
      name: 'West',
      credit: 'Pages via <a href="https://www.nathanmediaservices.co.uk/teletext-viewer/">NMS Ceefax</a>',
      url: '//www.xenoxxx.com',
      port: 80,

      updateUrl: 'https://internal.nathanmediaservices.co.uk/svn/ceefax/West',
      updateInterval: 30,
    },

    [CONST.SERVICE_NMS_CEEFAX__YORKSLINCS]: {
      group: 'NMS Ceefax',
      name: 'Yorks & Lincs',
      credit: 'Pages via <a href="https://www.nathanmediaservices.co.uk/teletext-viewer/">NMS Ceefax</a>',
      url: '//www.xenoxxx.com',
      port: 80,

      updateUrl: 'https://internal.nathanmediaservices.co.uk/svn/ceefax/Yorks&Lincs',
      updateInterval: 30,
    },
  },


  // defaults
  [CONST.CONFIG.DEFAULT_SERVICE]: CONST.SERVICE_TEEFAX,
  [CONST.CONFIG.OPEN_SERVICE_IN_NEW_WINDOW]: false,

  [CONST.CONFIG.DEFAULT_CONTROLS]: CONST.CONTROLS_STANDARD,
  [CONST.CONFIG.DEFAULT_DISPLAY]: CONST.DISPLAY_STANDARD,
  [CONST.CONFIG.DEFAULT_MENU_OPEN]: true,
  [CONST.CONFIG.DEFAULT_SCALE]: 1,
  [CONST.CONFIG.DEFAULT_AUTOPLAY]: CONST.AUTOPLAY_NONE,

  [CONST.CONFIG.DEFAULT_AUTOPLAY_INTERVAL]: 35,       // seconds
  [CONST.CONFIG.DEFAULT_AUTOSAVE_INTERVAL]: 60,       // seconds


  // rendering
  [CONST.CONFIG.NUM_COLUMNS]: 40,
  [CONST.CONFIG.NUM_ROWS]: 25,

  [CONST.CONFIG.CANVAS_WIDTH]: 562,
  [CONST.CONFIG.CANVAS_HEIGHT]: 510,
  [CONST.CONFIG.CANVAS_PADDING_RIGHT_SINGLE_COLUMN]: true,


  // explicitly whitelist config values that are available in the frontend
  [CONST.CONFIG.FRONTEND_CONFIG_KEYS]: [
    CONST.CONFIG.LOG_LEVEL_TELETEXT_VIEWER,

    CONST.CONFIG.TITLE,
    CONST.CONFIG.HEADER_TITLE,

    CONST.CONFIG.TELETEXT_VIEWER_SERVE_HTTP,
    CONST.CONFIG.TELETEXT_VIEWER_SERVE_HTTP_PORT,

    CONST.CONFIG.TELETEXT_VIEWER_SERVE_HTTPS,
    CONST.CONFIG.TELETEXT_VIEWER_SERVE_HTTPS_PORT,

    CONST.CONFIG.TELETEXT_VIEWER_HTTPS_REJECT_UNAUTHORIZED,

    CONST.CONFIG.SERVICES_AVAILABLE,

    CONST.CONFIG.DEFAULT_SERVICE,
    CONST.CONFIG.DEFAULT_CONTROLS,
    CONST.CONFIG.DEFAULT_DISPLAY,
    CONST.CONFIG.DEFAULT_MENU_OPEN,
    CONST.CONFIG.DEFAULT_SCALE,
    CONST.CONFIG.DEFAULT_AUTOPLAY,

    CONST.CONFIG.DEFAULT_AUTOPLAY_INTERVAL,
    CONST.CONFIG.DEFAULT_AUTOSAVE_INTERVAL,

    CONST.CONFIG.OPEN_SERVICE_IN_NEW_WINDOW,

    CONST.CONFIG.NUM_COLUMNS,
    CONST.CONFIG.NUM_ROWS,

    CONST.CONFIG.CANVAS_WIDTH,
    CONST.CONFIG.CANVAS_HEIGHT,
    CONST.CONFIG.CANVAS_PADDING_RIGHT_SINGLE_COLUMN,
  ],
};


if (typeof exports === 'object') {
  module.exports = CONFIG;
}