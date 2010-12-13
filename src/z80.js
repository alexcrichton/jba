/**
 * Instruction set for the Z80 gameboy processor (apparently not the actual z80
 * but slightly modified.)
 *
 * I apologize in advance for the size of this file, but the methodology used
 * here is that every cpu instruction is implemented as a function and is
 * located in a table. The opcodes themselves can then be used as an index into
 * the table for when the function is executed.
 *
 * This means that we need a lot of functions because the z80 has 256
 * instructions and the GBC adds another 256 I think.
 *
 * Most of the functions are very similar, however, so the vast majority of
 * contents in Z80.ops is generated via the ruby file in src/gen. That file
 * should be modified if updating a cpu instruction here. The tables at the
 * bottom and the first few functions in Z80.ops, however, are not generated
 * and should be modified right here.
 *
 * Hopefully the very large list of functions won't lose too much over just
 * a massive switch or else this could get a lot uglier...
 *
 * === Syntax for Calling ===
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

Z80.ops = {
  // Garbage instruction
  xx: function() {},
  map_cb: function(r, m) {
    var fun = Z80.cbmap[m.rb(r.pc++)];
    r.pc &= 0xffff;
    fun(r, m);
  },

  // 8 bit loading between registers
  ld_bb: function(r){ r.m = 1; },
  ld_bc: function(r){ r.b = r.c; r.m = 1; },
  ld_bd: function(r){ r.b = r.d; r.m = 1; },
  ld_be: function(r){ r.b = r.e; r.m = 1; },
  ld_bh: function(r){ r.b = r.h; r.m = 1; },
  ld_bl: function(r){ r.b = r.l; r.m = 1; },
  ld_ba: function(r){ r.b = r.a; r.m = 1; },
  ld_cb: function(r){ r.c = r.b; r.m = 1; },
  ld_cc: function(r){ r.m = 1; },
  ld_cd: function(r){ r.c = r.d; r.m = 1; },
  ld_ce: function(r){ r.c = r.e; r.m = 1; },
  ld_ch: function(r){ r.c = r.h; r.m = 1; },
  ld_cl: function(r){ r.c = r.l; r.m = 1; },
  ld_ca: function(r){ r.c = r.a; r.m = 1; },
  ld_db: function(r){ r.d = r.b; r.m = 1; },
  ld_dc: function(r){ r.d = r.c; r.m = 1; },
  ld_dd: function(r){ r.m = 1; },
  ld_de: function(r){ r.d = r.e; r.m = 1; },
  ld_dh: function(r){ r.d = r.h; r.m = 1; },
  ld_dl: function(r){ r.d = r.l; r.m = 1; },
  ld_da: function(r){ r.d = r.a; r.m = 1; },
  ld_eb: function(r){ r.e = r.b; r.m = 1; },
  ld_ec: function(r){ r.e = r.c; r.m = 1; },
  ld_ed: function(r){ r.e = r.d; r.m = 1; },
  ld_ee: function(r){ r.m = 1; },
  ld_eh: function(r){ r.e = r.h; r.m = 1; },
  ld_el: function(r){ r.e = r.l; r.m = 1; },
  ld_ea: function(r){ r.e = r.a; r.m = 1; },
  ld_hb: function(r){ r.h = r.b; r.m = 1; },
  ld_hc: function(r){ r.h = r.c; r.m = 1; },
  ld_hd: function(r){ r.h = r.d; r.m = 1; },
  ld_he: function(r){ r.h = r.e; r.m = 1; },
  ld_hh: function(r){ r.m = 1; },
  ld_hl: function(r){ r.h = r.l; r.m = 1; },
  ld_ha: function(r){ r.h = r.a; r.m = 1; },
  ld_lb: function(r){ r.l = r.b; r.m = 1; },
  ld_lc: function(r){ r.l = r.c; r.m = 1; },
  ld_ld: function(r){ r.l = r.d; r.m = 1; },
  ld_le: function(r){ r.l = r.e; r.m = 1; },
  ld_lh: function(r){ r.l = r.h; r.m = 1; },
  ld_ll: function(r){ r.m = 1; },
  ld_la: function(r){ r.l = r.a; r.m = 1; },
  ld_ab: function(r){ r.a = r.b; r.m = 1; },
  ld_ac: function(r){ r.a = r.c; r.m = 1; },
  ld_ad: function(r){ r.a = r.d; r.m = 1; },
  ld_ae: function(r){ r.a = r.e; r.m = 1; },
  ld_ah: function(r){ r.a = r.h; r.m = 1; },
  ld_al: function(r){ r.a = r.l; r.m = 1; },
  ld_aa: function(r){ r.m = 1; },

  // 8 bit loading immediate values
  ld_bn: function(r, m){ r.b = m.rb(r.pc); r.pc++; r.m = 2; },
  ld_cn: function(r, m){ r.c = m.rb(r.pc); r.pc++; r.m = 2; },
  ld_dn: function(r, m){ r.d = m.rb(r.pc); r.pc++; r.m = 2; },
  ld_en: function(r, m){ r.e = m.rb(r.pc); r.pc++; r.m = 2; },
  ld_hn: function(r, m){ r.h = m.rb(r.pc); r.pc++; r.m = 2; },
  ld_ln: function(r, m){ r.l = m.rb(r.pc); r.pc++; r.m = 2; },
  ld_an: function(r, m){ r.a = m.rb(r.pc); r.pc++; r.m = 2; },

  // 8 bit loading from HL
  ld_bhlm: function(r, m){ r.b = m.rb((r.h << 8) | r.l); r.m = 2; },
  ld_chlm: function(r, m){ r.c = m.rb((r.h << 8) | r.l); r.m = 2; },
  ld_dhlm: function(r, m){ r.d = m.rb((r.h << 8) | r.l); r.m = 2; },
  ld_ehlm: function(r, m){ r.e = m.rb((r.h << 8) | r.l); r.m = 2; },
  ld_hhlm: function(r, m){ r.h = m.rb((r.h << 8) | r.l); r.m = 2; },
  ld_lhlm: function(r, m){ r.l = m.rb((r.h << 8) | r.l); r.m = 2; },
  ld_ahlm: function(r, m){ r.a = m.rb((r.h << 8) | r.l); r.m = 2; },

  // 8 bit writing to HL
  ld_hlmb: function(r, m){ m.wb((r.h << 8) | r.l, r.b); r.m = 2; },
  ld_hlmc: function(r, m){ m.wb((r.h << 8) | r.l, r.c); r.m = 2; },
  ld_hlmd: function(r, m){ m.wb((r.h << 8) | r.l, r.d); r.m = 2; },
  ld_hlme: function(r, m){ m.wb((r.h << 8) | r.l, r.e); r.m = 2; },
  ld_hlmh: function(r, m){ m.wb((r.h << 8) | r.l, r.h); r.m = 2; },
  ld_hlml: function(r, m){ m.wb((r.h << 8) | r.l, r.l); r.m = 2; },
  ld_hlma: function(r, m){ m.wb((r.h << 8) | r.l, r.a); r.m = 2; },

  // Other loading commands
  ld_hlmn: function(r, m){ m.wb((r.h << 8) | r.l, m.rb(r.pc)); r.pc++; r.m = 3; },
  ld_abc: function(r, m){ r.a = m.rb((r.b << 8) | r.c); r.m = 2; },
  ld_ade: function(r, m){ r.a = m.rb((r.d << 8) | r.e); r.m = 2; },
  ld_an: function(r, m){ r.a = m.rb(m.rw(r.pc)); r.pc += 2; r.m = 4; },

  ld_bca: function(r, m){ m.wb((r.b << 8) | r.c, r.a); r.m = 2; },
  ld_dea: function(r, m){ m.wb((r.d << 8) | r.e, r.a); r.m = 2; },
  ld_na: function(r, m){ m.wb(m.rw(r.pc), r.a); r.pc += 2; r.m = 4; },
  ld_nsp: function(r, m){ m.ww(m.rw(r.pc), r.sp); r.pc += 2; r.m = 4; },

  ld_aIOn: function(r, m){ r.a = m.rb(0xff00 | m.rb(r.pc++)); r.m = 3; },
  ld_IOna: function(r, m){ m.wb(0xff00 | m.rb(r.pc++), r.a); r.m = 3; },
  ld_aIOc: function(r, m){ r.a = m.rb(0xff00 | r.c); r.m = 3; },
  ld_IOca: function(r, m){ m.wb(0xff00 | r.c, r.a); r.m = 3; },

  ldi_hlma: function(r, m){ m.wb((r.h << 8) | r.l, r.a); r.l = (r.l + 1) & 0xff; if (!r.l) r.h = (r.h + 1) & 0xff; r.m = 2; },
  ldi_ahlm: function(r, m){ r.a = m.rb((r.h << 8) | r.l); r.l = (r.l + 1) & 0xff; if (!r.l) r.h = (r.h + 1) & 0xff; r.m = 2; },
  ldd_hlma: function(r, m){ m.wb((r.h << 8) | r.l, r.a); r.l = (r.l - 1) & 0xff; if (r.l == 0xff) r.h = (r.h - 1) & 0xff; r.m = 2; },
  ldd_ahlm: function(r, m){ r.a = m.rb((r.h << 8) | r.l); r.l = (r.l - 1) & 0xff; if (r.l == 0xff) r.h = (r.h - 1) & 0xff; r.m = 2; },

  // 16 bit loading commands
  ld_bcn: function(r, m){ r.c = m.rb(r.pc++); r.b = m.rb(r.pc++); r.m = 3; },
  ld_den: function(r, m){ r.e = m.rb(r.pc++); r.d = m.rb(r.pc++); r.m = 3; },
  ld_hln: function(r, m){ r.l = m.rb(r.pc++); r.h = m.rb(r.pc++); r.m = 3; },
  ld_spn: function(r, m){ r.sp = m.rw(r.pc); r.pc += 2; r.m = 3; },
  ld_sphl: function(r, m){ r.sp = (r.h << 8) | r.l; r.m = 2; },
  push_bc: function(r, m){ m.wb(--r.sp, r.b); m.wb(--r.sp, r.c); r.m = 4; },
  pop_bc: function(r, m){ r.c = m.rb(r.sp++); r.b = m.wb(r.sp++); r.m = 3; },
  push_de: function(r, m){ m.wb(--r.sp, r.d); m.wb(--r.sp, r.e); r.m = 4; },
  pop_de: function(r, m){ r.e = m.rb(r.sp++); r.d = m.wb(r.sp++); r.m = 3; },
  push_hl: function(r, m){ m.wb(--r.sp, r.h); m.wb(--r.sp, r.l); r.m = 4; },
  pop_hl: function(r, m){ r.l = m.rb(r.sp++); r.h = m.wb(r.sp++); r.m = 3; },
  push_af: function(r, m){ m.wb(--r.sp, r.a); m.wb(--r.sp, r.f); r.m = 4; },
  pop_af: function(r, m){ r.f = m.rb(r.sp++); r.a = m.wb(r.sp++); r.m = 3; },

  // 8 bit addition
  add_ab: function(r, m) {
    var i = r.a, j = r.b;
    r.a += j;
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) { r.f |= 128; }
    if ((r.a ^ j ^ i) & 0x10) { r.f |= 32; }
    r.m = 1;
  },
  add_ac: function(r, m) {
    var i = r.a, j = r.c;
    r.a += j;
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) { r.f |= 128; }
    if ((r.a ^ j ^ i) & 0x10) { r.f |= 32; }
    r.m = 1;
  },
  add_ad: function(r, m) {
    var i = r.a, j = r.d;
    r.a += j;
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) { r.f |= 128; }
    if ((r.a ^ j ^ i) & 0x10) { r.f |= 32; }
    r.m = 1;
  },
  add_ae: function(r, m) {
    var i = r.a, j = r.e;
    r.a += j;
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) { r.f |= 128; }
    if ((r.a ^ j ^ i) & 0x10) { r.f |= 32; }
    r.m = 1;
  },
  add_ah: function(r, m) {
    var i = r.a, j = r.h;
    r.a += j;
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) { r.f |= 128; }
    if ((r.a ^ j ^ i) & 0x10) { r.f |= 32; }
    r.m = 1;
  },
  add_al: function(r, m) {
    var i = r.a, j = r.l;
    r.a += j;
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) { r.f |= 128; }
    if ((r.a ^ j ^ i) & 0x10) { r.f |= 32; }
    r.m = 1;
  },
  add_aa: function(r, m) {
    var i = r.a, j = r.a;
    r.a += j;
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) { r.f |= 128; }
    if ((r.a ^ j ^ i) & 0x10) { r.f |= 32; }
    r.m = 1;
  },
  add_ahlm: function(r, m) {
    var i = r.a, j = m.rb((r.h << 8) | r.l);
    r.a += j;
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) { r.f |= 128; }
    if ((r.a ^ j ^ i) & 0x10) { r.f |= 32; }
    r.m = 2;
  },
  add_an: function(r, m) {
    var i = r.a, j = m.rb(r.pc++);
    r.a += j;
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) { r.f |= 128; }
    if ((r.a ^ j ^ i) & 0x10) { r.f |= 32; }
    r.m = 2;
  },
  adc_ab: function(r, m){
    var i = r.a, j = r.b;
    r.a += j + ((r.f & 16) >> 4);
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ j ^ i) & 0x10) r.f |= 32;
    r.m = 1;
  },
  adc_ac: function(r, m){
    var i = r.a, j = r.c;
    r.a += j + ((r.f & 16) >> 4);
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ j ^ i) & 0x10) r.f |= 32;
    r.m = 1;
  },
  adc_ad: function(r, m){
    var i = r.a, j = r.d;
    r.a += j + ((r.f & 16) >> 4);
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ j ^ i) & 0x10) r.f |= 32;
    r.m = 1;
  },
  adc_ae: function(r, m){
    var i = r.a, j = r.e;
    r.a += j + ((r.f & 16) >> 4);
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ j ^ i) & 0x10) r.f |= 32;
    r.m = 1;
  },
  adc_ah: function(r, m){
    var i = r.a, j = r.h;
    r.a += j + ((r.f & 16) >> 4);
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ j ^ i) & 0x10) r.f |= 32;
    r.m = 1;
  },
  adc_al: function(r, m){
    var i = r.a, j = r.l;
    r.a += j + ((r.f & 16) >> 4);
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ j ^ i) & 0x10) r.f |= 32;
    r.m = 1;
  },
  adc_aa: function(r, m){
    var i = r.a, j = r.a;
    r.a += j + ((r.f & 16) >> 4);
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ j ^ i) & 0x10) r.f |= 32;
    r.m = 1;
  },
  adc_ahlm: function(r, m){
    var i = r.a, j = m.rb((r.h << 8) | r.l);
    r.a += j + ((r.f & 16) >> 4);
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ j ^ i) & 0x10) r.f |= 32;
    r.m = 2;
  },
  adc_an: function(r, m){
    var i = r.a, j = m.rb(r.pc++);
    r.a += j + ((r.f & 16) >> 4);
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ j ^ i) & 0x10) r.f |= 32;
    r.m = 2;
  },

  // 8 bit subtraction
  sub_ab: function(r, m){
    var a = r.a;
    var b = r.b;
    r.a -= b;
    r.f = 64 | (r.a < 0 ? 16 : 0);
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ b ^ a) & 0x10) r.f |= 32;
    r.m = 1;
  },
  sub_ac: function(r, m){
    var a = r.a;
    var b = r.c;
    r.a -= b;
    r.f = 64 | (r.a < 0 ? 16 : 0);
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ b ^ a) & 0x10) r.f |= 32;
    r.m = 1;
  },
  sub_ad: function(r, m){
    var a = r.a;
    var b = r.d;
    r.a -= b;
    r.f = 64 | (r.a < 0 ? 16 : 0);
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ b ^ a) & 0x10) r.f |= 32;
    r.m = 1;
  },
  sub_ae: function(r, m){
    var a = r.a;
    var b = r.e;
    r.a -= b;
    r.f = 64 | (r.a < 0 ? 16 : 0);
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ b ^ a) & 0x10) r.f |= 32;
    r.m = 1;
  },
  sub_ah: function(r, m){
    var a = r.a;
    var b = r.h;
    r.a -= b;
    r.f = 64 | (r.a < 0 ? 16 : 0);
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ b ^ a) & 0x10) r.f |= 32;
    r.m = 1;
  },
  sub_al: function(r, m){
    var a = r.a;
    var b = r.l;
    r.a -= b;
    r.f = 64 | (r.a < 0 ? 16 : 0);
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ b ^ a) & 0x10) r.f |= 32;
    r.m = 1;
  },
  sub_aa: function(r, m){
    var a = r.a;
    var b = r.a;
    r.a -= b;
    r.f = 64 | (r.a < 0 ? 16 : 0);
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ b ^ a) & 0x10) r.f |= 32;
    r.m = 1;
  },
  sub_ahlm: function(r, m){
    var a = r.a;
    var b = m.rb((r.h << 8) | r.l);
    r.a -= b;
    r.f = 64 | (r.a < 0 ? 16 : 0);
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ b ^ a) & 0x10) r.f |= 32;
    r.m = 2;
  },
  sub_an: function(r, m){
    var a = r.a;
    var b = m.rb(r.pc++);
    r.a -= b;
    r.f = 64 | (r.a < 0 ? 16 : 0);
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ b ^ a) & 0x10) r.f |= 32;
    r.m = 2;
  },
  sbc_ab: function(r, m){
    var a = r.a;
    var b = r.b;
    r.a -= b + ((r.f & 16) >> 4);
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ b ^ a) & 0x10) r.f |= 32;
    r.m = 1;
  },
  sbc_ac: function(r, m){
    var a = r.a;
    var b = r.c;
    r.a -= b + ((r.f & 16) >> 4);
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ b ^ a) & 0x10) r.f |= 32;
    r.m = 1;
  },
  sbc_ad: function(r, m){
    var a = r.a;
    var b = r.d;
    r.a -= b + ((r.f & 16) >> 4);
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ b ^ a) & 0x10) r.f |= 32;
    r.m = 1;
  },
  sbc_ae: function(r, m){
    var a = r.a;
    var b = r.e;
    r.a -= b + ((r.f & 16) >> 4);
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ b ^ a) & 0x10) r.f |= 32;
    r.m = 1;
  },
  sbc_ah: function(r, m){
    var a = r.a;
    var b = r.h;
    r.a -= b + ((r.f & 16) >> 4);
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ b ^ a) & 0x10) r.f |= 32;
    r.m = 1;
  },
  sbc_al: function(r, m){
    var a = r.a;
    var b = r.l;
    r.a -= b + ((r.f & 16) >> 4);
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ b ^ a) & 0x10) r.f |= 32;
    r.m = 1;
  },
  sbc_aa: function(r, m){
    var a = r.a;
    var b = r.a;
    r.a -= b + ((r.f & 16) >> 4);
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ b ^ a) & 0x10) r.f |= 32;
    r.m = 1;
  },
  sbc_ahlm: function(r, m){
    var a = r.a;
    var b = m.rb((r.h << 8) | r.l);
    r.a -= b + ((r.f & 16) >> 4);
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ b ^ a) & 0x10) r.f |= 32;
    r.m = 2;
  },
  sbc_an: function(r, m){
    var a = r.a;
    var b = m.rb(r.pc++);
    r.a -= b + ((r.f & 16) >> 4);
    r.f = r.a > 0xff ? 16 : 0;
    r.a &= 0xff;
    if (!r.a) r.f |= 128;
    if ((r.a ^ b ^ a) & 0x10) r.f |= 32;
    r.m = 2;
  },

  // 8 bit bit-ops
  and_ab: function(r, m){
    r.a &= r.b;
    r.f = (r.a ? 0 : 128) | 32;
    r.m = 1;
  },
  and_ac: function(r, m){
    r.a &= r.c;
    r.f = (r.a ? 0 : 128) | 32;
    r.m = 1;
  },
  and_ad: function(r, m){
    r.a &= r.d;
    r.f = (r.a ? 0 : 128) | 32;
    r.m = 1;
  },
  and_ae: function(r, m){
    r.a &= r.e;
    r.f = (r.a ? 0 : 128) | 32;
    r.m = 1;
  },
  and_ah: function(r, m){
    r.a &= r.h;
    r.f = (r.a ? 0 : 128) | 32;
    r.m = 1;
  },
  and_al: function(r, m){
    r.a &= r.l;
    r.f = (r.a ? 0 : 128) | 32;
    r.m = 1;
  },
  and_aa: function(r, m){

    r.f = (r.a ? 0 : 128) | 32;
    r.m = 1;
  },
  and_ahlm: function(r, m){
    r.a &= m.rb((r.h << 8) | r.l);
    r.f = (r.a ? 0 : 128) | 32;
    r.m = 2;
  },
  and_an: function(r, m){
    r.a &= m.rb(r.pc++);
    r.f = (r.a ? 0 : 128) | 32;
    r.m = 2;
  },

  xor_ab: function(r, m){
    r.a ^= r.b; r.f = r.a ? 0 : 128;
    r.m = 1;
  },
  xor_ac: function(r, m){
    r.a ^= r.c; r.f = r.a ? 0 : 128;
    r.m = 1;
  },
  xor_ad: function(r, m){
    r.a ^= r.d; r.f = r.a ? 0 : 128;
    r.m = 1;
  },
  xor_ae: function(r, m){
    r.a ^= r.e; r.f = r.a ? 0 : 128;
    r.m = 1;
  },
  xor_ah: function(r, m){
    r.a ^= r.h; r.f = r.a ? 0 : 128;
    r.m = 1;
  },
  xor_al: function(r, m){
    r.a ^= r.l; r.f = r.a ? 0 : 128;
    r.m = 1;
  },
  xor_aa: function(r, m){
    r.a = 0; r.f = 128;
    r.m = 1;
  },
  xor_ahlm: function(r, m){
    r.a ^= m.rb((r.h << 8) | r.l); r.f = r.a ? 0 : 128;
    r.m = 2;
  },
  xor_an: function(r, m){
    r.a ^= m.rb(r.pc++); r.f = r.a ? 0 : 128;
    r.m = 2;
  },

  or_ab: function(r, m){
    r.a |= r.b;
    r.f = r.a ? 0 : 128;
    r.m = 1;
  },
  or_ac: function(r, m){
    r.a |= r.c;
    r.f = r.a ? 0 : 128;
    r.m = 1;
  },
  or_ad: function(r, m){
    r.a |= r.d;
    r.f = r.a ? 0 : 128;
    r.m = 1;
  },
  or_ae: function(r, m){
    r.a |= r.e;
    r.f = r.a ? 0 : 128;
    r.m = 1;
  },
  or_ah: function(r, m){
    r.a |= r.h;
    r.f = r.a ? 0 : 128;
    r.m = 1;
  },
  or_al: function(r, m){
    r.a |= r.l;
    r.f = r.a ? 0 : 128;
    r.m = 1;
  },
  or_aa: function(r, m){

    r.f = r.a ? 0 : 128;
    r.m = 1;
  },
  or_ahlm: function(r, m){
    r.a |= m.rb((r.h << 8) | r.l);
    r.f = r.a ? 0 : 128;
    r.m = 2;
  },
  or_an: function(r, m){
    r.a |= m.rb(r.pc++);
    r.f = r.a ? 0 : 128;
    r.m = 2;
  },

  // 8 bit comparisons
  cp_ab: function(r, m){
    var a = r.a;
    var b = r.b;
    var i = a - b;
    r.f = 64 | (r.a < 0 ? 16 : 0);
    i &= 0xff;
    if (!i) r.f |= 128;
    if ((a ^ b ^ i) & 0x10) r.f |= 32;
    r.m = 1;
  },
  cp_ac: function(r, m){
    var a = r.a;
    var b = r.c;
    var i = a - b;
    r.f = 64 | (r.a < 0 ? 16 : 0);
    i &= 0xff;
    if (!i) r.f |= 128;
    if ((a ^ b ^ i) & 0x10) r.f |= 32;
    r.m = 1;
  },
  cp_ad: function(r, m){
    var a = r.a;
    var b = r.d;
    var i = a - b;
    r.f = 64 | (r.a < 0 ? 16 : 0);
    i &= 0xff;
    if (!i) r.f |= 128;
    if ((a ^ b ^ i) & 0x10) r.f |= 32;
    r.m = 1;
  },
  cp_ae: function(r, m){
    var a = r.a;
    var b = r.e;
    var i = a - b;
    r.f = 64 | (r.a < 0 ? 16 : 0);
    i &= 0xff;
    if (!i) r.f |= 128;
    if ((a ^ b ^ i) & 0x10) r.f |= 32;
    r.m = 1;
  },
  cp_ah: function(r, m){
    var a = r.a;
    var b = r.h;
    var i = a - b;
    r.f = 64 | (r.a < 0 ? 16 : 0);
    i &= 0xff;
    if (!i) r.f |= 128;
    if ((a ^ b ^ i) & 0x10) r.f |= 32;
    r.m = 1;
  },
  cp_al: function(r, m){
    var a = r.a;
    var b = r.l;
    var i = a - b;
    r.f = 64 | (r.a < 0 ? 16 : 0);
    i &= 0xff;
    if (!i) r.f |= 128;
    if ((a ^ b ^ i) & 0x10) r.f |= 32;
    r.m = 1;
  },
  cp_aa: function(r, m){
    var a = r.a;
    var b = r.a;
    var i = a - b;
    r.f = 64 | (r.a < 0 ? 16 : 0);
    i &= 0xff;
    if (!i) r.f |= 128;
    if ((a ^ b ^ i) & 0x10) r.f |= 32;
    r.m = 1;
  },
  cp_ahlm: function(r, m){
    var a = r.a;
    var b = m.rb((r.h << 8) | r.l);
    var i = a - b;
    r.f = 64 | (r.a < 0 ? 16 : 0);
    i &= 0xff;
    if (!i) r.f |= 128;
    if ((a ^ b ^ i) & 0x10) r.f |= 32;
    r.m = 2;
  },
  cp_an: function(r, m){
    var a = r.a;
    var b = m.rb(r.pc++);
    var i = a - b;
    r.f = 64 | (r.a < 0 ? 16 : 0);
    i &= 0xff;
    if (!i) r.f |= 128;
    if ((a ^ b ^ i) & 0x10) r.f |= 32;
    r.m = 2;
  },

  // 8 bit increments/decrements
  inc_b: function(r){ r.b = (r.b + 1) & 0xff; r.f = r.b ? 0 : 128; r.m = 1; },
  inc_c: function(r){ r.c = (r.c + 1) & 0xff; r.f = r.c ? 0 : 128; r.m = 1; },
  inc_d: function(r){ r.d = (r.d + 1) & 0xff; r.f = r.d ? 0 : 128; r.m = 1; },
  inc_e: function(r){ r.e = (r.e + 1) & 0xff; r.f = r.e ? 0 : 128; r.m = 1; },
  inc_h: function(r){ r.h = (r.h + 1) & 0xff; r.f = r.h ? 0 : 128; r.m = 1; },
  inc_l: function(r){ r.l = (r.l + 1) & 0xff; r.f = r.l ? 0 : 128; r.m = 1; },
  inc_a: function(r){ r.a = (r.a + 1) & 0xff; r.f = r.a ? 0 : 128; r.m = 1; },
  inc_hlm: function(r, m){ var hl = (r.h << 8) | r.l, k = (m.rb(hl) + 1) & 0xff; m.wb(hl, k); r.f = k ? 0 : 128; r.m = 3; },

  dec_b: function(r){ r.b = (r.b - 1) & 0xff; r.f = (r.b ? 0 : 128) | 64; r.m = 1; },
  dec_c: function(r){ r.c = (r.c - 1) & 0xff; r.f = (r.c ? 0 : 128) | 64; r.m = 1; },
  dec_d: function(r){ r.d = (r.d - 1) & 0xff; r.f = (r.d ? 0 : 128) | 64; r.m = 1; },
  dec_e: function(r){ r.e = (r.e - 1) & 0xff; r.f = (r.e ? 0 : 128) | 64; r.m = 1; },
  dec_h: function(r){ r.h = (r.h - 1) & 0xff; r.f = (r.h ? 0 : 128) | 64; r.m = 1; },
  dec_l: function(r){ r.l = (r.l - 1) & 0xff; r.f = (r.l ? 0 : 128) | 64; r.m = 1; },
  dec_a: function(r){ r.a = (r.a - 1) & 0xff; r.f = (r.a ? 0 : 128) | 64; r.m = 1; },
  dec_hlm: function(r, m){ var hl = (r.h << 8) | r.l, k = (m.rb(hl) - 1) & 0xff; m.wb(hl, k); r.f = (k ? 0 : 128) | 64; r.m = 3; },

  // Miscellaneous 8 bit arithmetic
  daa: function(r, m) {
    var a = r.a;
    if ((r.f & 32) || ((r.a & 0xf) > 9)) r.a += 6;
    r.f &= 0xef;
    if ((r.f & 32) || (a > 0x99)) {
      r.a += 0x60;
      r.f |= 16;
    }
    r.m = 1;
  },
  cpl: function(r){ r.a ^= 0xff; r.f = 64 | 16; r.m = 1; },

  // 16 bit arithmetic
  add_hlhl: function(r){
    var hl = ((r.h << 8) | r.l) + ((r.h << 8) | r.l);
    if (hl > 0xfff) r.f |= 16; else r.f &= 239;
    r.l = hl & 0xff;
    r.h = (hl >> 8) & 0xff;
    r.m = 2;
  },
  add_hlbc: function(r){
    var hl = ((r.h << 8) | r.l) + ((r.b << 8) | r.c);
    if (hl > 0xfff) r.f |= 16; else r.f &= 239;
    r.l = hl & 0xff;
    r.h = (hl >> 8) & 0xff;
    r.m = 2;
  },
  add_hlde: function(r){
    var hl = ((r.h << 8) | r.l) + ((r.d << 8) | r.e);
    if (hl > 0xfff) r.f |= 16; else r.f &= 239;
    r.l = hl & 0xff;
    r.h = (hl >> 8) & 0xff;
    r.m = 2;
  },
  add_hlsp: function(r){
    var hl = ((r.h << 8) | r.l) + (r.sp);
    if (hl > 0xfff) r.f |= 16; else r.f &= 239;
    r.l = hl & 0xff;
    r.h = (hl >> 8) & 0xff;
    r.m = 2;
  },

  inc_bc: function(r){ r.c = (r.c + 1) & 0xff; if (!r.c) r.b = (r.b + 1) & 0xff; r.m = 2; },
  dec_bc: function(r){ r.c = (r.c - 1) & 0xff; if (r.c == 0xff) r.b = (r.b - 1) & 0xff; r.m = 2; },
  inc_de: function(r){ r.e = (r.e + 1) & 0xff; if (!r.e) r.d = (r.d + 1) & 0xff; r.m = 2; },
  dec_de: function(r){ r.e = (r.e - 1) & 0xff; if (r.e == 0xff) r.d = (r.d - 1) & 0xff; r.m = 2; },
  inc_hl: function(r){ r.l = (r.l + 1) & 0xff; if (!r.l) r.h = (r.h + 1) & 0xff; r.m = 2; },
  dec_hl: function(r){ r.l = (r.l - 1) & 0xff; if (r.l == 0xff) r.h = (r.h - 1) & 0xff; r.m = 2; },
  inc_sp: function(r){ r.sp = (r.sp + 1) & 0xffff; r.m = 2; },
  dec_sp: function(r){ r.sp = (r.sp - 1) & 0xffff; r.m = 2; },
  add_spn: function(r, m) {
    var i = m.rb(r.pc++);
    if (i > 127) i = ~i + 1;
    r.sp += i;
    r.m = 4;
  },

  ld_hlspn: function(r, m) {
    var i = m.rb(r.pc++);
    if (i > 127) i = ~i + 1;
    i += r.sp;
    r.h = (i >> 8) & 0xff;
    r.l = i & 0xff;
    r.m = 3;
  },

  // Rotating left
  rlca: function(r, m) {
    var ci = (r.a & 0x80) >> 7;
    r.a = ((r.a << 1) | ci) & 0xff;
    r.f = (r.a ? 0 : 128) | (ci << 4);
    r.m = 1;
  },
  rla: function(r, m) {
    var ci = (r.f & 0x10) >> 4;
    var co = (r.a & 0x80) >> 3;
    r.a = ((r.a << 1) | ci) & 0xff;
    r.f = (r.a ? 0 : 128) | co;
    r.m = 1;
  },
  rlc_b: function(r, m) {
    var ci = (r.b & 0x80) >> 7;
    r.b = ((r.b << 1) | ci) & 0xff;
    r.f = (r.b ? 0 : 128) | (ci << 4);
    r.m = 2;
  },
  rl_b: function(r, m) {
    var ci = (r.f & 0x10) >> 4;
    var co = (r.b & 0x80) >> 3;
    r.b = ((r.b << 1) | ci) & 0xff;
    r.f = (r.b ? 0 : 128) | co;
    r.m = 2;
  },
  rlc_c: function(r, m) {
    var ci = (r.c & 0x80) >> 7;
    r.c = ((r.c << 1) | ci) & 0xff;
    r.f = (r.c ? 0 : 128) | (ci << 4);
    r.m = 2;
  },
  rl_c: function(r, m) {
    var ci = (r.f & 0x10) >> 4;
    var co = (r.c & 0x80) >> 3;
    r.c = ((r.c << 1) | ci) & 0xff;
    r.f = (r.c ? 0 : 128) | co;
    r.m = 2;
  },
  rlc_d: function(r, m) {
    var ci = (r.d & 0x80) >> 7;
    r.d = ((r.d << 1) | ci) & 0xff;
    r.f = (r.d ? 0 : 128) | (ci << 4);
    r.m = 2;
  },
  rl_d: function(r, m) {
    var ci = (r.f & 0x10) >> 4;
    var co = (r.d & 0x80) >> 3;
    r.d = ((r.d << 1) | ci) & 0xff;
    r.f = (r.d ? 0 : 128) | co;
    r.m = 2;
  },
  rlc_e: function(r, m) {
    var ci = (r.e & 0x80) >> 7;
    r.e = ((r.e << 1) | ci) & 0xff;
    r.f = (r.e ? 0 : 128) | (ci << 4);
    r.m = 2;
  },
  rl_e: function(r, m) {
    var ci = (r.f & 0x10) >> 4;
    var co = (r.e & 0x80) >> 3;
    r.e = ((r.e << 1) | ci) & 0xff;
    r.f = (r.e ? 0 : 128) | co;
    r.m = 2;
  },
  rlc_h: function(r, m) {
    var ci = (r.h & 0x80) >> 7;
    r.h = ((r.h << 1) | ci) & 0xff;
    r.f = (r.h ? 0 : 128) | (ci << 4);
    r.m = 2;
  },
  rl_h: function(r, m) {
    var ci = (r.f & 0x10) >> 4;
    var co = (r.h & 0x80) >> 3;
    r.h = ((r.h << 1) | ci) & 0xff;
    r.f = (r.h ? 0 : 128) | co;
    r.m = 2;
  },
  rlc_l: function(r, m) {
    var ci = (r.l & 0x80) >> 7;
    r.l = ((r.l << 1) | ci) & 0xff;
    r.f = (r.l ? 0 : 128) | (ci << 4);
    r.m = 2;
  },
  rl_l: function(r, m) {
    var ci = (r.f & 0x10) >> 4;
    var co = (r.l & 0x80) >> 3;
    r.l = ((r.l << 1) | ci) & 0xff;
    r.f = (r.l ? 0 : 128) | co;
    r.m = 2;
  },
  rlc_a: function(r, m) {
    var ci = (r.a & 0x80) >> 7;
    r.a = ((r.a << 1) | ci) & 0xff;
    r.f = (r.a ? 0 : 128) | (ci << 4);
    r.m = 2;
  },
  rl_a: function(r, m) {
    var ci = (r.f & 0x10) >> 4;
    var co = (r.a & 0x80) >> 3;
    r.a = ((r.a << 1) | ci) & 0xff;
    r.f = (r.a ? 0 : 128) | co;
    r.m = 2;
  },
  rlc_hlm: function(r, m) {
    var hl = m.rb((r.h << 8) | r.l);
    var ci = (hl & 0x80) >> 7;
    hl = ((hl << 1) | ci) & 0xff;
    m.wb((r.h << 8) | r.l, hl);
    r.f = (hl ? 0 : 128) | (ci << 4);
    r.m = 4;
  },
  rl_hlm: function(r, m) {
    var hl = m.rb((r.h << 8) | r.l);
    var ci = (r.f & 0x10) >> 4;
    var co = (hl & 0x80) >> 3;
    hl = ((hl << 1) | ci) & 0xff;
    m.wb((r.h << 8) | r.l, hl);
    r.f = (hl ? 0 : 128) | co;
    r.m = 4;
  },

  // Rotating right
  rrca: function(r, m) {
    var ci = (r.a & 1) << 7;
    r.a = (r.a >> 1) | ci;
    r.f = (r.a ? 0 : 128) | (ci >> 3);
    r.m = 1;
  },
  rra: function(r, m) {
    var ci = (r.f & 0x10) << 3;
    var co = (r.a & 1) << 4;
    r.a = (r.a >> 1) | ci;
    r.f = (r.a ? 0 : 128) | co;
    r.m = 1;
  },
  rrc_b: function(r, m) {
    var ci = (r.b & 1) << 7;
    r.b = (r.b >> 1) | ci;
    r.f = (r.b ? 0 : 128) | (ci >> 3);
    r.m = 2;
  },
  rr_b: function(r, m) {
    var ci = (r.f & 0x10) << 3;
    var co = (r.b & 1) << 4;
    r.b = (r.b >> 1) | ci;
    r.f = (r.b ? 0 : 128) | co;
    r.m = 2;
  },
  rrc_c: function(r, m) {
    var ci = (r.c & 1) << 7;
    r.c = (r.c >> 1) | ci;
    r.f = (r.c ? 0 : 128) | (ci >> 3);
    r.m = 2;
  },
  rr_c: function(r, m) {
    var ci = (r.f & 0x10) << 3;
    var co = (r.c & 1) << 4;
    r.c = (r.c >> 1) | ci;
    r.f = (r.c ? 0 : 128) | co;
    r.m = 2;
  },
  rrc_d: function(r, m) {
    var ci = (r.d & 1) << 7;
    r.d = (r.d >> 1) | ci;
    r.f = (r.d ? 0 : 128) | (ci >> 3);
    r.m = 2;
  },
  rr_d: function(r, m) {
    var ci = (r.f & 0x10) << 3;
    var co = (r.d & 1) << 4;
    r.d = (r.d >> 1) | ci;
    r.f = (r.d ? 0 : 128) | co;
    r.m = 2;
  },
  rrc_e: function(r, m) {
    var ci = (r.e & 1) << 7;
    r.e = (r.e >> 1) | ci;
    r.f = (r.e ? 0 : 128) | (ci >> 3);
    r.m = 2;
  },
  rr_e: function(r, m) {
    var ci = (r.f & 0x10) << 3;
    var co = (r.e & 1) << 4;
    r.e = (r.e >> 1) | ci;
    r.f = (r.e ? 0 : 128) | co;
    r.m = 2;
  },
  rrc_h: function(r, m) {
    var ci = (r.h & 1) << 7;
    r.h = (r.h >> 1) | ci;
    r.f = (r.h ? 0 : 128) | (ci >> 3);
    r.m = 2;
  },
  rr_h: function(r, m) {
    var ci = (r.f & 0x10) << 3;
    var co = (r.h & 1) << 4;
    r.h = (r.h >> 1) | ci;
    r.f = (r.h ? 0 : 128) | co;
    r.m = 2;
  },
  rrc_l: function(r, m) {
    var ci = (r.l & 1) << 7;
    r.l = (r.l >> 1) | ci;
    r.f = (r.l ? 0 : 128) | (ci >> 3);
    r.m = 2;
  },
  rr_l: function(r, m) {
    var ci = (r.f & 0x10) << 3;
    var co = (r.l & 1) << 4;
    r.l = (r.l >> 1) | ci;
    r.f = (r.l ? 0 : 128) | co;
    r.m = 2;
  },
  rrc_a: function(r, m) {
    var ci = (r.a & 1) << 7;
    r.a = (r.a >> 1) | ci;
    r.f = (r.a ? 0 : 128) | (ci >> 3);
    r.m = 2;
  },
  rr_a: function(r, m) {
    var ci = (r.f & 0x10) << 3;
    var co = (r.a & 1) << 4;
    r.a = (r.a >> 1) | ci;
    r.f = (r.a ? 0 : 128) | co;
    r.m = 2;
  },
  rrc_hlm: function(r, m) {
    var hl = m.rb((r.h << 8) | r.l);
    var ci = (hl & 1) << 7;
    hl = (hl >> 1) | ci;
    m.wb((r.h << 8) | r.l, hl);
    r.f = (hl ? 0 : 128) | (ci >> 3);
    r.m = 4;
  },
  rr_hlm: function(r, m) {
    var hl = m.rb((r.h << 8) | r.l);
    var ci = (r.f & 0x10) << 3;
    var co = (hl & 0x80) << 4;
    hl = (hl >> 1) | ci;
    m.wb((r.h << 8) | r.l, hl);
    r.f = (hl ? 0 : 128) | co;
    r.m = 4;
  },

  // Shifting arithmetically left
  sla_b: function(r) {
    var co = (r.b & 0x80) >> 7;
    r.b = (r.b << 1) & 0xff;
    r.f = (r.b ? 0 : 128) | co;
    r.m = 2;
  },
  sla_c: function(r) {
    var co = (r.c & 0x80) >> 7;
    r.c = (r.c << 1) & 0xff;
    r.f = (r.c ? 0 : 128) | co;
    r.m = 2;
  },
  sla_d: function(r) {
    var co = (r.d & 0x80) >> 7;
    r.d = (r.d << 1) & 0xff;
    r.f = (r.d ? 0 : 128) | co;
    r.m = 2;
  },
  sla_e: function(r) {
    var co = (r.e & 0x80) >> 7;
    r.e = (r.e << 1) & 0xff;
    r.f = (r.e ? 0 : 128) | co;
    r.m = 2;
  },
  sla_h: function(r) {
    var co = (r.h & 0x80) >> 7;
    r.h = (r.h << 1) & 0xff;
    r.f = (r.h ? 0 : 128) | co;
    r.m = 2;
  },
  sla_l: function(r) {
    var co = (r.l & 0x80) >> 7;
    r.l = (r.l << 1) & 0xff;
    r.f = (r.l ? 0 : 128) | co;
    r.m = 2;
  },
  sla_a: function(r) {
    var co = (r.a & 0x80) >> 7;
    r.a = (r.a << 1) & 0xff;
    r.f = (r.a ? 0 : 128) | co;
    r.m = 2;
  },
  sla_hlm: function(r, m) {
    var hl = m.rb((r.h << 8) | r.l);
    var co = (hl & 0x80) >> 7;
    hl = (hl << 1) & 0xff;
    m.wb((r.h << 8) | r.l, hl);
    r.f = (hl ? 0 : 128) | co;
    r.m = 4;
  },

  // Swapping
  swap_b: function(r){
    var t = r.b; r.b = ((t & 0xf) << 4) | ((t & 0xf0) >> 4);
    r.f = t ? 0 : 128; r.m = 2;
  },
  swap_c: function(r){
    var t = r.c; r.c = ((t & 0xf) << 4) | ((t & 0xf0) >> 4);
    r.f = t ? 0 : 128; r.m = 2;
  },
  swap_d: function(r){
    var t = r.d; r.d = ((t & 0xf) << 4) | ((t & 0xf0) >> 4);
    r.f = t ? 0 : 128; r.m = 2;
  },
  swap_e: function(r){
    var t = r.e; r.e = ((t & 0xf) << 4) | ((t & 0xf0) >> 4);
    r.f = t ? 0 : 128; r.m = 2;
  },
  swap_h: function(r){
    var t = r.h; r.h = ((t & 0xf) << 4) | ((t & 0xf0) >> 4);
    r.f = t ? 0 : 128; r.m = 2;
  },
  swap_l: function(r){
    var t = r.l; r.l = ((t & 0xf) << 4) | ((t & 0xf0) >> 4);
    r.f = t ? 0 : 128; r.m = 2;
  },
  swap_a: function(r){
    var t = r.a; r.a = ((t & 0xf) << 4) | ((t & 0xf0) >> 4);
    r.f = t ? 0 : 128; r.m = 2;
  },
  swap_hlm: function(r, m){
    var t = m.rb((r.h << 8) | r.l); m.wb((r.h << 8) | r.l, ((t & 0xf) << 4) | ((t & 0xf0) >> 4));
    r.f = t ? 0 : 128; r.m = 4;
  },

  // Shifting arithmetically right
  sra_b: function(r) {
    var co = (r.b & 1) << 3;
    r.b = (r.b >> 1) | (r.b & 0x80);
    r.f = (r.b ? 0 : 128) | co;
    r.m = 2;
  },
  sra_c: function(r) {
    var co = (r.c & 1) << 3;
    r.c = (r.c >> 1) | (r.c & 0x80);
    r.f = (r.c ? 0 : 128) | co;
    r.m = 2;
  },
  sra_d: function(r) {
    var co = (r.d & 1) << 3;
    r.d = (r.d >> 1) | (r.d & 0x80);
    r.f = (r.d ? 0 : 128) | co;
    r.m = 2;
  },
  sra_e: function(r) {
    var co = (r.e & 1) << 3;
    r.e = (r.e >> 1) | (r.e & 0x80);
    r.f = (r.e ? 0 : 128) | co;
    r.m = 2;
  },
  sra_h: function(r) {
    var co = (r.h & 1) << 3;
    r.h = (r.h >> 1) | (r.h & 0x80);
    r.f = (r.h ? 0 : 128) | co;
    r.m = 2;
  },
  sra_l: function(r) {
    var co = (r.l & 1) << 3;
    r.l = (r.l >> 1) | (r.l & 0x80);
    r.f = (r.l ? 0 : 128) | co;
    r.m = 2;
  },
  sra_a: function(r) {
    var co = (r.a & 1) << 3;
    r.a = (r.a >> 1) | (r.a & 0x80);
    r.f = (r.a ? 0 : 128) | co;
    r.m = 2;
  },
  sra_hlm: function(r, m) {
    var hl = m.rb((r.h << 8) | r.l);
    var co = (hl & 1) << 3;
    hl = (hl >> 1) | (hl & 0x80);
    m.wb((r.h << 8) | r.l, hl);
    r.f = (hl ? 0 : 128) | co;
    r.m = 4;
  },

  // Shifting logically right
  srl_b: function(r) {
    var co = (r.b & 1) << 3;
    r.b >>= 1;
    r.f = (r.b ? 0 : 128) | co;
    r.m = 2;
  },
  srl_c: function(r) {
    var co = (r.c & 1) << 3;
    r.c >>= 1;
    r.f = (r.c ? 0 : 128) | co;
    r.m = 2;
  },
  srl_d: function(r) {
    var co = (r.d & 1) << 3;
    r.d >>= 1;
    r.f = (r.d ? 0 : 128) | co;
    r.m = 2;
  },
  srl_e: function(r) {
    var co = (r.e & 1) << 3;
    r.e >>= 1;
    r.f = (r.e ? 0 : 128) | co;
    r.m = 2;
  },
  srl_h: function(r) {
    var co = (r.h & 1) << 3;
    r.h >>= 1;
    r.f = (r.h ? 0 : 128) | co;
    r.m = 2;
  },
  srl_l: function(r) {
    var co = (r.l & 1) << 3;
    r.l >>= 1;
    r.f = (r.l ? 0 : 128) | co;
    r.m = 2;
  },
  srl_a: function(r) {
    var co = (r.a & 1) << 3;
    r.a >>= 1;
    r.f = (r.a ? 0 : 128) | co;
    r.m = 2;
  },
  srl_hlm: function(r, m) {
    var hl = m.rb((r.h << 8) | r.l);
    var co = (hl & 1) << 3;
    hl >>= 1;
    m.wb((r.h << 8) | r.l, hl);
    r.f = (hl ? 0 : 128) | co;
    r.m = 2;
  },

  // Bit checking
  bit_0b: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.b & 0x1) << 7); r.m = 2; },
  bit_0c: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.c & 0x1) << 7); r.m = 2; },
  bit_0d: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.d & 0x1) << 7); r.m = 2; },
  bit_0e: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.e & 0x1) << 7); r.m = 2; },
  bit_0h: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.h & 0x1) << 7); r.m = 2; },
  bit_0l: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.l & 0x1) << 7); r.m = 2; },
  bit_0a: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.a & 0x1) << 7); r.m = 2; },
  bit_0hlm: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((m.rb((r.h << 8) | r.l) & 0x1) << 7); r.m = 3; },

  bit_1b: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.b & 0x2) << 6); r.m = 2; },
  bit_1c: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.c & 0x2) << 6); r.m = 2; },
  bit_1d: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.d & 0x2) << 6); r.m = 2; },
  bit_1e: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.e & 0x2) << 6); r.m = 2; },
  bit_1h: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.h & 0x2) << 6); r.m = 2; },
  bit_1l: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.l & 0x2) << 6); r.m = 2; },
  bit_1a: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.a & 0x2) << 6); r.m = 2; },
  bit_1hlm: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((m.rb((r.h << 8) | r.l) & 0x2) << 6); r.m = 3; },

  bit_2b: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.b & 0x4) << 5); r.m = 2; },
  bit_2c: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.c & 0x4) << 5); r.m = 2; },
  bit_2d: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.d & 0x4) << 5); r.m = 2; },
  bit_2e: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.e & 0x4) << 5); r.m = 2; },
  bit_2h: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.h & 0x4) << 5); r.m = 2; },
  bit_2l: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.l & 0x4) << 5); r.m = 2; },
  bit_2a: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.a & 0x4) << 5); r.m = 2; },
  bit_2hlm: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((m.rb((r.h << 8) | r.l) & 0x4) << 5); r.m = 3; },

  bit_3b: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.b & 0x8) << 4); r.m = 2; },
  bit_3c: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.c & 0x8) << 4); r.m = 2; },
  bit_3d: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.d & 0x8) << 4); r.m = 2; },
  bit_3e: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.e & 0x8) << 4); r.m = 2; },
  bit_3h: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.h & 0x8) << 4); r.m = 2; },
  bit_3l: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.l & 0x8) << 4); r.m = 2; },
  bit_3a: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.a & 0x8) << 4); r.m = 2; },
  bit_3hlm: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((m.rb((r.h << 8) | r.l) & 0x8) << 4); r.m = 3; },

  bit_4b: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.b & 0x10) << 3); r.m = 2; },
  bit_4c: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.c & 0x10) << 3); r.m = 2; },
  bit_4d: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.d & 0x10) << 3); r.m = 2; },
  bit_4e: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.e & 0x10) << 3); r.m = 2; },
  bit_4h: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.h & 0x10) << 3); r.m = 2; },
  bit_4l: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.l & 0x10) << 3); r.m = 2; },
  bit_4a: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.a & 0x10) << 3); r.m = 2; },
  bit_4hlm: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((m.rb((r.h << 8) | r.l) & 0x10) << 3); r.m = 3; },

  bit_5b: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.b & 0x20) << 2); r.m = 2; },
  bit_5c: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.c & 0x20) << 2); r.m = 2; },
  bit_5d: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.d & 0x20) << 2); r.m = 2; },
  bit_5e: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.e & 0x20) << 2); r.m = 2; },
  bit_5h: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.h & 0x20) << 2); r.m = 2; },
  bit_5l: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.l & 0x20) << 2); r.m = 2; },
  bit_5a: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.a & 0x20) << 2); r.m = 2; },
  bit_5hlm: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((m.rb((r.h << 8) | r.l) & 0x20) << 2); r.m = 3; },

  bit_6b: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.b & 0x40) << 1); r.m = 2; },
  bit_6c: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.c & 0x40) << 1); r.m = 2; },
  bit_6d: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.d & 0x40) << 1); r.m = 2; },
  bit_6e: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.e & 0x40) << 1); r.m = 2; },
  bit_6h: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.h & 0x40) << 1); r.m = 2; },
  bit_6l: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.l & 0x40) << 1); r.m = 2; },
  bit_6a: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.a & 0x40) << 1); r.m = 2; },
  bit_6hlm: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((m.rb((r.h << 8) | r.l) & 0x40) << 1); r.m = 3; },

  bit_7b: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.b & 0x80)); r.m = 2; },
  bit_7c: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.c & 0x80)); r.m = 2; },
  bit_7d: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.d & 0x80)); r.m = 2; },
  bit_7e: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.e & 0x80)); r.m = 2; },
  bit_7h: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.h & 0x80)); r.m = 2; },
  bit_7l: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.l & 0x80)); r.m = 2; },
  bit_7a: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((r.a & 0x80)); r.m = 2; },
  bit_7hlm: function(r, m){ r.f = (r.f & 0x1f) | 32 | ((m.rb((r.h << 8) | r.l) & 0x80)); r.m = 3; },

  // Bit setting/resetting
  set_0b: function(r){ r.b |= 0x1; r.m = 2; },
  set_0c: function(r){ r.c |= 0x1; r.m = 2; },
  set_0d: function(r){ r.d |= 0x1; r.m = 2; },
  set_0e: function(r){ r.e |= 0x1; r.m = 2; },
  set_0h: function(r){ r.h |= 0x1; r.m = 2; },
  set_0l: function(r){ r.l |= 0x1; r.m = 2; },
  set_0a: function(r){ r.a |= 0x1; r.m = 2; },
  set_0hlm: function(r, m){ m.wb((r.h << 8) | r.l, m.rb((r.h << 8) | r.l) |  0x1); r.m = 4; },

  set_1b: function(r){ r.b |= 0x2; r.m = 2; },
  set_1c: function(r){ r.c |= 0x2; r.m = 2; },
  set_1d: function(r){ r.d |= 0x2; r.m = 2; },
  set_1e: function(r){ r.e |= 0x2; r.m = 2; },
  set_1h: function(r){ r.h |= 0x2; r.m = 2; },
  set_1l: function(r){ r.l |= 0x2; r.m = 2; },
  set_1a: function(r){ r.a |= 0x2; r.m = 2; },
  set_1hlm: function(r, m){ m.wb((r.h << 8) | r.l, m.rb((r.h << 8) | r.l) |  0x2); r.m = 4; },

  set_2b: function(r){ r.b |= 0x4; r.m = 2; },
  set_2c: function(r){ r.c |= 0x4; r.m = 2; },
  set_2d: function(r){ r.d |= 0x4; r.m = 2; },
  set_2e: function(r){ r.e |= 0x4; r.m = 2; },
  set_2h: function(r){ r.h |= 0x4; r.m = 2; },
  set_2l: function(r){ r.l |= 0x4; r.m = 2; },
  set_2a: function(r){ r.a |= 0x4; r.m = 2; },
  set_2hlm: function(r, m){ m.wb((r.h << 8) | r.l, m.rb((r.h << 8) | r.l) |  0x4); r.m = 4; },

  set_3b: function(r){ r.b |= 0x8; r.m = 2; },
  set_3c: function(r){ r.c |= 0x8; r.m = 2; },
  set_3d: function(r){ r.d |= 0x8; r.m = 2; },
  set_3e: function(r){ r.e |= 0x8; r.m = 2; },
  set_3h: function(r){ r.h |= 0x8; r.m = 2; },
  set_3l: function(r){ r.l |= 0x8; r.m = 2; },
  set_3a: function(r){ r.a |= 0x8; r.m = 2; },
  set_3hlm: function(r, m){ m.wb((r.h << 8) | r.l, m.rb((r.h << 8) | r.l) |  0x8); r.m = 4; },

  set_4b: function(r){ r.b |= 0x10; r.m = 2; },
  set_4c: function(r){ r.c |= 0x10; r.m = 2; },
  set_4d: function(r){ r.d |= 0x10; r.m = 2; },
  set_4e: function(r){ r.e |= 0x10; r.m = 2; },
  set_4h: function(r){ r.h |= 0x10; r.m = 2; },
  set_4l: function(r){ r.l |= 0x10; r.m = 2; },
  set_4a: function(r){ r.a |= 0x10; r.m = 2; },
  set_4hlm: function(r, m){ m.wb((r.h << 8) | r.l, m.rb((r.h << 8) | r.l) |  0x10); r.m = 4; },

  set_5b: function(r){ r.b |= 0x20; r.m = 2; },
  set_5c: function(r){ r.c |= 0x20; r.m = 2; },
  set_5d: function(r){ r.d |= 0x20; r.m = 2; },
  set_5e: function(r){ r.e |= 0x20; r.m = 2; },
  set_5h: function(r){ r.h |= 0x20; r.m = 2; },
  set_5l: function(r){ r.l |= 0x20; r.m = 2; },
  set_5a: function(r){ r.a |= 0x20; r.m = 2; },
  set_5hlm: function(r, m){ m.wb((r.h << 8) | r.l, m.rb((r.h << 8) | r.l) |  0x20); r.m = 4; },

  set_6b: function(r){ r.b |= 0x40; r.m = 2; },
  set_6c: function(r){ r.c |= 0x40; r.m = 2; },
  set_6d: function(r){ r.d |= 0x40; r.m = 2; },
  set_6e: function(r){ r.e |= 0x40; r.m = 2; },
  set_6h: function(r){ r.h |= 0x40; r.m = 2; },
  set_6l: function(r){ r.l |= 0x40; r.m = 2; },
  set_6a: function(r){ r.a |= 0x40; r.m = 2; },
  set_6hlm: function(r, m){ m.wb((r.h << 8) | r.l, m.rb((r.h << 8) | r.l) |  0x40); r.m = 4; },

  set_7b: function(r){ r.b |= 0x80; r.m = 2; },
  set_7c: function(r){ r.c |= 0x80; r.m = 2; },
  set_7d: function(r){ r.d |= 0x80; r.m = 2; },
  set_7e: function(r){ r.e |= 0x80; r.m = 2; },
  set_7h: function(r){ r.h |= 0x80; r.m = 2; },
  set_7l: function(r){ r.l |= 0x80; r.m = 2; },
  set_7a: function(r){ r.a |= 0x80; r.m = 2; },
  set_7hlm: function(r, m){ m.wb((r.h << 8) | r.l, m.rb((r.h << 8) | r.l) |  0x80); r.m = 4; },

  res_0b: function(r){ r.b &= 0xfe; r.m = 2; },
  res_0c: function(r){ r.c &= 0xfe; r.m = 2; },
  res_0d: function(r){ r.d &= 0xfe; r.m = 2; },
  res_0e: function(r){ r.e &= 0xfe; r.m = 2; },
  res_0h: function(r){ r.h &= 0xfe; r.m = 2; },
  res_0l: function(r){ r.l &= 0xfe; r.m = 2; },
  res_0a: function(r){ r.a &= 0xfe; r.m = 2; },
  res_0hlm: function(r, m){ m.wb((r.h << 8) | r.l, m.rb((r.h << 8) | r.l) & 0xfe); r.m = 4; },

  res_1b: function(r){ r.b &= 0xfd; r.m = 2; },
  res_1c: function(r){ r.c &= 0xfd; r.m = 2; },
  res_1d: function(r){ r.d &= 0xfd; r.m = 2; },
  res_1e: function(r){ r.e &= 0xfd; r.m = 2; },
  res_1h: function(r){ r.h &= 0xfd; r.m = 2; },
  res_1l: function(r){ r.l &= 0xfd; r.m = 2; },
  res_1a: function(r){ r.a &= 0xfd; r.m = 2; },
  res_1hlm: function(r, m){ m.wb((r.h << 8) | r.l, m.rb((r.h << 8) | r.l) & 0xfd); r.m = 4; },

  res_2b: function(r){ r.b &= 0xfb; r.m = 2; },
  res_2c: function(r){ r.c &= 0xfb; r.m = 2; },
  res_2d: function(r){ r.d &= 0xfb; r.m = 2; },
  res_2e: function(r){ r.e &= 0xfb; r.m = 2; },
  res_2h: function(r){ r.h &= 0xfb; r.m = 2; },
  res_2l: function(r){ r.l &= 0xfb; r.m = 2; },
  res_2a: function(r){ r.a &= 0xfb; r.m = 2; },
  res_2hlm: function(r, m){ m.wb((r.h << 8) | r.l, m.rb((r.h << 8) | r.l) & 0xfb); r.m = 4; },

  res_3b: function(r){ r.b &= 0xf7; r.m = 2; },
  res_3c: function(r){ r.c &= 0xf7; r.m = 2; },
  res_3d: function(r){ r.d &= 0xf7; r.m = 2; },
  res_3e: function(r){ r.e &= 0xf7; r.m = 2; },
  res_3h: function(r){ r.h &= 0xf7; r.m = 2; },
  res_3l: function(r){ r.l &= 0xf7; r.m = 2; },
  res_3a: function(r){ r.a &= 0xf7; r.m = 2; },
  res_3hlm: function(r, m){ m.wb((r.h << 8) | r.l, m.rb((r.h << 8) | r.l) & 0xf7); r.m = 4; },

  res_4b: function(r){ r.b &= 0xef; r.m = 2; },
  res_4c: function(r){ r.c &= 0xef; r.m = 2; },
  res_4d: function(r){ r.d &= 0xef; r.m = 2; },
  res_4e: function(r){ r.e &= 0xef; r.m = 2; },
  res_4h: function(r){ r.h &= 0xef; r.m = 2; },
  res_4l: function(r){ r.l &= 0xef; r.m = 2; },
  res_4a: function(r){ r.a &= 0xef; r.m = 2; },
  res_4hlm: function(r, m){ m.wb((r.h << 8) | r.l, m.rb((r.h << 8) | r.l) & 0xef); r.m = 4; },

  res_5b: function(r){ r.b &= 0xdf; r.m = 2; },
  res_5c: function(r){ r.c &= 0xdf; r.m = 2; },
  res_5d: function(r){ r.d &= 0xdf; r.m = 2; },
  res_5e: function(r){ r.e &= 0xdf; r.m = 2; },
  res_5h: function(r){ r.h &= 0xdf; r.m = 2; },
  res_5l: function(r){ r.l &= 0xdf; r.m = 2; },
  res_5a: function(r){ r.a &= 0xdf; r.m = 2; },
  res_5hlm: function(r, m){ m.wb((r.h << 8) | r.l, m.rb((r.h << 8) | r.l) & 0xdf); r.m = 4; },

  res_6b: function(r){ r.b &= 0xbf; r.m = 2; },
  res_6c: function(r){ r.c &= 0xbf; r.m = 2; },
  res_6d: function(r){ r.d &= 0xbf; r.m = 2; },
  res_6e: function(r){ r.e &= 0xbf; r.m = 2; },
  res_6h: function(r){ r.h &= 0xbf; r.m = 2; },
  res_6l: function(r){ r.l &= 0xbf; r.m = 2; },
  res_6a: function(r){ r.a &= 0xbf; r.m = 2; },
  res_6hlm: function(r, m){ m.wb((r.h << 8) | r.l, m.rb((r.h << 8) | r.l) & 0xbf); r.m = 4; },

  res_7b: function(r){ r.b &= 0x7f; r.m = 2; },
  res_7c: function(r){ r.c &= 0x7f; r.m = 2; },
  res_7d: function(r){ r.d &= 0x7f; r.m = 2; },
  res_7e: function(r){ r.e &= 0x7f; r.m = 2; },
  res_7h: function(r){ r.h &= 0x7f; r.m = 2; },
  res_7l: function(r){ r.l &= 0x7f; r.m = 2; },
  res_7a: function(r){ r.a &= 0x7f; r.m = 2; },
  res_7hlm: function(r, m){ m.wb((r.h << 8) | r.l, m.rb((r.h << 8) | r.l) & 0x7f); r.m = 4; },

  // CPU control commands
  ccf: function(r){ r.f = r.f & 0x8f & ((r.f & 16) ^ 16); r.m = 1; },
  scf: function(r){ r.f = (r.f & 0x8f) | 16; r.m = 1; },
  nop: function(r){ r.m = 1; },
  halt: function(r){ r.halt = 1; r.m = 1; },
  stop: function(r){ r.stop = 1; r.m = 1; },
  di: function(r){ r.ime = 0; r.m = 1; },
  ei: function(r){ r.ime = 1; r.m = 1; },

  // Jump commands
  jp_n: function(r, m){ r.pc = m.rw(r.pc); r.m = 4; },
  jp_hl: function(r, m){ r.pc = (r.h << 8) | r.l; r.m = 1; },
  jp_nz_n: function(r, m){ if (!(r.f & 128)) { r.pc = m.rw(r.pc); r.m = 4; } else { r.pc += 2; r.m = 3; } },
  jp_z_n: function(r, m){ if (r.f & 128) { r.pc = m.rw(r.pc); r.m = 4; } else { r.pc += 2; r.m = 3; } },
  jp_nc_n: function(r, m){ if (!(r.f & 16)) { r.pc = m.rw(r.pc); r.m = 4; } else { r.pc += 2; r.m = 3; } },
  jp_c_n: function(r, m){ if (r.f & 16) { r.pc = m.rw(r.pc); r.m = 4; } else { r.pc += 2; r.m = 3; } },

  jr_n: function(r, m){ var i = m.rb(r.pc++); if (i > 127) i = ~i + 1; r.pc += i; r.m = 3; },
  jr_nz_n: function(r, m){ if (!(r.f & 128)) { var i = m.rb(r.pc++); if (i > 127) i = ~i + 1; r.pc += i; r.m = 3; } else { r.pc++; r.m = 2; } },
  jr_z_n: function(r, m){ if (r.f & 128) { var i = m.rb(r.pc++); if (i > 127) i = ~i + 1; r.pc += i; r.m = 3; } else { r.pc++; r.m = 2; } },
  jr_nc_n: function(r, m){ if (!(r.f & 16)) { var i = m.rb(r.pc++); if (i > 127) i = ~i + 1; r.pc += i; r.m = 3; } else { r.pc++; r.m = 2; } },
  jr_c_n: function(r, m){ if (r.f & 16) { var i = m.rb(r.pc++); if (i > 127) i = ~i + 1; r.pc += i; r.m = 3; } else { r.pc++; r.m = 2; } },

  // Call/return commands
  call_n: function(r, m){ r.sp -= 2; m.ww(r.sp, r.pc + 2); r.pc = m.rw(r.pc); r.m = 6; },
  call_nz_n: function(r, m){ if (!(r.f & 128)) { r.sp -= 2; m.ww(r.sp, r.pc + 2); r.pc = m.rw(r.pc); r.m = 6; } else { r.m = 3; r.pc += 2; } },
  call_z_n: function(r, m){ if (r.f & 128) { r.sp -= 2; m.ww(r.sp, r.pc + 2); r.pc = m.rw(r.pc); r.m = 6; } else { r.m = 3; r.pc += 2; } },
  call_nc_n: function(r, m){ if (!(r.f & 16)) { r.sp -= 2; m.ww(r.sp, r.pc + 2); r.pc = m.rw(r.pc); r.m = 6; } else { r.m = 3; r.pc += 2; } },
  call_c_n: function(r, m){ if (r.f & 16) { r.sp -= 2; m.ww(r.sp, r.pc + 2); r.pc = m.rw(r.pc); r.m = 6; } else { r.m = 3; r.pc += 2; } },

  ret: function(r, m){ r.pc = m.rw(r.sp); r.sp += 2; r.m = 4; },
  ret_nz: function(r, m){ if (!(r.f & 128)) { r.pc = m.rw(r.sp); r.sp += 2; r.m = 5; } else { r.m = 2; } },
  ret_z: function(r, m){ if (r.f & 128) { r.pc = m.rw(r.sp); r.sp += 2; r.m = 5; } else { r.m = 2; } },
  ret_nc: function(r, m){ if (!(r.f & 16)) { r.pc = m.rw(r.sp); r.sp += 2; r.m = 5; } else { r.m = 2; } },
  ret_c: function(r, m){ if (r.f & 16) { r.pc = m.rw(r.sp); r.sp += 2; r.m = 5; } else { r.m = 2; } },

  reti: function(r, m){ r.ime = 1; r.restore(); r.pc = m.rw(r.sp); r.sp += 2; r.m = 4; },

  // Resetting
  rst_00: function(r, m){ r.save(); r.sp -= 2; m.ww(r.sp, r.pc); r.pc = 0x00; r.m = 4; },
  rst_08: function(r, m){ r.save(); r.sp -= 2; m.ww(r.sp, r.pc); r.pc = 0x08; r.m = 4; },
  rst_10: function(r, m){ r.save(); r.sp -= 2; m.ww(r.sp, r.pc); r.pc = 0x10; r.m = 4; },
  rst_18: function(r, m){ r.save(); r.sp -= 2; m.ww(r.sp, r.pc); r.pc = 0x18; r.m = 4; },
  rst_20: function(r, m){ r.save(); r.sp -= 2; m.ww(r.sp, r.pc); r.pc = 0x20; r.m = 4; },
  rst_28: function(r, m){ r.save(); r.sp -= 2; m.ww(r.sp, r.pc); r.pc = 0x28; r.m = 4; },
  rst_30: function(r, m){ r.save(); r.sp -= 2; m.ww(r.sp, r.pc); r.pc = 0x30; r.m = 4; },
  rst_38: function(r, m){ r.save(); r.sp -= 2; m.ww(r.sp, r.pc); r.pc = 0x38; r.m = 4; },
  rst_40: function(r, m){ r.save(); r.sp -= 2; m.ww(r.sp, r.pc); r.pc = 0x40; r.m = 4; },
  rst_48: function(r, m){ r.save(); r.sp -= 2; m.ww(r.sp, r.pc); r.pc = 0x48; r.m = 4; },
  rst_50: function(r, m){ r.save(); r.sp -= 2; m.ww(r.sp, r.pc); r.pc = 0x50; r.m = 4; },
  rst_58: function(r, m){ r.save(); r.sp -= 2; m.ww(r.sp, r.pc); r.pc = 0x58; r.m = 4; },
  rst_60: function(r, m){ r.save(); r.sp -= 2; m.ww(r.sp, r.pc); r.pc = 0x60; r.m = 4; }

};

Z80.map = [
  // 0x00
  Z80.ops.nop, Z80.ops.ld_bcn, Z80.ops.ld_bca, Z80.ops.inc_bc,
  Z80.ops.inc_b, Z80.ops.dec_b, Z80.ops.ld_bn, Z80.ops.rlca,
  Z80.ops.ld_nsp, Z80.ops.add_hlbc, Z80.ops.ld_abc, Z80.ops.dec_bc,
  Z80.ops.inc_c, Z80.ops.dec_c, Z80.ops.ld_cn, Z80.ops.rrca,
  // 0x10
  Z80.ops.stop, Z80.ops.ld_den, Z80.ops.ld_dea, Z80.ops.inc_de,
  Z80.ops.inc_d, Z80.ops.dec_d, Z80.ops.ld_dn, Z80.ops.rla,
  Z80.ops.jr_n, Z80.ops.add_hlde, Z80.ops.ld_ade, Z80.ops.dec_de,
  Z80.ops.inc_e, Z80.ops.dec_e, Z80.ops.ld_en, Z80.ops.rr_a,
  // 0x20
  Z80.ops.jr_nz_n, Z80.ops.ld_hln, Z80.ops.ld_hlma, Z80.ops.inc_hl,
  Z80.ops.inc_h, Z80.ops.dec_h, Z80.ops.ld_hn, Z80.ops.daa,
  Z80.ops.jr_z_n, Z80.ops.add_hlhl, Z80.ops.ldi_ahlm, Z80.ops.dec_hl,
  Z80.ops.inc_l, Z80.ops.dec_l, Z80.ops.ld_ln, Z80.ops.cpl,
  // 0x30
  Z80.ops.jr_nc_n, Z80.ops.ld_spn, Z80.ops.ldd_hlma, Z80.ops.inc_sp,
  Z80.ops.inc_hlm, Z80.ops.dec_hlm, Z80.ops.ld_hlmn, Z80.ops.scf,
  Z80.ops.jr_c_n, Z80.ops.add_hlsp, Z80.ops.ldd_ahlm, Z80.ops.dec_sp,
  Z80.ops.inc_a, Z80.ops.dec_a, Z80.ops.ld_an, Z80.ops.ccf,
  // 0x40
  Z80.ops.ld_bb, Z80.ops.ld_bc, Z80.ops.ld_bd, Z80.ops.ld_be,
  Z80.ops.ld_bh, Z80.ops.ld_bl, Z80.ops.ld_bhlm, Z80.ops.ld_ba,
  Z80.ops.ld_cb, Z80.ops.ld_cc, Z80.ops.ld_cd, Z80.ops.ld_ce,
  Z80.ops.ld_ch, Z80.ops.ld_cl, Z80.ops.ld_chlm, Z80.ops.ld_ca,
  // 0x50
  Z80.ops.ld_db, Z80.ops.ld_dc, Z80.ops.ld_dd, Z80.ops.ld_de,
  Z80.ops.ld_dh, Z80.ops.ld_dl, Z80.ops.ld_dhlm, Z80.ops.ld_da,
  Z80.ops.ld_eb, Z80.ops.ld_ec, Z80.ops.ld_ed, Z80.ops.ld_ee,
  Z80.ops.ld_eh, Z80.ops.ld_el, Z80.ops.ld_ehlm, Z80.ops.ld_ea,
  // 0x60
  Z80.ops.ld_hb, Z80.ops.ld_hc, Z80.ops.ld_hd, Z80.ops.ld_he,
  Z80.ops.ld_hh, Z80.ops.ld_hl, Z80.ops.ld_hhlm, Z80.ops.ld_ha,
  Z80.ops.ld_lb, Z80.ops.ld_lc, Z80.ops.ld_ld, Z80.ops.ld_le,
  Z80.ops.ld_lh, Z80.ops.ld_ll, Z80.ops.ld_lhlm, Z80.ops.ld_la,
  // 0x70
  Z80.ops.ld_hlmb, Z80.ops.ld_hlmc, Z80.ops.ld_hlmd, Z80.ops.ld_hlme,
  Z80.ops.ld_hlmh, Z80.ops.ld_hlml, Z80.ops.halt, Z80.ops.ld_hlma,
  Z80.ops.ld_ab, Z80.ops.ld_ac, Z80.ops.ld_ad, Z80.ops.ld_ae,
  Z80.ops.ld_ah, Z80.ops.ld_al, Z80.ops.ld_ahlm, Z80.ops.ld_aa,
  // 0x80
  Z80.ops.add_ab, Z80.ops.add_ac, Z80.ops.add_ad, Z80.ops.add_ae,
  Z80.ops.add_ah, Z80.ops.add_al, Z80.ops.add_ahlm, Z80.ops.add_aa,
  Z80.ops.adc_ab, Z80.ops.adc_ac, Z80.ops.adc_ad, Z80.ops.adc_ae,
  Z80.ops.adc_ah, Z80.ops.adc_al, Z80.ops.adc_ahlm, Z80.ops.adc_aa,
  // 0x90
  Z80.ops.sub_ab, Z80.ops.sub_ac, Z80.ops.sub_ad, Z80.ops.sub_ae,
  Z80.ops.sub_ah, Z80.ops.sub_al, Z80.ops.sub_ahlm, Z80.ops.sub_aa,
  Z80.ops.sbc_ab, Z80.ops.sbc_ac, Z80.ops.sbc_ad, Z80.ops.sbc_ae,
  Z80.ops.sbc_ah, Z80.ops.sbc_al, Z80.ops.sbc_ahlm, Z80.ops.sbc_aa,
  // 0xa0
  Z80.ops.and_ab, Z80.ops.and_ac, Z80.ops.and_ad, Z80.ops.and_ae,
  Z80.ops.and_ah, Z80.ops.and_al, Z80.ops.and_ahlm, Z80.ops.and_aa,
  Z80.ops.xor_ab, Z80.ops.xor_ac, Z80.ops.xor_ad, Z80.ops.xor_ae,
  Z80.ops.xor_ah, Z80.ops.xor_al, Z80.ops.xor_ahlm, Z80.ops.xor_aa,
  // 0xb0
  Z80.ops.or_ab, Z80.ops.or_ac, Z80.ops.or_ad, Z80.ops.or_ae,
  Z80.ops.or_ah, Z80.ops.or_al, Z80.ops.or_ahlm, Z80.ops.or_aa,
  Z80.ops.cp_ab, Z80.ops.cp_ac, Z80.ops.cp_ad, Z80.ops.cp_ae,
  Z80.ops.cp_ah, Z80.ops.cp_al, Z80.ops.cp_ahlm, Z80.ops.cp_aa,
  // 0xc0
  Z80.ops.ret_nz, Z80.ops.pop_bc, Z80.ops.jp_nz_n, Z80.ops.jp_n,
  Z80.ops.call_nz_n, Z80.ops.push_bc, Z80.ops.add_an, Z80.ops.rst_00,
  Z80.ops.ret_z, Z80.ops.ret, Z80.ops.jp_z_n, Z80.ops.map_cb,
  Z80.ops.call_z_n, Z80.ops.call_n, Z80.ops.adc_an, Z80.ops.rst_08,
  // 0xd0
  Z80.ops.ret_nc, Z80.ops.pop_de, Z80.ops.jp_nc_n, Z80.ops.xx,
  Z80.ops.call_nc_n, Z80.ops.push_de, Z80.ops.sub_an, Z80.ops.rst_10,
  Z80.ops.ret_c, Z80.ops.reti, Z80.ops.jp_c_n, Z80.ops.xx,
  Z80.ops.call_c_n, Z80.ops.xx, Z80.ops.sbc_an, Z80.ops.rst_18,
  // 0xe0
  Z80.ops.ld_IOna, Z80.ops.pop_hl, Z80.ops.ld_IOca, Z80.ops.xx,
  Z80.ops.xx, Z80.ops.push_hl, Z80.ops.and_an, Z80.ops.rst_20,
  Z80.ops.add_spn, Z80.ops.jp_hl, Z80.ops.ld_na, Z80.ops.xx,
  Z80.ops.xx, Z80.ops.xx, Z80.ops.xor_an, Z80.ops.rst_28,
  // 0xf0
  Z80.ops.ld_aIOn, Z80.ops.pop_af, Z80.ops.ld_aIOc, Z80.ops.di,
  Z80.ops.xx, Z80.ops.push_af, Z80.ops.or_an, Z80.ops.rst_30,
  Z80.ops.ld_hlspn, Z80.ops.ld_sphl, Z80.ops.ld_an, Z80.ops.ei,
  Z80.ops.xx, Z80.ops.xx, Z80.ops.cp_an, Z80.ops.rst_38
];

Z80.cbmap = [
  // 0x00
  Z80.ops.rlc_b, Z80.ops.rlc_c, Z80.ops.rlc_d, Z80.ops.rlc_e,
  Z80.ops.rlc_h, Z80.ops.rlc_l, Z80.ops.rlc_hlm, Z80.ops.rlc_a,
  Z80.ops.rrc_b, Z80.ops.rrc_c, Z80.ops.rrc_d, Z80.ops.rrc_e,
  Z80.ops.rrc_h, Z80.ops.rrc_l, Z80.ops.rrc_hlm, Z80.ops.rrc_a,
  // 0x10
  Z80.ops.rl_b, Z80.ops.rl_c, Z80.ops.rl_d, Z80.ops.rl_e,
  Z80.ops.rl_h, Z80.ops.rl_l, Z80.ops.rl_hlm, Z80.ops.rl_a,
  Z80.ops.rr_b, Z80.ops.rr_c, Z80.ops.rr_d, Z80.ops.rr_e,
  Z80.ops.rr_h, Z80.ops.rr_l, Z80.ops.rr_hlm, Z80.ops.rr_a,
  // 0x20
  Z80.ops.sla_b, Z80.ops.sla_c, Z80.ops.sla_d, Z80.ops.sla_e,
  Z80.ops.sla_h, Z80.ops.sla_l, Z80.ops.sla_hlm, Z80.ops.sla_a,
  Z80.ops.sra_b, Z80.ops.sra_c, Z80.ops.sra_d, Z80.ops.sra_e,
  Z80.ops.sra_h, Z80.ops.sra_l, Z80.ops.sra_hlm, Z80.ops.sra_a,
  // 0x30
  Z80.ops.swap_b, Z80.ops.swap_c, Z80.ops.swap_d, Z80.ops.swap_e,
  Z80.ops.swap_h, Z80.ops.swap_l, Z80.ops.swap_hlm, Z80.ops.swap_a,
  Z80.ops.srl_b, Z80.ops.srl_c, Z80.ops.srl_d, Z80.ops.srl_e,
  Z80.ops.srl_h, Z80.ops.srl_l, Z80.ops.srl_hlm, Z80.ops.srl_a,
  // 0x40
  Z80.ops.bit_0b, Z80.ops.bit_0c, Z80.ops.bit_0d, Z80.ops.bit_0e,
  Z80.ops.bit_0h, Z80.ops.bit_0l, Z80.ops.bit_0hlm, Z80.ops.bit_0a,
  Z80.ops.bit_1b, Z80.ops.bit_1c, Z80.ops.bit_1d, Z80.ops.bit_1e,
  Z80.ops.bit_1h, Z80.ops.bit_1l, Z80.ops.bit_1hlm, Z80.ops.bit_1a,
  // 0x50
  Z80.ops.bit_2b, Z80.ops.bit_2c, Z80.ops.bit_2d, Z80.ops.bit_2e,
  Z80.ops.bit_2h, Z80.ops.bit_2l, Z80.ops.bit_2hlm, Z80.ops.bit_2a,
  Z80.ops.bit_3b, Z80.ops.bit_3c, Z80.ops.bit_3d, Z80.ops.bit_3e,
  Z80.ops.bit_3h, Z80.ops.bit_3l, Z80.ops.bit_3hlm, Z80.ops.bit_3a,
  // 0x60
  Z80.ops.bit_4b, Z80.ops.bit_4c, Z80.ops.bit_4d, Z80.ops.bit_4e,
  Z80.ops.bit_4h, Z80.ops.bit_4l, Z80.ops.bit_4hlm, Z80.ops.bit_4a,
  Z80.ops.bit_5b, Z80.ops.bit_5c, Z80.ops.bit_5d, Z80.ops.bit_5e,
  Z80.ops.bit_5h, Z80.ops.bit_5l, Z80.ops.bit_5hlm, Z80.ops.bit_5a,
  // 0x70
  Z80.ops.bit_6b, Z80.ops.bit_6c, Z80.ops.bit_6d, Z80.ops.bit_6e,
  Z80.ops.bit_6h, Z80.ops.bit_6l, Z80.ops.bit_6hlm, Z80.ops.bit_6a,
  Z80.ops.bit_7b, Z80.ops.bit_7c, Z80.ops.bit_7d, Z80.ops.bit_7e,
  Z80.ops.bit_7h, Z80.ops.bit_7l, Z80.ops.bit_7hlm, Z80.ops.bit_7a,
  // 0x80
  Z80.ops.res_0b, Z80.ops.res_0c, Z80.ops.res_0d, Z80.ops.res_0e,
  Z80.ops.res_0h, Z80.ops.res_0l, Z80.ops.res_0hlm, Z80.ops.res_0a,
  Z80.ops.res_1b, Z80.ops.res_1c, Z80.ops.res_1d, Z80.ops.res_1e,
  Z80.ops.res_1h, Z80.ops.res_1l, Z80.ops.res_1hlm, Z80.ops.res_1a,
  // 0x90
  Z80.ops.res_2b, Z80.ops.res_2c, Z80.ops.res_2d, Z80.ops.res_2e,
  Z80.ops.res_2h, Z80.ops.res_2l, Z80.ops.res_2hlm, Z80.ops.res_2a,
  Z80.ops.res_3b, Z80.ops.res_3c, Z80.ops.res_3d, Z80.ops.res_3e,
  Z80.ops.res_3h, Z80.ops.res_3l, Z80.ops.res_3hlm, Z80.ops.res_3a,
  // 0xa0
  Z80.ops.res_4b, Z80.ops.res_4c, Z80.ops.res_4d, Z80.ops.res_4e,
  Z80.ops.res_4h, Z80.ops.res_4l, Z80.ops.res_4hlm, Z80.ops.res_4a,
  Z80.ops.res_5b, Z80.ops.res_5c, Z80.ops.res_5d, Z80.ops.res_5e,
  Z80.ops.res_5h, Z80.ops.res_5l, Z80.ops.res_5hlm, Z80.ops.res_5a,
  // 0xb0
  Z80.ops.res_6b, Z80.ops.res_6c, Z80.ops.res_6d, Z80.ops.res_6e,
  Z80.ops.res_6h, Z80.ops.res_6l, Z80.ops.res_6hlm, Z80.ops.res_6a,
  Z80.ops.res_7b, Z80.ops.res_7c, Z80.ops.res_7d, Z80.ops.res_7e,
  Z80.ops.res_7h, Z80.ops.res_7l, Z80.ops.res_7hlm, Z80.ops.res_7a,
  // 0xc0
  Z80.ops.set_0b, Z80.ops.set_0c, Z80.ops.set_0d, Z80.ops.set_0e,
  Z80.ops.set_0h, Z80.ops.set_0l, Z80.ops.set_0hlm, Z80.ops.set_0a,
  Z80.ops.set_1b, Z80.ops.set_1c, Z80.ops.set_1d, Z80.ops.set_1e,
  Z80.ops.set_1h, Z80.ops.set_1l, Z80.ops.set_1hlm, Z80.ops.set_1a,
  // 0xd0
  Z80.ops.set_2b, Z80.ops.set_2c, Z80.ops.set_2d, Z80.ops.set_2e,
  Z80.ops.set_2h, Z80.ops.set_2l, Z80.ops.set_2hlm, Z80.ops.set_2a,
  Z80.ops.set_3b, Z80.ops.set_3c, Z80.ops.set_3d, Z80.ops.set_3e,
  Z80.ops.set_3h, Z80.ops.set_3l, Z80.ops.set_3hlm, Z80.ops.set_3a,
  // 0xe0
  Z80.ops.set_4b, Z80.ops.set_4c, Z80.ops.set_4d, Z80.ops.set_4e,
  Z80.ops.set_4h, Z80.ops.set_4l, Z80.ops.set_4hlm, Z80.ops.set_4a,
  Z80.ops.set_5b, Z80.ops.set_5c, Z80.ops.set_5d, Z80.ops.set_5e,
  Z80.ops.set_5h, Z80.ops.set_5l, Z80.ops.set_5hlm, Z80.ops.set_5a,
  // 0xf0
  Z80.ops.set_6b, Z80.ops.set_6c, Z80.ops.set_6d, Z80.ops.set_6e,
  Z80.ops.set_6h, Z80.ops.set_6l, Z80.ops.set_6hlm, Z80.ops.set_6a,
  Z80.ops.set_7b, Z80.ops.set_7c, Z80.ops.set_7d, Z80.ops.set_7e,
  Z80.ops.set_7h, Z80.ops.set_7l, Z80.ops.set_7hlm, Z80.ops.set_7a
];
