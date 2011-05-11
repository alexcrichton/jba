/**
 * @constructor
 */
var JBA = function() {
  this.cpu    = new JBA.CPU();
  this.memory = new JBA.Memory();
  this.gpu    = new JBA.GPU();
  this.timer  = new JBA.Timer();

  this.cpu.memory = this.memory;
  this.gpu.mem = this.memory;
  this.memory.gpu = this.gpu;
  this.memory.timer = this.timer;
  this.timer.memory = this.memory;

  this.memory.powerOn();
};

JBA.prototype = {
  /** @type {JBA.CPU} */
  cpu: null,
  /** @type {JBA.Memory} */
  memory: null,
  /** @type {JBA.GPU} */
  gpu: null,
  /** @type {JBA.Timer} */
  timer: null,

  fps: 0,

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

  frame: function(do_another) {
    // See http://imrannazar.com/GameBoy-Emulation-in-JavaScript:-GPU-Timings
    // for the timing for this constant
    var cycles_left = 70224, t;
    do {
      t = this.cpu.exec();
      cycles_left -= t;
      this.gpu.step(t);
    } while (cycles_left > 0);
    this.fps++;

    if (do_another)
      this._timeout = setTimeout(this.frame.bind(this, do_another), 0);
  },

  run: function() {
    this.frame(true);
  },

  stop: function() {
    clearTimeout(this._timeout);
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
