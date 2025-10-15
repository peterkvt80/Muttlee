'use strict'
// Mappings in 15.6 Alphanumeric Character Sets of ETSI EN 300 706
// These mappings are for the teletext2 font

class MAPCHAR {  

  constructor(region, language) {
    this.setRegion(region)
    this.setLanguage(language)
  }
  
  setRegion(region) {
    if (typeof region ==='undefined') {
      LOG.fn(
        ['MAPCHAR', 'setRegion'],
        `Bad region value`,
        LOG.LOG_LEVEL_ERROR
      )
      region = 0
    }
    if (region > 28 || region < 0) {
      region = 0
    }
    this.region = region
  }
  
  setLanguage(language) {
    if (language > 7 || language < 0) {
      language = 0
    }
    this.language = language
  }
  
  static copyMapping(src, dest) {
    dest.language = src.language
    dest.region = src.region
  }
  
  map(ch) {
    ch = char(ch.charCodeAt(0) & 0x7f)
    if (ch.charCodeAt(0) === 0x7f) { // 7/F Bullet (rectangle block)
      return char(0xe65f)
    }

    switch (this.region) {
      case 0 : // West Europe
        switch (this.language) {
          case 0: return this.MapEnglish(ch)
          case 1: return this.MapFrench(ch)
          case 2: return this.MapSwedish(ch)
          case 3: return this.MapCzechSlovak(ch)
          case 4: return this.MapGerman(ch)
          case 5: return this.MapSpanishPortuguese(ch)
          case 6: return this.MapItalian(ch)
        }
        break
      case 1: // West Europe plus Polish
        switch (this.language) {
          case 0: return this.MapPolish(ch)
          case 1: return this.MapFrench(ch)
          case 2: return this.MapSwedish(ch)
          case 3: return this.MapCzechSlovak(ch)
          case 4: return this.MapGerman(ch)
          case 6: return this.MapItalian(ch)
        }
        break
      case 2: // West Europe plus Turkish
        switch (this.language) {
          case 0: return this.MapEnglish(ch)
          case 1: return this.MapFrench(ch)
          case 2: return this.MapSwedish(ch)
          case 3: return this.MapTurkish(ch)
          case 4: return this.MapGerman(ch)
          case 5: return this.MapSpanish(ch)
          case 6: return this.MapItalian(ch)
        }
        break
      case 3: // Serbian/Croatian/Slovenian/Rumanian
        switch (this.language) {
          case 5: return this.MapSerbian(ch)
          case 7: return this.MapRumanian(ch)
        }
        break
      case 4: // Russian/Bulgarian
        switch (this.language) {
          case 0: return this.MapSerbian(ch)
          case 1: return this.MapRussianBulgarian(ch)
          case 2: return this.MapEstonian(ch)
          case 3: return this.MapCzechSlovak(ch)
          case 4: return this.MapGerman(ch)
          case 5: return this.MapUkrainian(ch)
          case 6: return this.MapLettishLithuanian(ch)
        }
        break
      case 6: // Turkish/Greek
        switch (this.language) {
          case 3: return this.MapTurkish(ch)
          case 7: return this.MapGreek(ch)
        }
        break
      case 8: // Arabic
        switch (this.language) {
          case 0: return this.MapEnglish(ch)
          case 1: return this.MapFrench(ch)
          case 7: return this.MapArabic(ch)
        }
        break
      case 10: // Hebrew
        switch (this.language) {
          case 5: return this.MapHebrew(ch)
          case 7: return this.MapArabic(ch)
        }
        break
        
      default:
        print(`[MAPCHAR] ERROR: Undefined region = ${this.region}`)
    }
    return ch
  } //map
  
