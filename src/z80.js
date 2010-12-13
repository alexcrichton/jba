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
 *    registers.pc &= 0xffff;
 *    fun(registers, memory);
 *
 *    // ... other things
 *
 *  }
 */
var Z80 = {
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
   */
  Registers: function() {
    this._saved = {
      a: 0, b: 0, c: 0, d: 0, e: 0, f: 0, h: 0, l: 0,
      sp: 0, pc: 0, m: 0, ime: 0, halt: 0, stop: 0
    };

    this.reset();
  }
};

Z80.Registers.prototype = {
  a: 0, b: 0, c: 0, d: 0, e: 0, f: 0, h: 0, l: 0,

  sp: 0, pc: 0, m: 0,

  ime: 0, halt: 0, stop: 0,

  /**
   * Saves the state of these registers in an internal structure. Can be
   * restored via a call to #restore()
   */
  save: function() {
    this._saved.a = this.a;
    this._saved.b = this.b;
    this._saved.c = this.c;
    this._saved.d = this.d;
    this._saved.e = this.e;
    this._saved.f = this.f;
    this._saved.h = this.h;
    this._saved.l = this.l;

    this._saved.sp = this.sp;
    this._saved.pc = this.pc;
    this._saved.m = this.m;

    this._saved.ime = this.ime;
    this._saved.halt = this.halt;
    this._saved.stop = this.stop;
  },

  /**
   * Restores the state of the registers recorded from the last call to #save()
   */
  restore: function() {
    this.a = this._saved.a;
    this.b = this._saved.b;
    this.c = this._saved.c;
    this.d = this._saved.d;
    this.e = this._saved.e;
    this.f = this._saved.f;
    this.h = this._saved.h;
    this.l = this._saved.l;

    this.sp = this._saved.sp;
    this.pc = this._saved.pc;
    this.m = this._saved.m;

    this.ime = this._saved.ime;
    this.halt = this._saved.halt;
    this.stop = this._saved.stop;
  },

  /**
   * Resets the registers to a know value from which emulation can possibly
   * begin.
   */
  reset: function() {
    // See: http://nocash.emubase.de/pandocs.htm#powerupsequence
    this.a = 0x01; this.f = 0xb0;
    this.b = 0x00; this.c = 0x13;
    this.d = 0x00; this.e = 0xd8;
    this.h = 0x01; this.l = 0x4d;

    this.sp = 0xfffe;
    this.pc = 0x100;
  }
};
