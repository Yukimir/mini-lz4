exports.hashU32 = function hashU32 (a) {
    a = a | 0;
    a = a + 2127912214 + (a << 12) | 0;
    a = a ^ -949894596 ^ a >>> 19;
    a = a + 374761393 + (a << 5) | 0;
    a = a + -744332180 ^ a << 9;
    a = a + -42973499 + (a << 3) | 0;
    return a ^ -1252372727 ^ a >>> 16 | 0;
  };
  exports.readU64 = function readU64 (b, n) {
    let x = 0;
    x |= b[n++] << 0;
    x |= b[n++] << 8;
    x |= b[n++] << 16;
    x |= b[n++] << 24;
    x |= b[n++] << 32;
    x |= b[n++] << 40;
    x |= b[n++] << 48;
    x |= b[n++] << 56;
    return x;
  };
  exports.readU32 = function readU32 (b, n) {
    let x = 0;
    x |= b[n++] << 0;
    x |= b[n++] << 8;
    x |= b[n++] << 16;
    x |= b[n++] << 24;
    return x;
  };
  exports.writeU32 = function writeU32 (b, n, x) {
    b[n++] = (x >> 0) & 0xff;
    b[n++] = (x >> 8) & 0xff;
    b[n++] = (x >> 16) & 0xff;
    b[n++] = (x >> 24) & 0xff;
  };
  exports.imul = function imul (a, b) {
    let ah = a >>> 16;
    let al = a & 65535;
    let bh = b >>> 16;
    let bl = b & 65535;
  
    return al * bl + (ah * bl + al * bh << 16) | 0;
  };