/**
 * Emulates the functionality of the GPU of the GB
 *
 * @constructor
 */
JBA.GPU = function() {
  this.reset();
};

JBA.GPU.prototype = {
  vram: null,

  reset: function() {
    this.vram = [];
    for (var i = 0; i < (8 << 10); i++) this.vram[i] = 0;
  }
};
