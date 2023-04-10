Not My Repo!!!
Just a Backup for Mini-LZ4 By slicewire-dev

# Mini-LZ4
**LZ4 Compression In Pure JavaScript**
### About

- 100% JavaScript 💪
- String/Array/Buffer Support 🧰
- Doesn't Crash 🧨
- Works In Browser 🎯
- Browserified 🤞
 
### Installation

```bash
~ npm i mini-lz4
```

### Usage

```js

const { compress, decompress } = require('mini-lz4')

const compressed = compress('data')
//==> <Buffer 90 g2 71 b3 83 42 61 03 81 50 9b>
const decompressed = decompress(compressed)
//==> 'data'

```

### Related Packages

- [Mini-Snappy](https://npmjs.org/package/mini-snappy)

- [Mini-LZ4](https://npmjs.org/package/mini-lz4)

- [Mini-Bzip2](https://npmjs.org/package/mini-bzip2)
