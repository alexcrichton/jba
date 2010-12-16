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
};

JBA.prototype = {
  frame: function() {
    var cycles_left = 70224;
    do {
      var t = this.cpu.exec();
      cycles_left -= t;
      this.gpu.step(t);
    } while (cycles_left > 0);
  },

  run: function() {
    this.frame();
  }
};