  MapEnglish(ch) { // 0:0
    switch (ch) {
      case '#':  return '£'
      case '[':  return char(0x2190) // 5/B Left arrow.
      case '\\': return char(0xbd) // 5/C Half
      case ']':  return char(0x2192) // 5/D Right arrow.
      case '^':  return char(0x2191) // 5/E Up arrow.
      case '_':  return char(0x0023) // 5/F Underscore is hash sign
      case '`' : return String.fromCharCode(0x2014) // 6/0 Centre dash. The full width dash e731
      case '{':  return char(0xbc) // 7/B Quarter
      case '|':  return char(0x2016) // 7/C Double pipe
      case '}':  return char(0xbe) // 7/D Three quarters
      case '~':  return char(0x00f7) // 7/E Divide
      case String.fromCharCode(0x7f): return char(0xe65f) // 7/F Bullet (rectangle block)
      default:
        return ch
    }
  } // MapEnglish
  
  MapFrench(ch) { // 0:1
    switch (ch) {
      // Nat. opt. 1
      case '#' :  return char(0x00e9) // 2/3 e acute
      case '$' :  return char(0x00ef) // 2/4 i umlaut
      case '@' :  return char(0x00e0) // 4/0 a grave
      case '[' :  return char(0x00eb) // 5/B e umlaut
      case '\\' : return char(0x00ea) // 5/C e circumflex
      // Nat. opt. 2
      case ']' :  return char(0x00f9) // 5/D u grave
      case '^' :  return char(0x00ee) // 5/E i circumflex
      case '_' :  return char(0x0023) // 5/F #
      case '`' :  return char(0x00e8) // 6/0 e grave
      case '{' :  return char(0x00e2) // 7/B a circumflex
      case '|' :  return char(0x00f4) // 7/C o circumflex
      case '}' :  return char(0x00fb) // 7/D u circumflex
      case '~' :  return char(0x00e7) // 7/E c cedilla
      default:
        return ch
    }
  } // MapFrench
  
  MapSwedish(ch) { // 0:2
    switch (ch) {
      // Nat. opt. 1
      case '£' :  return char('#') // 2/3 hash
      case '$' :  return char(0x00a4) // 2/4 currency bug
      case '@' :  return char(0x00c9) // 4/0 E acute
      case '[' :  return char(0x00c4) // 5/B A umlaut
      case '\\':  return char(0x00d6) // 5/C O umlaut
      // Nat. opt. 2
      case ']' :  return char(0x00c5) // 5/D A ring
      case '^' :  return char(0x00dc) // 5/E U umlaut
      case '_' :  return char(0x005f) // 5/F Underscore (not mapped)
      case '`' :  return char(0x00e9) // 6/0 e acute
      case '{' :  return char(0x00e4) // 7/B a umlaut
      case '|' :  return char(0x00f6) // 7/C o umlaut
      case '}' :  return char(0x00e5) // 7/D a ring
      case '~' :  return char(0x00fc) // 7/E u umlaut
      default:
        return ch
    }
  } // MapSwedish


  MapCzechSlovak(ch) { // 0:3
    switch (ch) {
      // Nat. opt. 1
      case '£' :  return char('#')    // # // 2/3 hash
      case '$' :  return char(0x016f) // 2/4 u ring
      case '@' :  return char(0x010d) // 4/0 c caron
      case '[' :  return char(0x0165) // 5/B t caron
      case '\\':  return char(0x017e) // 5/C z caron
      // Nat. opt. 2
      case ']' :  return char(0x00fd) // 5/D y acute
      case '^' :  return char(0x00ed) // 5/E i acute
      case '_' :  return char(0x0159) // ř // 5/F r caron
      case '`' :  return char(0x00e9) // 6/0 e acute
      case '{' :  return char(0x00e1) // 7/B a acute
      case '|' :  return char(0x011b) // 7/C e caron
      case '}' :  return char(0x00fa) // 7/D u acute
      case '~' :  return char(0x0161) // 7/E s caron
      default:
        return ch
    }
  } // MapCzechSlovak
        
        
  MapGerman(ch) { // 0:4
    switch (ch) {
      // Nat. opt. 1
      case '£' :  return char('#')    // 2/3 Hash
      case '$' :  return char(0x0024) // 2/4 Dollar sign not mapped
      case '@' :  return char(0x00a7) // 4/0 Section sign
      case '[' :  return char(0x00c4) // 5/B A umlaut
      case '\\':  return char(0x00d6) // 5/C O umlaut
      // Nat. opt. 2
      case ']' :  return char(0x00dc) // 5/D U umlaut
      case '^' :  return char(0x005e) // 5/E Caret
      case '_' :  return char(0x005f) // 5/F Underscore (not mapped)
      case '`' :  return char(0x00b0) // 6/0 Masculine ordinal indicator
      case '{' :  return char(0x00e4) // 7/B a umlaut
      case '|' :  return char(0x00f6) // 7/C o umlaut
      case '}' :  return char(0x00fc) // 7/D u umlaut
      case '~' :  return char(0x00df) // 7/E SS
      default:
        return ch
    }
  } // MapGerman
      
