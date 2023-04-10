let xxhash = require('./xxh32.js');
let util = require('./util.js');
const makeHashTable = () => {
  try {
    return new Uint32Array(hashSize);
  } catch (error) {
    let hashTable = new Array(hashSize);
    for (let i = 0; i < hashSize; i++) {
      hashTable[i] = 0;
    }
    return hashTable;
  }
}
const clearHashTable = (table) => {
  for (let i = 0; i < hashSize; i++) {
    hashTable[i] = 0;
  }
}
const makeBuffer = (size) => {
  try {
    return new Uint8Array(size);
  } catch (error) {
    let buf = new Array(size);
    for (let i = 0; i < size; i++) {
      buf[i] = 0;
    }
    return buf;
  }
}
const sliceArray = (array, start, end) => {
  if (typeof array.buffer !== undefined) {
    if (Uint8Array.prototype.slice) {
      return array.slice(start, end);
    } else {
      let len = array.length;
      start = start | 0;
      start = (start < 0) ? Math.max(len + start, 0) : Math.min(start, len);
      end = (end === undefined) ? len : end | 0;
      end = (end < 0) ? Math.max(len + end, 0) : Math.min(end, len);
      let arraySlice = new Uint8Array(end - start);
      for (let i = start, n = 0; i < end;) {
        arraySlice[n++] = array[i++];
      }
      return arraySlice;
    }
  } else {
    return array.slice(start, end);
  }
}
let minMatch = 4;
let minLength = 13;
let searchLimit = 5;
let skipTrigger = 6;
let hashSize = 1 << 16;
let mlBits = 4;
let mlMask = (1 << mlBits) - 1;
let runBits = 4;
let runMask = (1 << runBits) - 1;
let blockBuf = makeBuffer(5 << 20);
let hashTable = makeHashTable();
let magicNum = 0x184D2204;
let fdContentChksum = 0x4;
let fdContentSize = 0x8;
let fdBlockChksum = 0x10;
let fdVersion = 0x40;
let fdVersionMask = 0xC0;
let bsUncompressed = 0x80000000;
let bsDefault = 7;
let bsShift = 4;
let bsMask = 7;
let bsMap = {
  4: 0x10000,
  5: 0x40000,
  6: 0x100000,
  7: 0x400000
};
exports.compressBound = (n) => {
  return (n + (n / 255) + 16) | 0;
}
exports.decompressBound = (src) => {
  let sIndex = 0;
  if (util.readU32(src, sIndex) !== magicNum) {
    throw new Error('invalid magic number');
  }
  sIndex += 4;
  let descriptor = src[sIndex++];
  if ((descriptor & fdVersionMask) !== fdVersion) {
    throw new Error('incompatible descriptor version ' + (descriptor & fdVersionMask));
  }
  let useBlockSum = (descriptor & fdBlockChksum) !== 0;
  let useContentSize = (descriptor & fdContentSize) !== 0;
  let bsIdx = (src[sIndex++] >> bsShift) & bsMask;
  if (bsMap[bsIdx] === undefined) {
    throw new Error('invalid block size ' + bsIdx);
  }
  let maxBlockSize = bsMap[bsIdx];
  if (useContentSize) {
    return util.readU64(src, sIndex);
  }
  sIndex++;
  let maxSize = 0;
  while (true) {
    let blockSize = util.readU32(src, sIndex);
    sIndex += 4;
    if (blockSize & bsUncompressed) {
      blockSize &= ~bsUncompressed;
      maxSize += blockSize;
    } else {
      maxSize += maxBlockSize;
    }
    if (blockSize === 0) {
      return maxSize;
    }
    if (useBlockSum) {
      sIndex += 4;
    }
    sIndex += blockSize;
  }
}
exports.makeBuffer = makeBuffer;
exports.decompressBlock = (src, dst, sIndex, sLength, dIndex) => {
  let mLength, mOffset, sEnd, n, i;
  sEnd = sIndex + sLength;
  while (sIndex < sEnd) {
    let token = src[sIndex++];
    let literalCount = (token >> 4);
    if (literalCount > 0) {
      if (literalCount === 0xf) {
        while (true) {
          literalCount += src[sIndex];
          if (src[sIndex++] !== 0xff) {
            break;
          }
        }
      }
      for (n = sIndex + literalCount; sIndex < n;) {
        dst[dIndex++] = src[sIndex++];
      }
    }
    if (sIndex >= sEnd) {
      break;
    }
    mLength = (token & 0xf);
    mOffset = src[sIndex++] | (src[sIndex++] << 8);
    if (mLength === 0xf) {
      while (true) {
        mLength += src[sIndex];
        if (src[sIndex++] !== 0xff) {
          break;
        }
      }
    }
    mLength += minMatch;
    for (i = dIndex - mOffset, n = i + mLength; i < n;) {
      dst[dIndex++] = dst[i++] | 0;
    }
  }
  return dIndex;
};
exports.compressBlock = (src, dst, sIndex, sLength, hashTable) => {
  let mIndex, mAnchor, mLength, mOffset, mStep;
  let literalCount, dIndex, sEnd, n;
  dIndex = 0;
  sEnd = sLength + sIndex;
  mAnchor = sIndex;
  if (sLength >= minLength) {
    let searchMatchCount = (1 << skipTrigger) + 3;
    while (sIndex + minMatch < sEnd - searchLimit) {
      let seq = util.readU32(src, sIndex);
      let hash = util.hashU32(seq) >>> 0;
      hash = ((hash >> 16) ^ hash) >>> 0 & 0xffff;
      mIndex = hashTable[hash] - 1;
      hashTable[hash] = sIndex + 1;
      if (mIndex < 0 || ((sIndex - mIndex) >>> 16) > 0 || util.readU32(src, mIndex) !== seq) {
        mStep = searchMatchCount++ >> skipTrigger;
        sIndex += mStep;
        continue;
      }
      searchMatchCount = (1 << skipTrigger) + 3;
      literalCount = sIndex - mAnchor;
      mOffset = sIndex - mIndex;
      sIndex += minMatch;
      mIndex += minMatch;
      mLength = sIndex;
      while (sIndex < sEnd - searchLimit && src[sIndex] === src[mIndex]) {
        sIndex++;
        mIndex++;
      }
      mLength = sIndex - mLength;
      let token = mLength < mlMask ? mLength : mlMask;
      if (literalCount >= runMask) {
        dst[dIndex++] = (runMask << mlBits) + token;
        for (n = literalCount - runMask; n >= 0xff; n -= 0xff) {
          dst[dIndex++] = 0xff;
        }
        dst[dIndex++] = n;
      } else {
        dst[dIndex++] = (literalCount << mlBits) + token;
      }
      for (let i = 0; i < literalCount; i++) {
        dst[dIndex++] = src[mAnchor + i];
      }
      dst[dIndex++] = mOffset;
      dst[dIndex++] = (mOffset >> 8);
      if (mLength >= mlMask) {
        for (n = mLength - mlMask; n >= 0xff; n -= 0xff) {
          dst[dIndex++] = 0xff;
        }
        dst[dIndex++] = n;
      }
      mAnchor = sIndex;
    }
  }
  if (mAnchor === 0) {
    return 0;
  }
  literalCount = sEnd - mAnchor;
  if (literalCount >= runMask) {
    dst[dIndex++] = (runMask << mlBits);
    for (n = literalCount - runMask; n >= 0xff; n -= 0xff) {
      dst[dIndex++] = 0xff;
    }
    dst[dIndex++] = n;
  } else {
    dst[dIndex++] = (literalCount << mlBits);
  }
  sIndex = mAnchor;
  while (sIndex < sEnd) {
    dst[dIndex++] = src[sIndex++];
  }
  return dIndex;
};
exports.decompressFrame = (src, dst) => {
  let useBlockSum, useContentSum, useContentSize, descriptor;
  let sIndex = 0;
  let dIndex = 0;
  if (util.readU32(src, sIndex) !== magicNum) {
    throw new Error('invalid magic number');
  }
  sIndex += 4;
  descriptor = src[sIndex++];
  if ((descriptor & fdVersionMask) !== fdVersion) {
    throw new Error('incompatible descriptor version');
  }
  useBlockSum = (descriptor & fdBlockChksum) !== 0;
  useContentSum = (descriptor & fdContentChksum) !== 0;
  useContentSize = (descriptor & fdContentSize) !== 0;
  let bsIdx = (src[sIndex++] >> bsShift) & bsMask;
  if (bsMap[bsIdx] === undefined) {
    throw new Error('invalid block size');
  }
  if (useContentSize) {
    sIndex += 8;
  }
  sIndex++;
  while (true) {
    let compSize;
    compSize = util.readU32(src, sIndex);
    sIndex += 4;
    if (compSize === 0) {
      break;
    }
    if (useBlockSum) {
      sIndex += 4;
    }
    if ((compSize & bsUncompressed) !== 0) {
      compSize &= ~bsUncompressed;
      for (let j = 0; j < compSize; j++) {
        dst[dIndex++] = src[sIndex++];
      }
    } else {
      dIndex = exports.decompressBlock(src, dst, sIndex, compSize, dIndex);
      sIndex += compSize;
    }
  }

  if (useContentSum) {
    sIndex += 4;
  }
  return dIndex;
};
exports.compressFrame = (src, dst) => {
  let dIndex = 0;
  util.writeU32(dst, dIndex, magicNum);
  dIndex += 4;
  dst[dIndex++] = fdVersion;
  dst[dIndex++] = bsDefault << bsShift;
  dst[dIndex] = xxhash.hash(0, dst, 4, dIndex - 4) >> 8;
  dIndex++;
  let maxBlockSize = bsMap[bsDefault];
  let remaining = src.length;
  let sIndex = 0;
  clearHashTable(hashTable);
  while (remaining > 0) {
    let compSize = 0;
    let blockSize = remaining > maxBlockSize ? maxBlockSize : remaining;
    compSize = exports.compressBlock(src, blockBuf, sIndex, blockSize, hashTable);
    if (compSize > blockSize || compSize === 0) {
      util.writeU32(dst, dIndex, 0x80000000 | blockSize);
      dIndex += 4;
      for (let z = sIndex + blockSize; sIndex < z;) {
        dst[dIndex++] = src[sIndex++];
      }
      remaining -= blockSize;
    } else {
      util.writeU32(dst, dIndex, compSize);
      dIndex += 4;
      for (let j = 0; j < compSize;) {
        dst[dIndex++] = blockBuf[j++];
      }
      sIndex += blockSize;
      remaining -= blockSize;
    }
  }
  util.writeU32(dst, dIndex, 0);
  dIndex += 4;
  return dIndex;
};
exports.decompress = (src, maxSize) => {
  let dst, size;
  if (maxSize === undefined) {
    maxSize = exports.decompressBound(src);
  }
  dst = exports.makeBuffer(maxSize);
  size = exports.decompressFrame(src, dst);
  if (size !== maxSize) {
    dst = sliceArray(dst, 0, size);
  }
  return dst;
};
exports.compress = (src, maxSize) => {
  let dst, size;
  if (maxSize === undefined) {
    maxSize = exports.compressBound(src.length);
  }
  dst = exports.makeBuffer(maxSize);
  size = exports.compressFrame(src, dst);
  if (size !== maxSize) {
    dst = sliceArray(dst, 0, size);
  }
  return dst;
};
