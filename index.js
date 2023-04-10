const lz4 = require('./src/lz4')

module.exports = {
    compress: (data) => {
        return Buffer.from(lz4.compress(Buffer.from(data)))
    },    
    decompress: (data) => {
        return Buffer.from(lz4.decompress(data))
    }
}