/**
 * @constructor
 */
var JBA = function() {
  this.cpu    = new JBA.CPU();
  this.memory = new JBA.Memory();
  this.gpu    = new JBA.GPU();

  this.cpu.memory = this.memory;
  this.gpu.mem = this.memory;
  this.memory.gpu = this.gpu;

  this.memory.powerOn();
};

JBA.prototype = {
  /** @type {JBA.CPU} */
  cpu: null,
  /** @type {JBA.Memory} */
  memory: null,
  /** @type {JBA.GPU} */
  gpu: null,

  reset: function() {
    this.cpu.reset();
    this.memory.reset();
    this.gpu.reset();
    this.memory.powerOn();
  },

  exec: function() {
    var t = this.cpu.exec();
    this.gpu.step(t);
    return t;
  },

  frame: function() {
    // See http://imrannazar.com/GameBoy-Emulation-in-JavaScript:-GPU-Timings
    // for the timing for this constant
    var cycles_left = 70224;
    do {
      cycles_left -= this.exec();
    } while (cycles_left > 0);
  },

  run: function() {
    for (var i = 0; i < 10; i++)
      this.frame();
  },

  /**
   * Load a rom from a server. This assumes that jQuery is available.
   *
   * @param {string} url the url at which the rom is located.
   * @param {function()} callback invoked if the rom was successfully loaded.
   */
  load_rom: function(url, callback) {
    $.ajax({
      url: url,
      /* Force the browser to interpret this as binary data instead of unicode
         which produces incorrect charCodeAt() return values */
      beforeSend: function(xhr) {
        xhr.overrideMimeType('text/plain; charset=x-user-defined');
      },
      context: this,
      success: function(data) {
        this.memory.load_cartridge(data);

        if (callback) {
          callback();
        }
      }
    });
  }
};

/** @nosideffects */
JBA.assert = function(bool, message) {
  if (!bool) {
    if (message !== undefined) {
      throw message;
    } else {
      throw "Assertion failed!";
    }
  }
};
