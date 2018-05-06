/**< Miscellaneous utilities for teletext 
 * \author Peter Kwan 2018.
 */

/**< De-escape Prestel style 7 bit encoding.
 * A Prestel encoded string is escaped so that
 * it only needs 7 bit characters.
 * It does this by taking control code characters
 * and writing them as <esc> followed by the code
 * plus 0x40.
 * \param str - Prestel encoded string
 */
DeEscapePrestel=function (str)
{
  var result=''
  for (var i=0;i<str.length;i++)
  {
    var ch=str.charAt(i)
    if (ch=='\u001b') // Prestel escape
    {
      ch=str.charAt(++i).charCodeAt()-0x40;// - 0x40
      ch=String.fromCharCode(ch & 0x7f)
    }
    result+=ch
  }
  return result;
} // DeEscapePrestel

