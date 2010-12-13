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
