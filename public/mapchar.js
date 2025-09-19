class MAPCHAR {  

  constructor() {
    this.region = 0 // West Europe
    this.country = 0 // UK
  }
  
  setRegion(region) {
    if (region > 28 || region < 0) {region = 0}
    this.region = region
  }
  
  setCountry(country) {
    if (country > 7 || country < 0) {country = 0}
    this.country = country
  }
  
  map(ch) {
    switch (this.region) {
      case 0 : // West Europe
        switch (this.country) {
          case 0: return this.MapEnglish(ch)
          case 1: return this.MapFrench(ch)
        default:
          print("[MAPCHAR] ERROR: Undefined country")
        }
        break
      default:
        print("[MAPCHAR] ERROR: Undefined region")
    }
    return ch
  } //map
  
  MapEnglish(ch) {
    switch (ch) {
      case '#':
        return '£'
      case '[':
        return char(0x2190) // 5/B Left arrow.
      case '\\':
        return char(0xbd) // 5/C Half
      case ']':
        return char(0x2192) // 5/D Right arrow.
      case '^':
        return char(0x2191) // 5/E Up arrow.
      case '_':
        return char(0x0023) // 5/F Underscore is hash sign
      case '`' :
        return String.fromCharCode(0x2014) // 6/0 Centre dash. The full width dash e731
      case '{':
        return char(0xbc) // 7/B Quarter
      case '|':
        return char(0x2016) // 7/C Double pipe
      case '}':
        return char(0xbe) // 7/D Three quarters
      case '~':
        return char(0x00f7) // 7/E Divide
      case String.fromCharCode(0x7f):
        return char(0xe65f) // 7/F Bullet (rectangle block)
      default:
        return ch
    }
  }
  
  MapFrench(ch) {
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
      case '_' :  return char('#')    // 5/F #
      case '`' :  return char(0x00e8) // 6/0 e grave
      case '{' :  return char(0x00e2) // 7/B a circumflex
      case '|' :  return char(0x00f4) // 7/C o circumflex
      case '}' :  return char(0x00fb) // 7/D u circumflex
      case '~' :  return char(0x00e7) // 7/E c cedilla
      default:
        return ch
    }
  }
  
} // MAPCHAR