  MapSpanishPortuguese(ch) { // 0:5
    switch (ch) {
      // Nat. opt. 1
      case '#' :  return char(0x00e7) // 2/3 c cedilla
      case '£' :  return char('$')    // 2/4 Dollar
      case '@' :  return char(0x00a1) // 4/0 inverted exclamation mark
      case '[' :  return char(0x00e1) // 5/B a acute
      case '\\':  return char(0x00e9) // 5/C e acute
      // Nat. opt. 2
      case ']' :  return char(0x00ed) // 5/D i acute
      case '^' :  return char(0x00f3) // 5/E o acute
      case '_' :  return char(0x00fa) // 5/F u acute
      case '`' :  return char(0x00bf) // 6/0 Inverted question mark
      case '{' :  return char(0x00fc) // 7/B u umlaut
      case '|' :  return char(0x00f1) // 7/C n tilde
      case '}' :  return char(0x00e8) // 7/D e grave
      case '~' :  return char(0x00e0) // 7/E a grave
      default:
        return ch
    }
  } // MapSpanishPortuguese

  MapItalian(ch) { // 0:6
    switch (ch) {
      // Nat. opt. 1
      case '#' :  return char(0x00a3) // 2/3 Pound
      case '£' :  return char('$')    // 2/4 Dollar
      case '@' :  return char(0x00e9) // 4/0 e acute
      case '[' :  return char(0x00b0) // 5/B ring
      case '\\':  return char(0x00e7) // 5/C c cedilla
      // Nat. opt. 2
      case ']' :  return char(0x2192) // 5/D right arrow
      case '^' :  return char(0x2191) // 5/E up arrow
      case '_' :  return char(0x0023) // 5/F #
      case '`' :  return char(0x00f9) // 6/0 u grave
      case '{' :  return char(0x00e0) // 7/B a grave
      case '|' :  return char(0x00f2) // 7/C o grave
      case '}' :  return char(0x00e8) // 7/D e grave
      case '~' :  return char(0x00ec) // 7/E i grave
      default:
        return ch
    }
  } // MapItalian

  MapPolish(ch) { // 1:0
    switch (ch) {
      case '#' :  return char(0x0023) // 2/3 # is not mapped
      case '$' :  return char(0x0144) // 2/4
      case '@' :  return char(0x0105) // 4/0
      case '[' :  return char(0x01b5) // 5/B
      case '\\':  return char(0x015a) // 5/C
      case ']' :  return char(0x0141) // 5/D
      case '^' :  return char(0x0107) // 5/E
      case '_' :  return char(0x00f3) // 5/F
      case '`' :  return char(0x0119) // 6/0
      case '{' :  return char(0x017c) // 7/B
      case '|' :  return char(0x015b) // 7/C
      case '}' :  return char(0x0142) // 7/D
      case '~' :  return char(0x017a) // 7/E
      default:
        return ch
    }
  } // MapPolish

  MapTurkish(ch) { // 2:3
    switch (ch) {
      case '#' :  return char(0x0167) // 2/3
      case '$' :  return char(0x011f) // 2/4
      case '@' :  return char(0x0130) // 4/0
      case '[' :  return char(0x015e) // 5/B
      case '\\':  return char(0x00d6) // 5/C
      case ']' :  return char(0x00c7) // 5/D
      case '^' :  return char(0x00dc) // 5/E
      case '_' :  return char(0x011e) // 5/F
      case '`' :  return char(0x0131) // 6/0
      case '{' :  return char(0x015f) // 7/B
      case '|' :  return char(0x00f6) // 7/C
      case '}' :  return char(0x00e7) // 7/D
      case '~' :  return char(0x00fc) // 7/E
    default:
      return ch
    }
  } // MapTurkish


