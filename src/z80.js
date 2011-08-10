/**
 * Instruction set for the Z80 gameboy processor
 *
 * When using this processor, this class should be used inside another CPU
 * object or something or other with a function like:
 *
 *  exec: function() {
 *
 *    // ... setup things
 *
 *    var memory = this.memory; // This responds to rb, wb, rw, ww. These are
 *                              // read byte, write byte, read word, write word.
 *    var registers = this.registers; // an instance of Z80.Registers
 *
 *    var fun = Z80.map[memory.rb(registers.pc++)];
 *    fun(registers, memory);
 *
 *    // ... other things
 *
 *  }
 */
var Z80 = {};

/**
 * This class represents the registers of the Z80 GB cpu.
 *
 * This is a hash with keys: a, b, c, d, e, f, h, l, pc, sp, m, ime, halt,
 * stop.
 *
 *  - a-l : are registers
 *  - pc  : the program counter
 *  - sp  : the stack pointer,
 *  - m   : the variable where the number of cycles the current
 *          instruction takes will be stored
 *  - ime  : flag for whether interrupts are tunred on or not
 *  - halt : flag as to whether a halt has happened or should
 *  - stop : flag as to whether a stop has happened or should
 *
 * @constructor
 * @implements {Serializable}
 */
Z80.Registers = function() {
  this.reset();
};

Z80.Registers.prototype = {
  a: 0, b: 0, c: 0, d: 0, e: 0, f: 0, h: 0, l: 0,

  sp: 0, // Stack pointer
  pc: 0, // Program counter
  m: 0, // Cycles of last instruction

  ime: 0, // Interrupts enabled flag
  halt: 0, // Halt until interrupt occurs
  stop: 0, // kill processor ?

  af: function() { return (this.a << 8) | this.f; },
  bc: function() { return (this.b << 8) | this.c; },
  de: function() { return (this.d << 8) | this.e; },
  hl: function() { return (this.h << 8) | this.l; },

  /**
   * Resets the registers to a know value from which emulation can possibly
   * begin.
   */
  reset: function() {
    this.ime  = 0;
    this.halt = 0;
    this.stop = 0;
    this.m    = 0;

    // See: http://nocash.emubase.de/pandocs.htm#powerupsequence
    // We initialize A to 0x11 instead of 0x01 because we're emulating CGB
    // hardware and this is how the difference is detected
    this.a = 0x11; this.f = 0xb0;
    this.b = 0x00; this.c = 0x13;
    this.d = 0x00; this.e = 0xd8;
    this.h = 0x01; this.l = 0x4d;

    this.sp = 0xfffe;
    this.pc = 0x0100;
  },

  serialize: function(io) {
    io.wb(this.ime);
    io.wb(this.halt);
    io.wb(this.stop);
    io.wb(this.m);
    io.wb(this.a); io.wb(this.f);
    io.wb(this.b); io.wb(this.c);
    io.wb(this.d); io.wb(this.e);
    io.wb(this.h); io.wb(this.l);
    io.ww(this.sp);
    io.ww(this.pc);
  },

  deserialize: function(io) {
    this.ime  = io.rb();
    this.halt = io.rb();
    this.stop = io.rb();
    this.m = io.rb();
    this.a = io.rb(); this.f = io.rb();
    this.b = io.rb(); this.c = io.rb();
    this.d = io.rb(); this.e = io.rb();
    this.h = io.rb(); this.l = io.rb();
    this.sp = io.rw();
    this.pc = io.rw();
  }
};