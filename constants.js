"use strict";
const CONST = {
  // page numbers
  PAGE_MIN: 0x100,
  // PAGE_MAX: 0x8ff, // This is the proper value
  PAGE_MAX: 0x9ff, // However, Muttlee can make forbidden pages

  PAGE_404: 0x404,

  // page files
  PAGE_EXT_TTI: '.tti',
  ENCODING_ASCII: 'ascii',

  // log levels
  LOG_LEVEL_VERBOSE: 3,
  LOG_LEVEL_INFO: 2,
  LOG_LEVEL_MANDATORY: 1,
  LOG_LEVEL_ERROR: 0,
  LOG_LEVEL_NONE: -1,

  // custom HTML attributes
  ATTR_DATA_SERVICE: 'data-service',
  ATTR_DATA_SERVICE_MANIFEST: 'data-service-manifest',
  ATTR_DATA_SERVICE_EDITABLE: 'data-service-editable',
  ATTR_DATA_READY: 'data-ready',

  ATTR_DATA_CONTROLS: 'data-controls',
  ATTR_DATA_DISPLAY: 'data-display',
  ATTR_DATA_SCALE: 'data-scale',
  ATTR_DATA_AUTOPLAY: 'data-autoplay',
  ATTR_DATA_GRID: 'data-grid',
  ATTR_DATA_MENU_OPEN: 'data-menu-open',

  // edit modes
  EDITMODE_NORMAL: 0,    // normal viewing
  EDITMODE_EDIT: 1,      // edit mode
  EDITMODE_ESCAPE: 2,    // expect next character to be either an edit.tf function or Escape again to exit.
  EDITMODE_INSERT: 3,    // The next character is ready to insert. Not sure what this does. @todo
  EDITMODE_PROPERTIES: 4,// Editing page properties. Description, X26/X28 enhancements etc.
  EDITMODE_MAX: 5,       // Range check       

  // state signals
  SIGNAL_PAGE_NOT_FOUND: -1,
  SIGNAL_INITIAL_LOAD: 2000,
  SIGNAL_DESCRIPTION_CHANGE: 2001,

  // display modes
  DISPLAY_STANDARD: 'standard',
  DISPLAY_FITSCREEN: 'fitscreen',
  DISPLAY_FULLSCREEN: 'fullscreen',

  // control modes
  CONTROLS_STANDARD: 'standard',
  CONTROLS_ZAPPER: 'zapper',
  CONTROLS_MINIMAL: 'minimal',
  CONTROLS_BIGSCREEN: 'bigscreen',

  // autoplay modes
  AUTOPLAY_NONE: 'none',
  AUTOPLAY_SEQUENTIAL: 'sequential',
  AUTOPLAY_RANDOM: 'random',

  // services
  // (these ID's are also the name of the subdirectories of
  //  CONFIG.SERVICE_PAGES_DIR and CONFIG.SERVICE_PAGES_SERVE_DIR
  //  that contains the service's pages)
  SERVICE_TEEFAX: 'teefax',
  SERVICE_SPARK: 'spark',
  SERVICE_ARTFAX: 'artfax',
  SERVICE_NEMETEXT: 'nemetext',
  // SERVICE_AMIGAROB: 'amigarob',
  SERVICE_BBC1980: 'bbc1980',
  SERVICE_DIGITISER: 'd2k',
  SERVICE_KINDIE: 'kindie',
  SERVICE_ARCHIVE: 'readback',
  SERVICE_TURNER: 'turner',
  SERVICE_WIKI: 'wtf',
  //SERVICE_CHANNEL19: 'channel19',
  //SERVICE_CHRISLUCA: 'chrisluca',
  

  SERVICE_NMS_CEEFAX_NATIONAL: 'nms_cf_national',
  //SERVICE_NMS_CEEFAX__EAST: 'nms_cf_east',
  //SERVICE_NMS_CEEFAX__EASTMIDLANDS: 'nms_cf_eastmidlands',
  //SERVICE_NMS_CEEFAX__LONDON: 'nms_cf_london',
  //SERVICE_NMS_CEEFAX__NORTHERNIRELAND: 'nms_cf_northernireland',
  //SERVICE_NMS_CEEFAX__SCOTLAND: 'nms_cf_scotland',
  //SERVICE_NMS_CEEFAX__SOUTH: 'nms_cf_south',
  //SERVICE_NMS_CEEFAX__SOUTHWEST: 'nms_cf_southwest',
  //SERVICE_NMS_CEEFAX__WALES: 'nms_cf_wales',
  //SERVICE_NMS_CEEFAX__WEST: 'nms_cf_west',
  //SERVICE_NMS_CEEFAX__YORKSLINCS: 'nms_cf_yorkslincs',

  // config keys
  CONFIG: {
    IS_DEV: 'IS_DEV',

    LOG_LEVEL_TELETEXT_SERVER: 'LOG_LEVEL_TELETEXT_SERVER',
    LOG_LEVEL_TELETEXT_VIEWER: 'LOG_LEVEL_TELETEXT_VIEWER',

    SERVICE_PAGES_DIR: 'SERVICE_PAGES_DIR',
    SERVICE_PAGES_SERVE_DIR: 'SERVICE_PAGES_SERVE_DIR',

    PAGE_404_PATH: 'PAGE_404_PATH',
    PAGE_404_EDITABLE_PATH: 'PAGE_404_EDITABLE_PATH',

    LOGO_SVG_PATH: 'LOGO_SVG_PATH',
    ZAPPER_STANDARD_SVG_PATH: 'ZAPPER_STANDARD_SVG_PATH',
    ZAPPER_COMPACT_SVG_PATH: 'ZAPPER_COMPACT_SVG_PATH',

    SHOW_CONSOLE_LOGO: 'SHOW_CONSOLE_LOGO',
    CONSOLE_LOGO_CHAR_ARRAY: 'CONSOLE_LOGO_CHAR_ARRAY',

    TITLE: 'TITLE',
    HEADER_TITLE: 'HEADER_TITLE',

    BANNED_IP_ADDRESSES: 'BANNED_IP_ADDRESSES',

    TELETEXT_VIEWER_SERVE_HTTP: 'TELETEXT_VIEWER_SERVE_HTTP',
    TELETEXT_VIEWER_SERVE_HTTP_PORT: 'TELETEXT_VIEWER_SERVE_HTTP_PORT',

    TELETEXT_VIEWER_SERVE_HTTPS: 'TELETEXT_VIEWER_SERVE_HTTPS',
    TELETEXT_VIEWER_SERVE_HTTPS_PORT: 'TELETEXT_VIEWER_SERVE_HTTPS_PORT',
    TELETEXT_VIEWER_SERVE_HTTPS_KEY_PATH: 'TELETEXT_VIEWER_SERVE_HTTPS_KEY_PATH',
    TELETEXT_VIEWER_SERVE_HTTPS_CERT_PATH: 'TELETEXT_VIEWER_SERVE_HTTPS_CERT_PATH',

    TELETEXT_VIEWER_HTTPS_REJECT_UNAUTHORIZED: 'TELETEXT_VIEWER_HTTPS_REJECT_UNAUTHORIZED',

    SERVICES_AVAILABLE: 'SERVICES_AVAILABLE',

    DEFAULT_SERVICE: 'DEFAULT_SERVICE',
    DEFAULT_CONTROLS: 'DEFAULT_CONTROLS',
    DEFAULT_DISPLAY: 'DEFAULT_DISPLAY',
    DEFAULT_MENU_OPEN: 'DEFAULT_MENU_OPEN',
    DEFAULT_SCALE: 'DEFAULT_SCALE',
    DEFAULT_AUTOPLAY: 'DEFAULT_AUTOPLAY',

    DEFAULT_AUTOPLAY_INTERVAL: 'DEFAULT_AUTOPLAY_INTERVAL',
    DEFAULT_AUTOSAVE_INTERVAL: 'DEFAULT_AUTOSAVE_INTERVAL',

    OPEN_SERVICE_IN_NEW_WINDOW: 'OPEN_SERVICE_IN_NEW_WINDOW',

    // rendering
    NUM_COLUMNS: 'NUM_COLUMNS',
    NUM_ROWS: 'NUM_ROWS',

    CANVAS_WIDTH: 'CANVAS_WIDTH',
    CANVAS_HEIGHT: 'CANVAS_HEIGHT',
    CANVAS_PADDING_RIGHT_SINGLE_COLUMN: 'CANVAS_PADDING_RIGHT_SINGLE_COLUMN',
    TELETEXT_FONT_SIZE: 'TELETEXT_FONT_SIZE',


    FRONTEND_CONFIG_KEYS: 'FRONTEND_CONFIG_KEYS',
    
  },
  // UI Fields for property editing
  UI_FIELD: {
    FIELD_HEXCOLOUR: 0, // Three digit hex colour
    FIELD_CHECKBOX:  1, // Checkbox
    FIELD_NUMBER:    2, // Decimal number
    FIELD_COMBO:     3, // Combo box
  },
};


if (typeof exports === 'object') {
  module.exports = CONST;
}