  MapSerbian(ch) { // 3:5
    switch (ch) {
      case '#' :  return char(0x0023) // 2/3
      case '$' :  return char(0x00cb) // 2/4
      case '@' :  return char(0x010c) // 4/0
      case '[' :  return char(0x0106) // 5/B
      case '\\':  return char(0x017d) // 5/C
      case ']' :  return char(0x0110) // 5/D
      case '^' :  return char(0x0160) // 5/E
      case '_' :  return char(0x00eb) // 5/F
      case '`' :  return char(0x010d) // 6/0
      case '{' :  return char(0x0107) // 7/B
      case '|' :  return char(0x017e) // 7/C
      case '}' :  return char(0x0111) // 7/D
      case '~' :  return char(0x0161) // 7/E
      default:
        return ch
    }
  } // MapSerbian

  MapRumanian(ch) { // 3:7
    switch (ch) {
      case '#' :  return char(0x0023) // 2/3
      case '$' :  return char(0x00a4) // 2/4
      case '@' :  return char(0x0162) // 4/0
      case '[' :  return char(0x00c2) // 5/B
      case '\\':  return char(0x015e) // 5/C
      case ']' :  return char(0x0102) // 5/D
      case '^' :  return char(0x00ce) // 5/E
      case '_' :  return char(0x0131) // 5/F
      case '`' :  return char(0x0163) // 6/0
      case '{' :  return char(0x00e2) // 7/B
      case '|' :  return char(0x015f) // 7/C
      case '}' :  return char(0x0103) // 7/D
      case '~' :  return char(0x00ee) // 7/E
      default:
        return ch
    }
  } // MapRumanian


  MapRussianBulgarian(ch) { // 4:0
    switch (ch) {
      // Coloumn 20-2f
      case '&' :  return char(0x044B) // ы
      // Nat. opt. 2. Column 40-4f
      case '@' :  return char(0x042e)    // Cyrillic Capital Letter Yu
      case 'A' :  return char(0x0410) // Cyrillic A
      case 'B' :  return char(0x0411)
      case 'C' :  return char(0x0426) // Cyrillic
      case 'D' :  return char(0x0414) //
      case 'E' :  return char(0x0415)
      case 'F' :  return char(0x0424)
      case 'G' :  return char(0x0413) //
      case 'H' :  return char(0x0425) //
      case 'I' :  return char(0x0418) // И
      case 'J' :  return char(0x0419) // Й
      case 'K' :  return char(0x041A) // К
      case 'L' :  return char(0x041B) // Л
      case 'M' :  return char(0x041C) // М
      case 'N' :  return char(0x041D) // Н
      case 'O' :  return char(0x041E) // О
      // Cyrillic G0 Column 50-5f
      case 'P' :  return char(0x041f) // П
      case 'Q' :  return char(0x042f)
      case 'R' :  return char(0x0420)
      case 'S' :  return char(0x0421)
      case 'T' :  return char(0x0422)
      case 'U' :  return char(0x0423)
      case 'V' :  return char(0x0416)
      case 'W' :  return char(0x0412)
      case 'X' :  return char(0x042c)
      case 'Y' :  return char(0x042a)
      case 'Z' :  return char(0x0417)
      case '[' :  return char(0x0428) // Nap opt 2 starts here
      case '\\':  return char(0x042d)
      case ']' :  return char(0x0429)
      case '^' :  return char(0x0427)
      case '_' :  return char(0x042b)
      // Cyrillic G0 Column 60-6f
      case '`' :  return char(0x044e) // Nat opt 2 stops here
      case 'a' :  return char(0x0430) // а
      case 'b' :  return char(0x0431) // б
      case 'c' :  return char(0x0446)
      case 'd' :  return char(0x0434)
      case 'e' :  return char(0x0435)
      case 'f' :  return char(0x0444)
      case 'g' :  return char(0x0433)
      case 'h' :  return char(0x0445)
      case 'i' :  return char(0x0438)
      case 'j' :  return char(0x0439)
      case 'k' :  return char(0x043a) // к
      case 'l' :  return char(0x043b) // л
      case 'm' :  return char(0x043c) // м
      case 'n' :  return char(0x043d) // н
      case 'o' :  return char(0x043e) // о
      // Remaining are OK
      // Cyrillic G0 Column 70-7f
      // 70 is OK
      case 'p' :  return char(0x043f) // п
      case 'q' :  return char(0x044f) // 
      case 'r' :  return char(0x0440) // р
      case 's' :  return char(0x0441)
      case 't' :  return char(0x0442)
      case 'u' :  return char(0x0443)
      case 'v' :  return char(0x0436)
      case 'w' :  return char(0x0432)
      case 'x' :  return char(0x044c)
      case 'y' :  return char(0x044a)
      case 'z' :  return char(0x0437)
      case '{' :  return char(0x0448)
      case '|' :  return char(0x044d)
      case '}' :  return char(0x0449)
      case '~' :  return char(0x0447)
      default:
        // Other mappings that just happen to be in the right place
        if ((ch >= '@') && (ch <= '~')) {
          ch=ch+(0x040f)-'@'  // [!] probably need to do some char<-->ascii conversions
        }
        return ch
    }
  } // MapRussianBulgarian

