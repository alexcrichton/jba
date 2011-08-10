/**
 * A small class for representing an IO object on a string, used for save
 * states.
 *
 * @constructor
 * @param {string=} data the initial data of the IO object, defaults to ''
 */
JBA.StringIO = function(data) {
  this.data = data || '';
  this.position = 0;
};

JBA.StringIO.prototype = {
  /**
   * Writes a byte to the StringIO
   *
   * @param {number} b the byte to write
   */
  wb: function(b) {
    if (b < 0 || 255 < b) {
      throw "Not a byte value: " + b;
    }
    this.data += String.fromCharCode(b);
    this.position++;
  },

  /**
   * Write a 2-byte word to the StringIO
   *
   * @param {number} word the 2-byte word to write
   */
  ww: function(word) {
    this.wb(word & 0xff);
    this.wb(word >> 8);
  },

  /**
   * Read a byte from the StringIO
   *
   * @return {number} the next byte
   */
  rb: function() {
    if (this.position >= this.data.length) {
      throw "Reached end of string";
    }
    return this.data.charCodeAt(this.position++);
  },

  /**
   * Read a 2-byte word from the StringIO
   *
   * @return {number} the next 2-byte word
   */
  rw: function() {
    return this.rb() | (this.rb() << 8);
  },

  /**
   * Rewind this IO back to the beginning
   */
  rewind: function() {
    this.position = 0;
  }
};
