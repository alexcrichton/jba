/**
 * Contains logic for the CPU of the GB.
 *
 * @constructor
 */
JBA.CPU = function() {
  this.registers = new Z80.Registers();

  this.reset();
};

JBA.CPU.prototype = {
  /** @type {JBA.Memory} */
  memory: null,

  ticks: 0,

  reset: function() {
    this.registers.reset();
  },

  /**
   * Exec one instruction for this CPU
   *
   * @return {number} the number of cycles the instruction took to run.
   */
  exec: function() {
    var instruction = this.memory.rb(this.registers.pc);
    this.registers.pc++;
    this.registers.pc &= 0xffff;
    var fun = Z80.map[instruction];
    this.registers.pc &= 0xffff;
    fun(this.registers, this.memory);

    var ticks = this.registers.m * 4;
    this.ticks += ticks;
    return ticks;
  }
};