  MapEstonian(ch) { // 4:2 Latin G0 Set - Option 2 Estonian
    switch (ch) {
      case '$' :  return char(0x00f5) // õ
      case '@' :  return char(0x0160) // Š
      case '[' :  return char(0x00c4) // Ä
      case '\\' : return char(0x00d6) // Ö
      case ']' :  return char(0x017d) // Ž
      case '^' :  return char(0x00dc) // Ü
      case '_' :  return char(0x00d5) // Õ
      case '{' :  return char(0x00e4) // ä
      case '|' :  return char(0x00f6) // ö
      case '}' :  return char(0x017e) // ž
      case '~' :  return char(0x00fc) // ü
      default:
        return ch
    }
  } // MapEstonian

  MapUkrainian(ch) { // 4:5
    switch (ch) {
      // Nat. opt. 2. Column 40-4f
      case '@' :  return char(0x042e)    // Ю Cyrillic Capital Letter Yu
      case 'A' :  return char(0x0410) // А
      case 'B' :  return char(0x0411) // Б
      case 'C' :  return char(0x0426) // Cyrillic
      case 'D' :  return char(0x0414) //
      case 'E' :  return char(0x0415)
      case 'F' :  return char(0x0424)
      case 'G' :  return char(0x0413) //
      case 'H' :  return char(0x0425) //
      case 'I' :  return char(0x0418) // И
      case 'J' :  return char(0x0419) // Й
      case 'K' :  return char(0x041a) // К
      case 'L' :  return char(0x041b) // Л
      case 'M' :  return char(0x041c) // М
      case 'N' :  return char(0x041d) // Н
      case 'O' :  return char(0x041e) // О
      
      // Cyrillic G0 Column 50-5f
      case 'P' :  return char(0x041f) // П
      case 'Q' :  return char(0x042f) // 5/1
      case 'R' :  return char(0x0420) // 5/2
      case 'S' :  return char(0x0421)
      case 'T' :  return char(0x0422)
      case 'U' :  return char(0x0423)
      case 'V' :  return char(0x0416)
      case 'W' :  return char(0x0412)
      case 'X' :  return char(0x042c)
      case 'Y' :  return char(0x0406) // 5/8 042a russian
      case 'Z' :  return char(0x0417) // 5/9
      case '[' :  return char(0x0428) // Nap opt 2 starts here
      case '\\':  return char(0x0404) // 5/c Russian 042d
      case ']' :  return char(0x0429) // 5/d
      case '^' :  return char(0x0427) // 5/e
      case '_' :  return char(0x0407) // 5/f russian 042b
      // Cyrillic G0 Column 60-6f
      case '`' :  return char(0x044e) // 6/0
      case 'a' :  return char(0x0430) // а 6/1
      case 'b' :  return char(0x0431) // б
      case 'c' :  return char(0x0446)
      case 'd' :  return char(0x0434)
      case 'e' :  return char(0x0435)
      case 'f' :  return char(0x0444)
      case 'g' :  return char(0x0433)
      case 'h' :  return char(0x0445)
      case 'i' :  return char(0x0438)
      case 'j' :  return char(0x0439)

      case 'k' :  return char(0x043a) // к
      case 'l' :  return char(0x043b) // л
      case 'm' :  return char(0x043c) // м
      case 'n' :  return char(0x043d) // н
      case 'o' :  return char(0x043e) // о
      // Cyrillic G0 Column 70-7f
      case 'p' :  return char(0x043f) // п 7/0
      case 'q' :  return char(0x044f) // 7/1
      case 'r' :  return char(0x0440) // 7/2
      case 's' :  return char(0x0441) // 7/3
      case 't' :  return char(0x0442) // 7/4
      case 'u' :  return char(0x0443) // 7/5
      case 'v' :  return char(0x0436) // 7/6
      case 'w' :  return char(0x0432) // 7/7
      case 'x' :  return char(0x044c) // 7/8
      case 'y' :  return char(0x0456) // 7/9 russian 044a
      case 'z' :  return char(0x0437) // 7/a
      case '{' :  return char(0x0448) // 7/b
      case '|' :  return char(0x0454) // 7/c russian 044d
      case '}' :  return char(0x0449) // 7/d
      case '~' :  return char(0x0447) // 7/e russian 0447
      default:
        return ch
      }
    } // MapUkrainian      
      
