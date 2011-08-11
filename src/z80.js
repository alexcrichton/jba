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

// Index of each register in the u8regs array
Z80.A = 0;
Z80.B = 1;
Z80.C = 2;
Z80.D = 3;
Z80.E = 4;
Z80.F = 5;
Z80.H = 6;
Z80.L = 7;
Z80.M = 8;

// Index of each register in u16regs array
Z80.SP = 0;
Z80.PC = 1;

Z80.Registers.prototype = {
  m: 0, // Cycles of last instruction

  ime: 0, // Interrupts enabled flag
  halt: 0, // Halt until interrupt occurs
  stop: 0, // kill processor ?

  u8regs:  new Uint8Array(9),
  u16regs: new Uint16Array(2),

  af: function() { return (this.u8regs[Z80.A] << 8) | this.u8regs[Z80.F]; },
  bc: function() { return (this.u8regs[Z80.B] << 8) | this.u8regs[Z80.C]; },
  de: function() { return (this.u8regs[Z80.D] << 8) | this.u8regs[Z80.E]; },
  hl: function() { return (this.u8regs[Z80.H] << 8) | this.u8regs[Z80.L]; },

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
    var u8 = this.u8regs, u16 = this.u16regs;
    u8[Z80.A] = 0x11; u8[Z80.F] = 0xb0;
    u8[Z80.B] = 0x00; u8[Z80.C] = 0x13;
    u8[Z80.D] = 0x00; u8[Z80.E] = 0xd8;
    u8[Z80.H] = 0x01; u8[Z80.L] = 0x4d;

    u16[Z80.SP] = 0xfffe;
    u16[Z80.PC] = 0x0100;
  },

  serialize: function(io) {
    io.wb(this.ime);
    io.wb(this.halt);
    io.wb(this.stop);
    var i;
    for (i = 0; i < this.u8regs.length;  i++) io.wb(this.u8regs[i]);
    for (i = 0; i < this.u16regs.length; i++) io.ww(this.u16regs[i]);
  },

  deserialize: function(io) {
    this.ime  = io.rb();
    this.halt = io.rb();
    this.stop = io.rb();
    var i;
    for (i = 0; i < this.u8regs.length;  i++) this.u8regs[i]  = io.rb();
    for (i = 0; i < this.u16regs.length; i++) this.u16regs[i] = io.rw();
  }
};
