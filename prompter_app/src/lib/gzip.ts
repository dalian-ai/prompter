/**
 * Convert a string to its UTF-8 bytes and compress it.
 *
 * @param {string} str
 * @returns {Promise<Uint8Array>}
 */
export async function compress(str: string): Promise<Uint8Array> {
    // Convert the string to a byte stream.
    const stream = new Blob([str]).stream();

    // Create a compressed stream.
    const compressedStream: ReadableStream<Uint8Array> = stream.pipeThrough(
        new CompressionStream("gzip")
    );

    // Read all the bytes from this stream.
    const reader = compressedStream.getReader();

    let result;

    console.log("reading stream");
    let chunks: Uint8Array[] = [];
    while ((result = await reader.read())) {
        if (result.done) {
            return concatUint8Arrays(chunks);
        } else {
            // compressedData = new Uint8Array([...compressedData, ...result.value]);
            chunks.push(result.value)
        }
    }

    return new Uint8Array();
}

/**
 * Decompress bytes into a UTF-8 string.
 *
 * @param {Uint8Array} compressedBytes
 * @returns {Promise<string>}
 */
export async function decompress(compressedBytes: Uint8Array): Promise<string> {
    // Convert the bytes to a stream.
    const stream = new Blob([compressedBytes]).stream();

    // Create a decompressed stream.
    const decompressedStream = stream.pipeThrough(
        new DecompressionStream("gzip")
    );

    // Read all the bytes from this stream.
    const reader = decompressedStream.getReader();
    const decoder = new TextDecoder();
    let decompressedData = "";
    let result;

    while ((result = await reader.read())) {
        if (result.done) {
            return decompressedData;
        } else {
            decompressedData += decoder.decode(result.value);
        }
    }
    return "";
    // Convert the bytes to a string.
    // return new TextDecoder().decode(stringBytes);
}

/**
 * Combine multiple Uint8Arrays into one.
 *
 * @param {Uint8Array[]} uint8arrays
 * @returns {Promise<Uint8Array>}
 */
async function concatUint8Arrays(uint8arrays: Uint8Array[]) {
    const blob = new Blob(uint8arrays);
    const buffer = await blob.arrayBuffer();
    return new Uint8Array(buffer);
}
