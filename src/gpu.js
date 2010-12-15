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
  oam: null,

  reset: function() {
    this.vram = [];
    this.oam  = [];
    for (var i = 0; i < (8 << 10); i++) this.vram[i] = 0;
    for (i = 0; i < 0xff; i++) this.oam[i] = 0;
  }
};
