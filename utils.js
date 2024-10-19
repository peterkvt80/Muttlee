/** < Miscellaneous utilities for teletext
 * \author Peter Kwan 2018.
 */
'use strict'
/** < De-escape Prestel style 7 bit encoding.
 * A Prestel encoded string is escaped so that
 * it only needs 7 bit characters.
 * It does this by taking control code characters
 * and writing them as <esc> followed by the code
 * plus 0x40.
 * \param str - Prestel encoded string
 */
global.DeEscapePrestel = function (str) {
  let result = ''

  for (let i = 0; i < str.length; i++) {
    let ch = str.charAt(i)

    // Prestel escape
    if (ch === '\u001b') {
      ch = str.charAt(++i).charCodeAt(0) - 0x40
      ch = String.fromCharCode(ch & 0x7f)
    }

    result += ch
  }

  return result
}

/** < Escape Prestel style 7 bit encoding.
 * A Prestel encoded string is escaped so that
 * Control code characters (<' ')
 * are written as <esc> followed by the code plus 0x40.
 * \param str - Raw teletext string
 */
global.EscapePrestel = function (str) {
  let result = ''

  for (let x = 0; x < str.length; x++) {
    const ch = str.charAt(x)

    if (ch.charCodeAt(0) < 32) {
      result = result + '\u001b' + String.fromCharCode((ch.charCodeAt(0) & 0x7f) | 0x40)
    } else {
      result += ch
    }
  }

  return result
}