  MapLettishLithuanian(ch) { // 4:6
    switch (ch) {
      case '#' :  return char(0x0023) // 2/3
      case '$' :  return char(0x0024) // 2/4
      case '@' :  return char(0x0160) // 4/0
      case '[' :  return char(0x0117) // 5/B
      case '\\':  return char(0x0229) // 5/C
      case ']' :  return char(0x017d) // 5/D
      case '^' :  return char(0x010d) // 5/E
      case '_' :  return char(0x016b) // 5/F
      case '`' :  return char(0x0161) // 6/0
      case '{' :  return char(0x0105) // 7/B
      case '|' :  return char(0x0173) // 7/C
      case '}' :  return char(0x017e) // 7/D
      case '~' :  return char(0x012f) // 7/E This is the best match in teletext2
      default:
        return ch
    }
  } // MapLettish

  MapGreek(ch) { // 6:7
    if ((ch>='@') && (ch<='~')) {
      let p1 = ch.charCodeAt(0)
      let p2 = 0x390
      let p3 = '@'.charCodeAt(0)
      let p4 = p1 + p2 - p3
      let ch2 = char(p4)
      return ch2
    }
    switch (ch) {
      case 'R' :  return char(0x0374) // Top right dot thingy
      case '<' :  return char(0x00ab) // left chevron
      case '>' :  return char(0x00bb) // right chevron
      // Nat. opt. 1

      // case '@' :  return char(0x00e9) // 4/0 e acute
      case '[' :  return char(0x00b0) // 5/B ring
      case '\\':  return char(0x00e7) // 5/C c cedilla
      // Nat. opt. 2
      case ']' :  return char(0x2192) // 5/D right arrow
      case '^' :  return char(0x2191) // 5/E up arrow
      case '_' :  return char('#')    // 5/F hash
      case '`' :  return char(0x00f9) // 6/0 u grave
      case '{' :  return char(0x00e0) // 7/B a grave
      case '|' :  return char(0x00f2) // 7/C o grave
      case '}' :  return char(0x00e8) // 7/D e grave
      // case '~' :  return char(0x03af) // 7/E ί i grave
      default:
        return ch
    }
  } // MapGreek

  MapArabic(ch) { // 8:7
    switch (ch) {
      case ' ': // 2/0
      case '!': // 2/1
      case '"': // 2/2
      case '$': // 2/4
      case '%': // 2/5
      case ')': // 2/8
      case '(': // 2/9
      case '*': // 2/A
      case '+': // 2/B
      case '-': // 2/D
      case '.': // 2/E
      case '/': // 2/F
      case '0': // 3/0
      case '1': // 3/1
      case '2': // 3/2
      case '3': // 3/3
      case '4': // 3/4
      case '5': // 3/5
      case '6': // 3/6
      case '7': // 3/7
      case '8': // 3/8
      case '9': // 3/9
      case ':': // 3/a
      //case '0':) // 3/b
        return ch
      case '#': return '£' // 2/3
      case '>': 
        return '<' // 3/c
      case '=': // 3/d
        return ch
      case '<':
        return '>' // 3/e
      // case '?':) // 3/f
      default :
        return char(ch.charCodeAt(0)+0xe606-'&'.charCodeAt(0)) // 2/6 onwards
    }
  } // MapArabic

  MapHebrew(ch) { // 10:5
    if ((ch>char(0x5f)) && (ch<char(0x7b))) { // Hebrew characters
      return char(ch.charCodeAt(0)+0x05d0-0x60) //
    }
    switch (ch) { // Mostly the same as English nat. opts.
      case '#':  return char(0x00A3)  // 2/3 # is mapped to pound sign
      case '[':  return char(0x2190)  // 5/B Left arrow.
      case '\\': return char(0xbd)    // 5/C Half
      case ']':  return char(0x2192)  // 5/D Right arrow.
      case '^':  return char(0x2191)  // 5/E Up arrow.
      case '_':  return char(0x0023)  // 5/F Underscore is hash sign
      case '{':  return char(0x20aa)  // 7/B sheqel
      case '|':  return char(0x2016)  // 7/C Double pipe
      case '}':  return char(0xbe)    // 7/D Three quarters
      case '~':  return char(0x00f7)  // 7/E Divide
      default:
        return ch
    }
  }
  
  /**
   * @param region - An X28 region number
   * @eturn Array of language names 
   */
  static getLanguageStrings(region) {
    switch (region) {
      case 0: // West Europe
        return ['English', 'French', 'Swedish', 'Czech/Slovak', 'German', 'Spanish/Portuguese', 'Italian', undefined]
      case 1: // West Europe plus Polish
        return ['Polish', 'French', 'Swedish', 'Czech/Slovak', 'German', undefined, 'Italian', undefined]
      case 2: // West Europe plus Turkish
        return ['English', 'French', 'Swedish', 'Turkish', 'German', 'Spanish/Portuguese', 'Italian', undefined]
      case 3: // Serbian/Croatian/Slovenian/Rumanian
        return [undefined, undefined, undefined, undefined, undefined, 'Serbian', undefined, 'Rumanian']
      case 4: // Russian/Bulgarian
        return ['Serbian', 'Russian/Bulgarian', 'Estonian', 'Czech/Slovak', 'German', 'Ukranian', 'Lettish/Lithuanian', undefined]
      case 6: // Turkish/Greek
        return [undefined, undefined, undefined, 'Turkish', undefined, undefined, undefined, 'Greek']
      case 8: // Arabic
        return ['English', 'French', undefined, undefined, undefined, undefined, undefined, 'Arabic']
      case 10: // Hebrew
        return [undefined, undefined, undefined, undefined, undefined, 'Hebrew', undefined, 'Arabic']
      }
  } // getLanguageStrings
  
  /**
   * @eturn A phrase in the currently selected language
   */
  getLanguagePhrase() {
    const phrases = [
    'My hovercraft is full of eels',                      // 0 English - My hovercraft is full of eels
    "Mon a£roglisseur est plein d'anguilles",             // 1 French - Mon aéroglisseur est plein d'anguilles
    'Min sv{vare {r full med }l',                         // 2 Swedish - Min svävare är full med ål
    'Moje vzn{~edlo je pln{ }ho_$',                       // 3 Czech - Moje vznášedlo je plné úhořů
    'Mein Luftkissenfahrzeug ist voller Aale',            // 4 German - Mein Luftkissenfahrzeug ist voller Aale
    'Mi aerodeslizador está lleno de anguilas',           // 5 Spanish - Mi aerodeslizador está lleno de anguilas
    'Il mio hovercraft è pieno di anguille',              // 6 Italian - 	Il mio hovercraft è pieno di anguille
    'Mój poduszkowiec jest pełen węgorzy',                // 7 Polish - Mój poduszkowiec jest pełen węgorzy
    'Hoverkraftım yılan balığı dolu',                     // 8 Turkish - Hoverkraftım yılan balığı dolu
    'Мој ховеркрафт је пун јегуља',                       // 9 Serbian
    'Aeroglisorul meu e plin de țipari',                  // 10 Rumanian - Aeroglisorul meu e plin de țipari    
    'Моё судно на воздушной подушке полно угрей',         // 11 Russian - Моё судно на воздушной подушке полно угрей
    'Mu hõljuk on angerjaid täis',                        // 12 Estonian - Mu hõljuk on angerjaid täis
    '	Моє судно на повітряній подушці наповнене вуграми', // 13	Ukranian - Моє судно на повітряній подушці наповнене вуграми
    'Mano laivas su oro pagalve pilnas ungurių',          // 14 Lithuanian - Mano laivas su oro pagalve pilnas ungurių
    'Το αερόστρωμνό μου είναι γεμάτο χέλια',              // 15 Greek - 	Το αερόστρωμνό μου είναι γεμάτο χέλια
    'حَوّامتي مُمْتِلئة بِأَنْقَلَيْسون',                            // 16 Arabic - حَوّامتي مُمْتِلئة بِأَنْقَلَيْسون
    'הרחפת שלי מלאה בצלופחים',                             // 17 Hebrew - הרחפת שלי מלאה בצלופחים
    'undefined language'                                  // 18 Undefined
    ]
    let n = 0
    switch (this.region) {
      case 0: // West Europe
        n = [0, 1, 2, 3, 4, 5, 6][this.language] // ['English', 'French', 'Swedish', 'Czech/Slovak', 'German', 'Spanish/Portuguese', 'Italian', undefined]
        break
      case 1: // West Europe plus Polish
        n = [7, 1, 2, 3, 4, 18, 6, 18][this.language] // ['Polish', 'French', 'Swedish', 'Czech/Slovak', 'German', undefined, 'Italian', undefined]
        break
      case 2: // West Europe plus Turkish
        n = [0, 1, 2, 8, 4, 5, 6, 18][this.language] // ['English', 'French', 'Swedish', 'Turkish', 'German', 'Spanish/Portuguese', 'Italian', undefined]
        break
      case 3: // Serbian/Croatian/Slovenian/Rumanian
        n = [18, 18, 18, 18, 18, 9, 18, 10][this.language] // [undefined, undefined, undefined, undefined, undefined, 'Serbian', undefined, 'Rumanian']
        break
      case 4: // Russian/Bulgarian
        n = [9, 11, 12, 3, 4, 13, 14, 18][this.language] // ['Serbian', 'Russian/Bulgarian', 'Estonian', 'Czech/Slovak', 'German', 'Ukranian', 'Lettish/Lithuanian', undefined]
        break
      case 6: // Turkish/Greek
        n = [18, 18, 18, 8, 18, 18, 18, 15][this.language] // [undefined, undefined, undefined, 'Turkish', undefined, undefined, undefined, 'Greek']
        break
      case 8: // Arabic
        n = [0, 1, 18, 18, 18, 18, 18, 16][this.language] // ['English', 'French', undefined, undefined, undefined, undefined, undefined, 'Arabic']
        break
      case 10: // Hebrew
        n = [18, 18, 18, 18, 18, 17, 18, 16][this.language] // [undefined, undefined, undefined, undefined, undefined, 'Hebrew', undefined, 'Arabic']
        break
      default:
        n = 0
    }
    return phrases[n]
      
  } // getLanguagePhrase
  
} // MAPCHAR

