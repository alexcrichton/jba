#![allow(unnecessary_parens)]

use cpu::z80;
use mem;

pub static Z: u8 = 0x80;
pub static N: u8 = 0x40;
pub static H: u8 = 0x20;
pub static C: u8 = 0x10;

fn add(a: u16, b: u8) -> u16 {
    (a as i16 + (b as i8 as i16)) as u16
}

fn daa(r: &mut z80::Registers) {
    // Just in case the table needs to be recomputed
    //
    //if r.f & N == 0 {
    //    if r.f & C != 0 || r.a > 0x99 {
    //        r.a += 0x60;
    //        r.f |= C;
    //    }
    //    if r.f & H != 0 || (r.a & 0xf) > 0x9 {
    //        r.a += 0x06;
    //        r.f &= !H;
    //    }
    //} else if r.f & C != 0 && r.f & H != 0 {
    //    r.a += 0x9a;
    //    r.f &= !H;
    //} else if r.f & C != 0 {
    //    r.a += 0xa0;
    //} else if r.f & H != 0 {
    //    r.a += 0xfa;
    //    r.f &= !H;
    //}
    //if r.a == 0 {
    //    r.f |= Z;
    //} else {
    //    r.f &= !Z;
    //}

    let idx = (r.a as u16) | (((r.f & (N | H | C)) as u16) << 4);
    let d = z80::DAA_TABLE[idx as uint];
    r.a = (d >> 8) as u8;
    r.f = d as u8;
}

fn inc_hlm(r: &mut z80::Registers, m: &mut mem::Memory) {
    let hl = r.hl();
    let k = m.rb(hl) + 1;
    m.wb(hl, k);
    r.f = (r.f & C) | if k != 0 {0} else {Z} | if k & 0xf == 0 {H} else {0};
}

fn dec_hlm(r: &mut z80::Registers, m: &mut mem::Memory) {
    let hl = r.hl();
    let k = m.rb(hl) - 1;
    m.wb(hl, k);
    r.f = N | (r.f & C) |
          if k != 0 {0} else {Z} |
          if k & 0xf == 0xf {H} else {0};
}

fn ld_hlspn(r: &mut z80::Registers, m: &mut mem::Memory) {
    // I literally have no clue what's going on here
    let b = m.rb(r.bump()) as i8 as i16 as u16;
    let res = b + r.sp;
    r.h = (res >> 8) as u8;
    r.l = res as u8;
    let tmp = b ^ r.sp ^ r.hl();
    r.f = if tmp & 0x100 != 0 {C} else {0} |
          if tmp & 0x010 != 0 {H} else {0};
}

fn ld_IOan(r: &mut z80::Registers, m: &mut mem::Memory) {
    let n = m.rb(r.bump());
    m.wb(0xff00 | (n as u16), r.a);
}

fn add_spn(r: &mut z80::Registers, m: &mut mem::Memory) {
    // I literally have no clue what's going on here
    let b = m.rb(r.bump()) as i8 as i16 as u16;
    let res = r.sp + b;
    let tmp = b ^ res ^ r.sp;
    r.f = if tmp & 0x100 != 0 {C} else {0} |
          if tmp & 0x010 != 0 {H} else {0};
    r.sp = res;
}

fn add_hlsp(r: &mut z80::Registers) {
    let s = r.hl() as uint + r.sp as uint;
    r.f = if r.hl() as uint & 0xfff > s & 0xfff {H} else {0} |
          if s > 0xffff {C} else {0} | (r.f & Z);
    r.h = (s >> 8) as u8;
    r.l = s as u8;
}

fn pop_af(r: &mut z80::Registers, m: &mut mem::Memory) {
    r.f = m.rb(r.sp) & 0xf0;
    r.a = m.rb(r.sp + 1);
    r.sp += 2;
}

fn xx() -> uint { dfail!(); 0 }

pub fn exec(inst: u8, r: &mut z80::Registers, m: &mut mem::Memory) -> uint {
    macro_rules! ld( ($reg1:ident, $reg2:ident) => ({ r.$reg1 = r.$reg2; 1 }) )
    macro_rules! ld_n( ($reg:ident) => ({ r.$reg = m.rb(r.bump()); 2 }) )
    macro_rules! ld_nn( ($reg1:ident, $reg2: ident) => ({
        r.$reg2 = m.rb(r.bump());
        r.$reg1 = m.rb(r.bump());
        3
    }) )
    macro_rules! ld_Xhlm( ($reg:ident) => ({ r.$reg = m.rb(r.hl()); 2 }) )
    macro_rules! ld_hlmX( ($reg:ident) => ({ m.wb(r.hl(), r.$reg); 2 }) )
    macro_rules! dec_16( ($reg1:ident, $reg2: ident) => ({
        r.$reg2 -= 1;
        if r.$reg2 == 0xff { r.$reg1 -= 1; }
        2
    }) )
    macro_rules! inc_16( ($reg1:ident, $reg2: ident) => ({
        r.$reg2 += 1;
        if r.$reg2 == 0 { r.$reg1 += 1; }
        2
    }) )
    macro_rules! inc( ($reg:ident) => ({
        r.$reg += 1;
        r.f = (r.f & C) |
              if r.$reg == 0 {Z} else {0} |
              if r.$reg & 0xf == 0 {H} else {0};
        1
    }) )
    macro_rules! dec( ($reg:ident) => ({
        r.$reg -= 1;
        r.f &= 0x1f;
        r.f |= N | (if r.$reg == 0 {Z} else {0})
                 | (((r.$reg & 0xf) == 0xf) as u8 << 5);
        1
    }) )
    macro_rules! add_hl( ($reg:expr) => ({
        let a = r.hl() as u32;
        let b = $reg as u32;
        let hl = a + b;
        r.f = (r.f & Z) |
              if hl > 0xffff {C} else {0} |
              if (a as u32 & 0xfff) > (hl & 0xfff) {H} else {0};
        r.l = hl as u8;
        r.h = (hl >> 8) as u8;
        2
    }) )
    macro_rules! jr( () => ({
        let val = m.rb(r.bump());
        r.pc = add(r.pc, val);
        3
    }) )
    macro_rules! jr_n( ($e:expr) => (
        if $e {jr!()} else {r.bump(); 2}
    ) )
    macro_rules! jp( () => ({ r.pc = m.rw(r.pc); 4 }) )
    macro_rules! jp_n( ($e:expr) => (
        if $e {jp!()} else {r.pc += 2; 3}
    ) )
    macro_rules! call( () => ({
        r.sp -= 2;
        m.ww(r.sp, r.pc + 2);
        r.pc = m.rw(r.pc);
        6
    }) )
    macro_rules! call_if( ($e:expr) => ({
        if $e {call!()} else { r.pc += 2; 3 }
    }) )
    macro_rules! add_a( ($r:expr) => ({
        let i = r.a;
        let j = $r;
        r.f = if (i & 0xf) + (j & 0xf) > 0xf {H} else {0};
        r.f |= if (i as u16 + j as u16) > 0xff {C} else {0};
        r.a = i + j;
        r.f |= if r.a != 0 {0} else {Z};
        1
    }) )
    macro_rules! adc_a( ($r:expr) => ({
        let i = r.a;
        let j = $r;
        let k = if r.f & C != 0 {1} else {0};
        r.f = if (i & 0xf) + (j & 0xf) + k > 0xf {H} else {0};
        r.f |= if (i as u16 + j as u16 + k as u16) > 0xff {C} else {0};
        r.a = i + j + k;
        r.f |= if r.a != 0 {0} else {Z};
        1
    }) )
    macro_rules! sub_a( ($r:expr) => ({
        let a = r.a;
        let b = $r;
        r.f = N | if a < b {C} else {0} | if (a & 0xf) < (b & 0xf) {H} else {0};
        r.a = a - b;
        r.f |= if r.a != 0 {0} else {Z};
        1
    }) )
    macro_rules! sbc_a( ($r:expr) => ({
        let a = r.a as u16;
        let b = $r as u16;
        let c = if r.f & C != 0 {1} else {0};
        r.f = N |
              if a < b + c {C} else {0} |
              if (a & 0xf) < (b & 0xf) + c {H} else {0};
        r.a = (a - b - c) as u8;
        r.f |= if r.a != 0 {0} else {Z};
        1
    }) )
    macro_rules! and_a( ($r:expr) => ({
        r.a &= $r;
        r.f = H | if r.a != 0 {0} else {Z};
        1
    }) )
    macro_rules! xor_a( ($r:expr) => ({
        r.a ^= $r;
        r.f = if r.a != 0 {0} else {Z};
        1
    }) )
    macro_rules! or_a( ($r:expr) => ({
        r.a |= $r;
        r.f = if r.a != 0 {0} else {Z};
        1
    }) )
    macro_rules! cp_a( ($b:expr) => ({
        let b = $b;
        r.f = N | if r.a == b {Z} else {0} |
                  if r.a < b {C} else {0} |
                  if (r.a & 0xf) < (b & 0xf) {H} else {0};
        1
    }) )
    macro_rules! ret_if( ($e:expr) => ({ if $e { r.ret(m); 5 } else { 2 } }) )
    macro_rules! pop( ($reg1:ident, $reg2:ident) => ({
        r.$reg2 = m.rb(r.sp);
        r.$reg1 = m.rb(r.sp + 1);
        r.sp += 2; 3
    }) )
    macro_rules! push( ($reg1:ident, $reg2:ident) => ({
        m.wb(r.sp - 1, r.$reg1);
        m.wb(r.sp - 2, r.$reg2);
        r.sp -= 2; 4
    }) )
    macro_rules! rst( ($e:expr) => ({ r.rst($e, m); 4 }) )

    macro_rules! rl( ($reg:expr, $cy:expr) => ({
        let ci = if (r.f & C) != 0 {1} else {0};
        let co = $reg & 0x80;
        $reg = ($reg << 1) | ci;
        r.f = if co != 0 {C} else {0};
        $cy
    }) )

    macro_rules! rlc( ($reg:expr, $cy:expr) => ({
        let ci = if ($reg & 0x80) != 0 {1} else {0};
        $reg = ($reg << 1) | ci;
        r.f = if ci != 0 {C} else {0};
        $cy
    }) )

    macro_rules! rr( ($reg:expr, $cy:expr) => ({
        let ci = if (r.f & C) != 0 {0x80} else {0};
        let co = if ($reg & 0x01) != 0 {C} else {0};
        $reg = ($reg >> 1) | ci;
        r.f = co;
        $cy
    }) )

    macro_rules! rrc( ($reg:expr, $cy:expr) => ({
        let ci = $reg & 0x01;
        $reg = ($reg >> 1) | (ci << 7);
        r.f = if ci != 0 {C} else {0};
        $cy
    }) )

    debug!("executing {} at {}", inst, *r);

    match inst {
        0x00 => 1,                                                  // nop
        0x01 => ld_nn!(b, c),                                       // ld_bcnn
        0x02 => { m.wb(r.bc(), r.a); 2 }                            // ld_bca
        0x03 => inc_16!(b, c),                                      // inc_bc
        0x04 => inc!(b),                                            // inc_b
        0x05 => dec!(b),                                            // dec_b
        0x06 => ld_n!(b),                                           // ld_bn
        0x07 => rlc!(r.a, 1),                                       // rlca
        0x08 => { let a = m.rw(r.pc); m.ww(a, r.sp); r.pc += 2; 5 } // ld_nnsp
        0x09 => add_hl!(r.bc()),                                    // add_hlbc
        0x0a => { r.a = m.rb(r.bc()); 2 }                           // ld_abc
        0x0b => dec_16!(b, c),                                      // dec_bc
        0x0c => inc!(c),                                            // inc_c
        0x0d => dec!(c),                                            // dec_c
        0x0e => ld_n!(c),                                           // ld_cn
        0x0f => rrc!(r.a, 1),                                       // rrca

        0x10 => { r.stop = 1; 1 }                                   // stop
        0x11 => ld_nn!(d, e),                                       // ld_denn
        0x12 => { m.wb(r.de(), r.a); 2 }                            // ld_dea
        0x13 => inc_16!(d, e),                                      // inc_de
        0x14 => inc!(d),                                            // inc_d
        0x15 => dec!(d),                                            // dec_d
        0x16 => ld_n!(d),                                           // ld_dn
        0x17 => rl!(r.a, 1),                                        // rla
        0x18 => jr!(),                                              // jr_n
        0x19 => add_hl!(r.de()),                                    // add_hlde
        0x1a => { r.a = m.rb(r.de()); 2 }                           // ld_ade
        0x1b => dec_16!(d, e),                                      // dec_de
        0x1c => inc!(e),                                            // inc_e
        0x1d => dec!(e),                                            // dec_e
        0x1e => ld_n!(e),                                           // ld_en
        0x1f => rr!(r.a, 1),                                        // rr_a

        0x20 => jr_n!((r.f & Z) == 0),                              // jr_nz_n
        0x21 => ld_nn!(h, l),                                       // ld_hlnn
        0x22 => { m.wb(r.hl(), r.a); r.hlpp(); 2 },                 // ld_hlma
        0x23 => inc_16!(h, l),                                      // inc_hl
        0x24 => inc!(h),                                            // inc_h
        0x25 => dec!(h),                                            // dec_h
        0x26 => ld_n!(h),                                           // ld_hn
        0x27 => { daa(r); 1 },                                      // daa
        0x28 => jr_n!((r.f & Z) != 0),                              // jr_z_n
        0x29 => add_hl!(r.hl()),                                    // add_hlhl
        0x2a => { r.a = m.rb(r.hl()); r.hlpp(); 2 },                // ldi_ahlm
        0x2b => dec_16!(h, l),                                      // dec_hl
        0x2c => inc!(l),                                            // inc_l
        0x2d => dec!(l),                                            // dec_l
        0x2e => ld_n!(l),                                           // ld_ln
        0x2f => { r.a ^= 0xff; r.f |= N | H; 1 }                    // cpl

        0x30 => jr_n!((r.f & C) == 0),                              // jr_nc_n
        0x31 => { r.sp = m.rw(r.pc); r.pc += 2; 3 }                 // ld_spnn
        0x32 => { m.wb(r.hl(), r.a); r.hlmm(); 2 }                  // ldd_hlma
        0x33 => { r.sp += 1; 2 }                                    // inc_sp
        0x34 => { inc_hlm(r, m); 3 }                                // inc_hlm
        0x35 => { dec_hlm(r, m); 3 }                                // dec_hlm
        0x36 => { let pc = m.rb(r.bump()); m.wb(r.hl(), pc); 3 }    // ld_hlmn
        0x37 => { r.f = (r.f & Z) | C; 1 }                          // scf
        0x38 => jr_n!((r.f & C) != 0),                              // jr_c_n
        0x39 => { add_hlsp(r); 2 }                                  // add_hlsp
        0x3a => { r.a = m.rb(r.hl()); r.hlmm(); 2 }                 // ldd_ahlm
        0x3b => { r.sp -= 1; 2 }                                    // dec_sp
        0x3c => inc!(a),                                            // inc_a
        0x3d => dec!(a),                                            // dec_a
        0x3e => ld_n!(a),                                           // ld_an
        0x3f => { r.f = (r.f & Z) | ((r.f & C) ^ C); 1 }            // ccf

        0x40 => ld!(b, b),                                          // ld_bb
        0x41 => ld!(b, c),                                          // ld_bc
        0x42 => ld!(b, d),                                          // ld_bd
        0x43 => ld!(b, e),                                          // ld_be
        0x44 => ld!(b, h),                                          // ld_bh
        0x45 => ld!(b, l),                                          // ld_bl
        0x46 => { r.b = m.rb(r.hl()); 2 }                           // ld_bhlm
        0x47 => ld!(b, a),                                          // ld_ba
        0x48 => ld!(c, b),                                          // ld_cb
        0x49 => ld!(c, c),                                          // ld_cc
        0x4a => ld!(c, d),                                          // ld_cd
        0x4b => ld!(c, e),                                          // ld_ce
        0x4c => ld!(c, h),                                          // ld_ch
        0x4d => ld!(c, l),                                          // ld_cl
        0x4e => { r.c = m.rb(r.hl()); 2 }                           // ld_chlm
        0x4f => ld!(c, a),                                          // ld_ca

        0x50 => ld!(d, b),                                          // ld_db
        0x51 => ld!(d, c),                                          // ld_dc
        0x52 => ld!(d, d),                                          // ld_dd
        0x53 => ld!(d, e),                                          // ld_de
        0x54 => ld!(d, h),                                          // ld_dh
        0x55 => ld!(d, l),                                          // ld_dl
        0x56 => { r.d = m.rb(r.hl()); 2 }                           // ld_dhlm
        0x57 => ld!(d, a),                                          // ld_da
        0x58 => ld!(e, b),                                          // ld_eb
        0x59 => ld!(e, c),                                          // ld_ec
        0x5a => ld!(e, d),                                          // ld_ed
        0x5b => ld!(e, e),                                          // ld_ee
        0x5c => ld!(e, h),                                          // ld_eh
        0x5d => ld!(e, l),                                          // ld_el
        0x5e => { r.e = m.rb(r.hl()); 2 }                           // ld_ehlm
        0x5f => ld!(e, a),                                          // ld_ea

        0x60 => ld!(h, b),                                          // ld_hb
        0x61 => ld!(h, c),                                          // ld_hc
        0x62 => ld!(h, d),                                          // ld_hd
        0x63 => ld!(h, e),                                          // ld_he
        0x64 => ld!(h, h),                                          // ld_hh
        0x65 => ld!(h, l),                                          // ld_hl
        0x66 => { r.h = m.rb(r.hl()); 2 }                           // ld_hhlm
        0x67 => ld!(h, a),                                          // ld_ha
        0x68 => ld!(l, b),                                          // ld_lb
        0x69 => ld!(l, c),                                          // ld_lc
        0x6a => ld!(l, d),                                          // ld_ld
        0x6b => ld!(l, e),                                          // ld_le
        0x6c => ld!(l, h),                                          // ld_lh
        0x6d => ld!(l, l),                                          // ld_ll
        0x6e => { r.l = m.rb(r.hl()); 2 }                           // ld_lhlm
        0x6f => ld!(l, a),                                          // ld_la

        0x70 => { m.wb(r.hl(), r.b); 2 }                            // ld_hlmb
        0x71 => { m.wb(r.hl(), r.c); 2 }                            // ld_hlmc
        0x72 => { m.wb(r.hl(), r.d); 2 }                            // ld_hlmd
        0x73 => { m.wb(r.hl(), r.e); 2 }                            // ld_hlme
        0x74 => { m.wb(r.hl(), r.h); 2 }                            // ld_hlmh
        0x75 => { m.wb(r.hl(), r.l); 2 }                            // ld_hlml
        0x76 => { r.halt = 1; 1 }                                   // halt
        0x77 => { m.wb(r.hl(), r.a); 2 }                            // ld_hlma
        0x78 => ld!(a, b),                                          // ld_ab
        0x79 => ld!(a, c),                                          // ld_ac
        0x7a => ld!(a, d),                                          // ld_ad
        0x7b => ld!(a, e),                                          // ld_ae
        0x7c => ld!(a, h),                                          // ld_ah
        0x7d => ld!(a, l),                                          // ld_al
        0x7e => { r.a = m.rb(r.hl()); 2 }                           // ld_ahlm
        0x7f => ld!(a, a),                                          // ld_aa

        0x80 => add_a!(r.b),                                        // add_ab
        0x81 => add_a!(r.c),                                        // add_ac
        0x82 => add_a!(r.d),                                        // add_ad
        0x83 => add_a!(r.e),                                        // add_ae
        0x84 => add_a!(r.h),                                        // add_ah
        0x85 => add_a!(r.l),                                        // add_al
        0x86 => { add_a!(m.rb(r.hl())); 2 }                         // add_ahlm
        0x87 => add_a!(r.a),                                        // add_aa
        0x88 => adc_a!(r.b),                                        // adc_ab
        0x89 => adc_a!(r.c),                                        // adc_ac
        0x8a => adc_a!(r.d),                                        // adc_ad
        0x8b => adc_a!(r.e),                                        // adc_ae
        0x8c => adc_a!(r.h),                                        // adc_ah
        0x8d => adc_a!(r.l),                                        // adc_al
        0x8e => { adc_a!(m.rb(r.hl())); 2 }                         // adc_ahlm
        0x8f => adc_a!(r.a),                                        // adc_aa

        0x90 => sub_a!(r.b),                                        // sub_ab
        0x91 => sub_a!(r.c),                                        // sub_ac
        0x92 => sub_a!(r.d),                                        // sub_ad
        0x93 => sub_a!(r.e),                                        // sub_ae
        0x94 => sub_a!(r.h),                                        // sub_ah
        0x95 => sub_a!(r.l),                                        // sub_al
        0x96 => { sub_a!(m.rb(r.hl())); 2 }                         // sub_ahlm
        0x97 => sub_a!(r.a),                                        // sub_aa
        0x98 => sbc_a!(r.b),                                        // sbc_ab
        0x99 => sbc_a!(r.c),                                        // sbc_ac
        0x9a => sbc_a!(r.d),                                        // sbc_ad
        0x9b => sbc_a!(r.e),                                        // sbc_ae
        0x9c => sbc_a!(r.h),                                        // sbc_ah
        0x9d => sbc_a!(r.l),                                        // sbc_al
        0x9e => { sbc_a!(m.rb(r.hl())); 2 }                         // sbc_ahlm
        0x9f => sbc_a!(r.a),                                        // sbc_aa

        0xa0 => and_a!(r.b),                                        // and_ab
        0xa1 => and_a!(r.c),                                        // and_ac
        0xa2 => and_a!(r.d),                                        // and_ad
        0xa3 => and_a!(r.e),                                        // and_ae
        0xa4 => and_a!(r.h),                                        // and_ah
        0xa5 => and_a!(r.l),                                        // and_al
        0xa6 => { and_a!(m.rb(r.hl())); 2 }                         // and_ahlm
        0xa7 => and_a!(r.a),                                        // and_aa
        0xa8 => xor_a!(r.b),                                        // xor_ab
        0xa9 => xor_a!(r.c),                                        // xor_ac
        0xaa => xor_a!(r.d),                                        // xor_ad
        0xab => xor_a!(r.e),                                        // xor_ae
        0xac => xor_a!(r.h),                                        // xor_ah
        0xad => xor_a!(r.l),                                        // xor_al
        0xae => { xor_a!(m.rb(r.hl())); 2 }                         // xor_ahlm
        0xaf => xor_a!(r.a),                                        // xor_aa

        0xb0 => or_a!(r.b),                                         // or_ab
        0xb1 => or_a!(r.c),                                         // or_ac
        0xb2 => or_a!(r.d),                                         // or_ad
        0xb3 => or_a!(r.e),                                         // or_ae
        0xb4 => or_a!(r.h),                                         // or_ah
        0xb5 => or_a!(r.l),                                         // or_al
        0xb6 => { or_a!(m.rb(r.hl())); 2 }                          // or_ahlm
        0xb7 => or_a!(r.a),                                         // or_aa
        0xb8 => cp_a!(r.b),                                         // cp_ab
        0xb9 => cp_a!(r.c),                                         // cp_ac
        0xba => cp_a!(r.d),                                         // cp_ad
        0xbb => cp_a!(r.e),                                         // cp_ae
        0xbc => cp_a!(r.h),                                         // cp_ah
        0xbd => cp_a!(r.l),                                         // cp_al
        0xbe => { cp_a!(m.rb(r.hl())); 2 }                          // cp_ahlm
        0xbf => cp_a!(r.a),                                         // cp_aa

        0xc0 => ret_if!((r.f & Z) == 0),                            // ret_nz
        0xc1 => pop!(b, c),                                         // pop_bc
        0xc2 => jp_n!((r.f & Z) == 0),                              // jp_nz_nn
        0xc3 => jp!(),                                              // jp_nn
        0xc4 => call_if!((r.f & Z) == 0),                           // call_nz_n
        0xc5 => push!(b, c),                                        // push_bc
        0xc6 => { add_a!(m.rb(r.bump())); 2 }                       // add_an
        0xc7 => rst!(0x00),                                         // rst_00
        0xc8 => ret_if!((r.f & Z) != 0),                            // ret_z
        0xc9 => { r.ret(m); 4 }                                     // ret
        0xca => jp_n!((r.f & Z) != 0),                              // jp_z_nn
        0xcb => { exec_cb(m.rb(r.bump()), r, m) }                   // map_cb
        0xcc => call_if!((r.f & Z) != 0),                           // call_z_n
        0xcd => call!(),                                            // call
        0xce => { adc_a!(m.rb(r.bump())); 2 }                       // adc_an
        0xcf => rst!(0x08),                                         // rst_08

        0xd0 => ret_if!((r.f & C) == 0),                            // ret_nc
        0xd1 => pop!(d, e),                                         // pop_de
        0xd2 => jp_n!((r.f & C) == 0),                              // jp_nc_nn
        0xd3 => xx(),                                               // xx
        0xd4 => call_if!((r.f & C) == 0),                           // call_nc_n
        0xd5 => push!(d, e),                                        // push_de
        0xd6 => { sub_a!(m.rb(r.bump())); 2 }                       // sub_an
        0xd7 => rst!(0x10),                                         // rst_10
        0xd8 => ret_if!((r.f & C) != 0),                            // ret_c
        0xd9 => { r.ei(m); r.ret(m); 4 }                            // reti
        0xda => jp_n!((r.f & C) != 0),                              // jp_c_nn
        0xdb => xx(),                                               // xx
        0xdc => call_if!((r.f & C) != 0),                           // call_c_n
        0xdd => xx(),                                               // xx
        0xde => { sbc_a!(m.rb(r.bump())); 2 }                       // sbc_an
        0xdf => rst!(0x18),                                         // rst_18

        0xe0 => { ld_IOan(r, m); 3 }                                // ld_IOan
        0xe1 => pop!(h, l),                                         // pop_hl
        0xe2 => { m.wb(0xff00 | (r.c as u16), r.a); 2 }             // ld_IOca
        0xe3 => xx(),                                               // xx
        0xe4 => xx(),                                               // xx
        0xe5 => push!(h, l),                                        // push_hl
        0xe6 => { and_a!(m.rb(r.bump())); 2 }                       // and_an
        0xe7 => rst!(0x20),                                         // rst_20
        0xe8 => { add_spn(r, m); 4 }                                // add_spn
        0xe9 => { r.pc = r.hl(); 1 }                                // jp_hl
        0xea => { let n = m.rw(r.pc); m.wb(n, r.a); r.pc += 2; 4 }  // ld_nna
        0xeb => xx(),                                               // xx
        0xec => xx(),                                               // xx
        0xed => xx(),                                               // xx
        0xee => { xor_a!(m.rb(r.bump())); 2 }                       // xor_an
        0xef => rst!(0x28),                                         // rst_28

        0xf0 => { r.a = m.rb(0xff00 | (m.rb(r.bump()) as u16)); 3 } // ld_aIOn
        0xf1 => { pop_af(r, m); 3 }                                 // pop_af
        0xf2 => { r.a = m.rb(0xff00 | (r.c as u16)); 2 }            // ld_aIOc
        0xf3 => { r.di(); 1 }                                       // di
        0xf4 => xx(),                                               // xx
        0xf5 => push!(a, f),                                        // push_af
        0xf6 => { or_a!(m.rb(r.bump())); 2 }                        // or_an
        0xf7 => rst!(0x30),                                         // rst_30
        0xf8 => { ld_hlspn(r, m); 3 }                               // ld_hlspn
        0xf9 => { r.sp = r.hl(); 2 }                                // ld_sphl
        0xfa => { r.a = m.rb(m.rw(r.pc)); r.pc += 2; 4 }            // ld_ann
        0xfb => { r.ei(m); 1 }                                      // ei
        0xfc => xx(),                                               // xx
        0xfd => xx(),                                               // xx
        0xfe => { cp_a!(m.rb(r.bump())); 2 }                        // cp_an
        0xff => rst!(0x38),                                         // rst_38

        _ => 0
    }
}

pub fn exec_cb(inst: u8, r: &mut z80::Registers, m: &mut mem::Memory) -> uint {
    macro_rules! rl( ($reg:expr, $cy:expr) => ({
        let ci = if (r.f & C) != 0 {1} else {0};
        let co = $reg & 0x80;
        $reg = ($reg << 1) | ci;
        r.f = if $reg != 0 {0} else {Z} | if co != 0 {C} else {0};
        $cy
    }) )

    macro_rules! rlc( ($reg:expr, $cy:expr) => ({
        let ci = if ($reg & 0x80) != 0 {1} else {0};
        $reg = ($reg << 1) | ci;
        r.f = if $reg != 0 {0} else {Z} | if ci != 0 {C} else {0};
        $cy
    }) )

    macro_rules! rr( ($reg:expr, $cy:expr) => ({
        let ci = if (r.f & C) != 0 {0x80} else {0};
        let co = if ($reg & 0x01) != 0 {C} else {0};
        $reg = ($reg >> 1) | ci;
        r.f = if $reg != 0 {0} else {Z} | co;
        $cy
    }) )

    macro_rules! rrc( ($reg:expr, $cy:expr) => ({
        let ci = $reg & 0x01;
        $reg = ($reg >> 1) | (ci << 7);
        r.f = if $reg != 0 {0} else {Z} | if ci != 0 {C} else {0};
        $cy
    }) )
    macro_rules! hlm( ($i:ident, $s:stmt) => ({
        let mut $i = m.rb(r.hl());
        $s;
        m.wb(r.hl(), $i);
    }) )
    macro_rules! hlfrob( ($i:ident, $e:expr) => ({
        let $i = m.rb(r.hl());
        m.wb(r.hl(), $e);
    }) )
    macro_rules! sra( ($e:expr, $cy:expr) => ({
        let co = $e & 1;
        $e = (($e as i8) >> 1) as u8;
        r.f = if $e != 0 {0} else {Z} | if co != 0 {C} else {0};
        $cy
    }) )
    macro_rules! srl( ($e:expr, $cy:expr) => ({
        let co = $e & 1;
        $e = $e >> 1;
        r.f = if $e != 0 {0} else {Z} | if co != 0 {C} else {0};
        $cy
    }) )
    macro_rules! sla( ($e:expr, $cy:expr) => ({
        let co = ($e >> 7) & 1;
        $e = $e << 1;
        r.f = if $e != 0 {0} else {Z} | if co != 0 {C} else {0};
        $cy
    }) )
    macro_rules! swap( ($e:expr) => ({
        $e = ($e << 4) | (($e & 0xf0) >> 4);
        r.f = if $e != 0 {0} else {Z};
        2
    }) )
    macro_rules! bit( ($e:expr, $bit:expr) => ({
        r.f = (r.f & C) | H | if $e & (1 << $bit) != 0 {0} else {Z};
        2
    }) )
    match inst {
        0x00 => rlc!(r.b, 2),                                       // rlc_b
        0x01 => rlc!(r.c, 2),                                       // rlc_c
        0x02 => rlc!(r.d, 2),                                       // rlc_d
        0x03 => rlc!(r.e, 2),                                       // rlc_e
        0x04 => rlc!(r.h, 2),                                       // rlc_h
        0x05 => rlc!(r.l, 2),                                       // rlc_l
        0x06 => { hlm!(hl, rlc!(hl, 1)); 4 }                        // rlc_hlm
        0x07 => rlc!(r.a, 2),                                       // rlc_a
        0x08 => rrc!(r.b, 2),                                       // rrc_b
        0x09 => rrc!(r.c, 2),                                       // rrc_c
        0x0a => rrc!(r.d, 2),                                       // rrc_d
        0x0b => rrc!(r.e, 2),                                       // rrc_e
        0x0c => rrc!(r.h, 2),                                       // rrc_h
        0x0d => rrc!(r.l, 2),                                       // rrc_l
        0x0e => { hlm!(hl, rrc!(hl, 1)); 4 }                        // rrc_hlm
        0x0f => rrc!(r.a, 2),                                       // rrc_a

        0x10 => rl!(r.b, 2),                                        // rl_b
        0x11 => rl!(r.c, 2),                                        // rl_c
        0x12 => rl!(r.d, 2),                                        // rl_d
        0x13 => rl!(r.e, 2),                                        // rl_e
        0x14 => rl!(r.h, 2),                                        // rl_h
        0x15 => rl!(r.l, 2),                                        // rl_l
        0x16 => { hlm!(hl, rl!(hl, 1)); 4 }                         // rl_hlm
        0x17 => rl!(r.a, 2),                                        // rl_a
        0x18 => rr!(r.b, 2),                                        // rr_b
        0x19 => rr!(r.c, 2),                                        // rr_c
        0x1a => rr!(r.d, 2),                                        // rr_d
        0x1b => rr!(r.e, 2),                                        // rr_e
        0x1c => rr!(r.h, 2),                                        // rr_h
        0x1d => rr!(r.l, 2),                                        // rr_l
        0x1e => { hlm!(hl, rr!(hl, 1)); 4 }                         // rr_hlm
        0x1f => rr!(r.a, 2),                                        // rr_a

        0x20 => sla!(r.b, 2),                                       // sla_b
        0x21 => sla!(r.c, 2),                                       // sla_c
        0x22 => sla!(r.d, 2),                                       // sla_d
        0x23 => sla!(r.e, 2),                                       // sla_e
        0x24 => sla!(r.h, 2),                                       // sla_h
        0x25 => sla!(r.l, 2),                                       // sla_l
        0x26 => { hlm!(hl, sla!(hl, 1)); 4 }                        // sla_hlm
        0x27 => sla!(r.a, 2),                                       // sla_a
        0x28 => sra!(r.b, 2),                                       // sra_b
        0x29 => sra!(r.c, 2),                                       // sra_c
        0x2a => sra!(r.d, 2),                                       // sra_d
        0x2b => sra!(r.e, 2),                                       // sra_e
        0x2c => sra!(r.h, 2),                                       // sra_h
        0x2d => sra!(r.l, 2),                                       // sra_l
        0x2e => { hlm!(hl, sra!(hl, 1)); 4 }                        // sra_hlm
        0x2f => sra!(r.a, 2),                                       // sra_a

        0x30 => swap!(r.b),                                         // swap_b
        0x31 => swap!(r.c),                                         // swap_c
        0x32 => swap!(r.d),                                         // swap_d
        0x33 => swap!(r.e),                                         // swap_e
        0x34 => swap!(r.h),                                         // swap_h
        0x35 => swap!(r.l),                                         // swap_l
        0x36 => { hlm!(hl, swap!(hl)); 4 }                          // swap_hlm
        0x37 => swap!(r.a),                                         // swap_a
        0x38 => srl!(r.b, 2),                                       // srl_b
        0x39 => srl!(r.c, 2),                                       // srl_c
        0x3a => srl!(r.d, 2),                                       // srl_d
        0x3b => srl!(r.e, 2),                                       // srl_e
        0x3c => srl!(r.h, 2),                                       // srl_h
        0x3d => srl!(r.l, 2),                                       // srl_l
        0x3e => { hlm!(hl, srl!(hl, 1)); 4 }                        // srl_hlm
        0x3f => srl!(r.a, 2),                                       // srl_a

        0x40 => bit!(r.b, 0),                                       // bit_0b
        0x41 => bit!(r.c, 0),                                       // bit_0c
        0x42 => bit!(r.d, 0),                                       // bit_0d
        0x43 => bit!(r.e, 0),                                       // bit_0e
        0x44 => bit!(r.h, 0),                                       // bit_0h
        0x45 => bit!(r.l, 0),                                       // bit_0l
        0x46 => { bit!(m.rb(r.hl()), 0); 3 }                        // bit_0hlm
        0x47 => bit!(r.a, 0),                                       // bit_0a
        0x48 => bit!(r.b, 1),                                       // bit_1b
        0x49 => bit!(r.c, 1),                                       // bit_1c
        0x4a => bit!(r.d, 1),                                       // bit_1d
        0x4b => bit!(r.e, 1),                                       // bit_1e
        0x4c => bit!(r.h, 1),                                       // bit_1h
        0x4d => bit!(r.l, 1),                                       // bit_1l
        0x4e => { bit!(m.rb(r.hl()), 1); 3 }                        // bit_1hlm
        0x4f => bit!(r.a, 1),                                       // bit_1a

        0x50 => bit!(r.b, 2),                                       // bit_2b
        0x51 => bit!(r.c, 2),                                       // bit_2c
        0x52 => bit!(r.d, 2),                                       // bit_2d
        0x53 => bit!(r.e, 2),                                       // bit_2e
        0x54 => bit!(r.h, 2),                                       // bit_2h
        0x55 => bit!(r.l, 2),                                       // bit_2l
        0x56 => { bit!(m.rb(r.hl()), 2); 3 }                        // bit_2hlm
        0x57 => bit!(r.a, 2),                                       // bit_2a
        0x58 => bit!(r.b, 3),                                       // bit_3b
        0x59 => bit!(r.c, 3),                                       // bit_3c
        0x5a => bit!(r.d, 3),                                       // bit_3d
        0x5b => bit!(r.e, 3),                                       // bit_3e
        0x5c => bit!(r.h, 3),                                       // bit_3h
        0x5d => bit!(r.l, 3),                                       // bit_3l
        0x5e => { bit!(m.rb(r.hl()), 3); 3 }                        // bit_3hlm
        0x5f => bit!(r.a, 3),                                       // bit_3a

        0x60 => bit!(r.b, 4),                                       // bit_4b
        0x61 => bit!(r.c, 4),                                       // bit_4c
        0x62 => bit!(r.d, 4),                                       // bit_4d
        0x63 => bit!(r.e, 4),                                       // bit_4e
        0x64 => bit!(r.h, 4),                                       // bit_4h
        0x65 => bit!(r.l, 4),                                       // bit_4l
        0x66 => { bit!(m.rb(r.hl()), 4); 3 }                        // bit_4hlm
        0x67 => bit!(r.a, 4),                                       // bit_4a
        0x68 => bit!(r.b, 5),                                       // bit_5b
        0x69 => bit!(r.c, 5),                                       // bit_5c
        0x6a => bit!(r.d, 5),                                       // bit_5d
        0x6b => bit!(r.e, 5),                                       // bit_5e
        0x6c => bit!(r.h, 5),                                       // bit_5h
        0x6d => bit!(r.l, 5),                                       // bit_5l
        0x6e => { bit!(m.rb(r.hl()), 5); 3 }                        // bit_5hlm
        0x6f => bit!(r.a, 5),                                       // bit_5a

        0x70 => bit!(r.b, 6),                                       // bit_6b
        0x71 => bit!(r.c, 6),                                       // bit_6c
        0x72 => bit!(r.d, 6),                                       // bit_6d
        0x73 => bit!(r.e, 6),                                       // bit_6e
        0x74 => bit!(r.h, 6),                                       // bit_6h
        0x75 => bit!(r.l, 6),                                       // bit_6l
        0x76 => { bit!(m.rb(r.hl()), 6); 3 }                        // bit_6hlm
        0x77 => bit!(r.a, 6),                                       // bit_6a
        0x78 => bit!(r.b, 7),                                       // bit_7b
        0x79 => bit!(r.c, 7),                                       // bit_7c
        0x7a => bit!(r.d, 7),                                       // bit_7d
        0x7b => bit!(r.e, 7),                                       // bit_7e
        0x7c => bit!(r.h, 7),                                       // bit_7h
        0x7d => bit!(r.l, 7),                                       // bit_7l
        0x7e => { bit!(m.rb(r.hl()), 7); 3 }                        // bit_7hlm
        0x7f => bit!(r.a, 7),                                       // bit_7a

        0x80 => { r.b &= !(1 << 0); 2 }                             // res_0b
        0x81 => { r.c &= !(1 << 0); 2 }                             // res_0c
        0x82 => { r.d &= !(1 << 0); 2 }                             // res_0d
        0x83 => { r.e &= !(1 << 0); 2 }                             // res_0e
        0x84 => { r.h &= !(1 << 0); 2 }                             // res_0h
        0x85 => { r.l &= !(1 << 0); 2 }                             // res_0l
        0x86 => { hlfrob!(hl, hl & !(1 << 0)); 4 }                  // set_0hlm
        0x87 => { r.a &= !(1 << 0); 2 }                             // res_0a
        0x88 => { r.b &= !(1 << 1); 2 }                             // res_1b
        0x89 => { r.c &= !(1 << 1); 2 }                             // res_1c
        0x8a => { r.d &= !(1 << 1); 2 }                             // res_1d
        0x8b => { r.e &= !(1 << 1); 2 }                             // res_1e
        0x8c => { r.h &= !(1 << 1); 2 }                             // res_1h
        0x8d => { r.l &= !(1 << 1); 2 }                             // res_1l
        0x8e => { hlfrob!(hl, hl & !(1 << 1)); 4 }                  // set_1hlm
        0x8f => { r.a &= !(1 << 1); 2 }                             // res_1a

        0x90 => { r.b &= !(1 << 2); 2 }                             // res_2b
        0x91 => { r.c &= !(1 << 2); 2 }                             // res_2c
        0x92 => { r.d &= !(1 << 2); 2 }                             // res_2d
        0x93 => { r.e &= !(1 << 2); 2 }                             // res_2e
        0x94 => { r.h &= !(1 << 2); 2 }                             // res_2h
        0x95 => { r.l &= !(1 << 2); 2 }                             // res_2l
        0x96 => { hlfrob!(hl, hl & !(1 << 2)); 4 }                  // set_2hlm
        0x97 => { r.a &= !(1 << 2); 2 }                             // res_2a
        0x98 => { r.b &= !(1 << 3); 2 }                             // res_3b
        0x99 => { r.c &= !(1 << 3); 2 }                             // res_3c
        0x9a => { r.d &= !(1 << 3); 2 }                             // res_3d
        0x9b => { r.e &= !(1 << 3); 2 }                             // res_3e
        0x9c => { r.h &= !(1 << 3); 2 }                             // res_3h
        0x9d => { r.l &= !(1 << 3); 2 }                             // res_3l
        0x9e => { hlfrob!(hl, hl & !(1 << 3)); 4 }                  // set_3hlm
        0x9f => { r.a &= !(1 << 3); 2 }                             // res_3a

        0xa0 => { r.b &= !(1 << 4); 2 }                             // res_4b
        0xa1 => { r.c &= !(1 << 4); 2 }                             // res_4c
        0xa2 => { r.d &= !(1 << 4); 2 }                             // res_4d
        0xa3 => { r.e &= !(1 << 4); 2 }                             // res_4e
        0xa4 => { r.h &= !(1 << 4); 2 }                             // res_4h
        0xa5 => { r.l &= !(1 << 4); 2 }                             // res_4l
        0xa6 => { hlfrob!(hl, hl & !(1 << 4)); 4 }                  // set_4hlm
        0xa7 => { r.a &= !(1 << 4); 2 }                             // res_4a
        0xa8 => { r.b &= !(1 << 5); 2 }                             // res_5b
        0xa9 => { r.c &= !(1 << 5); 2 }                             // res_5c
        0xaa => { r.d &= !(1 << 5); 2 }                             // res_5d
        0xab => { r.e &= !(1 << 5); 2 }                             // res_5e
        0xac => { r.h &= !(1 << 5); 2 }                             // res_5h
        0xad => { r.l &= !(1 << 5); 2 }                             // res_5l
        0xae => { hlfrob!(hl, hl & !(1 << 5)); 4 }                  // set_5hlm
        0xaf => { r.a &= !(1 << 5); 2 }                             // res_5a

        0xb0 => { r.b &= !(1 << 6); 2 }                             // res_6b
        0xb1 => { r.c &= !(1 << 6); 2 }                             // res_6c
        0xb2 => { r.d &= !(1 << 6); 2 }                             // res_6d
        0xb3 => { r.e &= !(1 << 6); 2 }                             // res_6e
        0xb4 => { r.h &= !(1 << 6); 2 }                             // res_6h
        0xb5 => { r.l &= !(1 << 6); 2 }                             // res_6l
        0xb6 => { hlfrob!(hl, hl & !(1 << 6)); 4 }                  // set_6hlm
        0xb7 => { r.a &= !(1 << 6); 2 }                             // res_6a
        0xb8 => { r.b &= !(1 << 7); 2 }                             // res_7b
        0xb9 => { r.c &= !(1 << 7); 2 }                             // res_7c
        0xba => { r.d &= !(1 << 7); 2 }                             // res_7d
        0xbb => { r.e &= !(1 << 7); 2 }                             // res_7e
        0xbc => { r.h &= !(1 << 7); 2 }                             // res_7h
        0xbd => { r.l &= !(1 << 7); 2 }                             // res_7l
        0xbe => { hlfrob!(hl, hl & !(1 << 7)); 4 }                  // set_7hlm
        0xbf => { r.a &= !(1 << 7); 2 }                             // res_7a

        0xc0 => { r.b |= (1 << 0); 2 }                              // set_0b
        0xc1 => { r.c |= (1 << 0); 2 }                              // set_0c
        0xc2 => { r.d |= (1 << 0); 2 }                              // set_0d
        0xc3 => { r.e |= (1 << 0); 2 }                              // set_0e
        0xc4 => { r.h |= (1 << 0); 2 }                              // set_0h
        0xc5 => { r.l |= (1 << 0); 2 }                              // set_0l
        0xc6 => { hlfrob!(hl, hl | (1 << 0)); 4 }                   // set_0hlm
        0xc7 => { r.a |= (1 << 0); 2 }                              // set_0a
        0xc8 => { r.b |= (1 << 1); 2 }                              // set_1b
        0xc9 => { r.c |= (1 << 1); 2 }                              // set_1c
        0xca => { r.d |= (1 << 1); 2 }                              // set_1d
        0xcb => { r.e |= (1 << 1); 2 }                              // set_1e
        0xcc => { r.h |= (1 << 1); 2 }                              // set_1h
        0xcd => { r.l |= (1 << 1); 2 }                              // set_1l
        0xce => { hlfrob!(hl, hl | (1 << 1)); 4 }                   // set_1hlm
        0xcf => { r.a |= (1 << 1); 2 }                              // set_1a

        0xd0 => { r.b |= (1 << 2); 2 }                              // set_2b
        0xd1 => { r.c |= (1 << 2); 2 }                              // set_2c
        0xd2 => { r.d |= (1 << 2); 2 }                              // set_2d
        0xd3 => { r.e |= (1 << 2); 2 }                              // set_2e
        0xd4 => { r.h |= (1 << 2); 2 }                              // set_2h
        0xd5 => { r.l |= (1 << 2); 2 }                              // set_2l
        0xd6 => { hlfrob!(hl, hl | (1 << 2)); 4 }                   // set_2hlm
        0xd7 => { r.a |= (1 << 2); 2 }                              // set_2a
        0xd8 => { r.b |= (1 << 3); 2 }                              // set_3b
        0xd9 => { r.c |= (1 << 3); 2 }                              // set_3c
        0xda => { r.d |= (1 << 3); 2 }                              // set_3d
        0xdb => { r.e |= (1 << 3); 2 }                              // set_3e
        0xdc => { r.h |= (1 << 3); 2 }                              // set_3h
        0xdd => { r.l |= (1 << 3); 2 }                              // set_3l
        0xde => { hlfrob!(hl, hl | (1 << 3)); 4 }                   // set_3hlm
        0xdf => { r.a |= (1 << 3); 2 }                              // set_3a

        0xe0 => { r.b |= (1 << 4); 2 }                              // set_4b
        0xe1 => { r.c |= (1 << 4); 2 }                              // set_4c
        0xe2 => { r.d |= (1 << 4); 2 }                              // set_4d
        0xe3 => { r.e |= (1 << 4); 2 }                              // set_4e
        0xe4 => { r.h |= (1 << 4); 2 }                              // set_4h
        0xe5 => { r.l |= (1 << 4); 2 }                              // set_4l
        0xe6 => { hlfrob!(hl, hl | (1 << 4)); 4 }                   // set_4hlm
        0xe7 => { r.a |= (1 << 4); 2 }                              // set_4a
        0xe8 => { r.b |= (1 << 5); 2 }                              // set_5b
        0xe9 => { r.c |= (1 << 5); 2 }                              // set_5c
        0xea => { r.d |= (1 << 5); 2 }                              // set_5d
        0xeb => { r.e |= (1 << 5); 2 }                              // set_5e
        0xec => { r.h |= (1 << 5); 2 }                              // set_5h
        0xed => { r.l |= (1 << 5); 2 }                              // set_5l
        0xee => { hlfrob!(hl, hl | (1 << 5)); 4 }                   // set_5hlm
        0xef => { r.a |= (1 << 5); 2 }                              // set_5a

        0xf0 => { r.b |= (1 << 6); 2 }                              // set_6b
        0xf1 => { r.c |= (1 << 6); 2 }                              // set_6c
        0xf2 => { r.d |= (1 << 6); 2 }                              // set_6d
        0xf3 => { r.e |= (1 << 6); 2 }                              // set_6e
        0xf4 => { r.h |= (1 << 6); 2 }                              // set_6h
        0xf5 => { r.l |= (1 << 6); 2 }                              // set_6l
        0xf6 => { hlfrob!(hl, hl | (1 << 6)); 4 }                   // set_6hlm
        0xf7 => { r.a |= (1 << 6); 2 }                              // set_6a
        0xf8 => { r.b |= (1 << 7); 2 }                              // set_7b
        0xf9 => { r.c |= (1 << 7); 2 }                              // set_7c
        0xfa => { r.d |= (1 << 7); 2 }                              // set_7d
        0xfb => { r.e |= (1 << 7); 2 }                              // set_7e
        0xfc => { r.h |= (1 << 7); 2 }                              // set_7h
        0xfd => { r.l |= (1 << 7); 2 }                              // set_7l
        0xfe => { hlfrob!(hl, hl | (1 << 7)); 4 }                   // set_7hlm
        0xff => { r.a |= (1 << 7); 2 }                              // set_7a

        _ => 0
    }
}

#[cfg(test)]
mod test {
    use cpu;
    use mem;

    fn init() -> (cpu::Cpu, mem::Memory) {
        let mem = mem::Memory::new(::gb::GameBoy);
        let mut cpu = cpu::Cpu::new(::gb::GameBoy);
        cpu.regs.pc = 0xe000; // put it in wram instead of rom
        (cpu, mem)
    }

    fn op(cpu: &mut cpu::Cpu, mem: &mut mem::Memory,
          code: u8, diff: u16, cycles: uint) {

        let before = cpu.regs.pc;
        mem.wb(before, code);
        let cy = cpu.exec(mem);
        assert_eq!(cy, 4 * cycles);
        assert_eq!(cpu.regs.pc, before + diff);
    }

    ////////////////////////////////////////////////////////////////////////////
    // 0x00
    ////////////////////////////////////////////////////////////////////////////

    #[test]
    fn nop() {
        let (mut c, mut m) = init();
        op(&mut c, &mut m, 0x00, 1, 1);
    }

    #[test]
    fn ld_bc_nn() {
        let (mut c, mut m) = init();
        m.ww(c.regs.pc + 1, 0xf892);
        op(&mut c, &mut m, 0x01, 3, 3);
        assert_eq!(c.regs.b, 0xf8);
        assert_eq!(c.regs.c, 0x92);
    }

    #[test]
    fn ld_bc_a() {
        let (mut c, mut m) = init();
        c.regs.a = 0xf3;
        c.regs.b = 0xd2;
        c.regs.c = 0x02;
        op(&mut c, &mut m, 0x02, 1, 2);
        assert_eq!(m.rb(0xd202), 0xf3);
    }

    #[test]
    fn inc_bc() {
        let (mut c, mut m) = init();
        c.regs.b = 0x33;
        c.regs.c = 0x48;
        op(&mut c, &mut m, 0x03, 1, 2);
        assert_eq!(c.regs.b, 0x33);
        assert_eq!(c.regs.c, 0x49);
    }

    #[test]
    fn inc_b() {
        let (mut c, mut m) = init();
        c.regs.b = 0x33;
        c.regs.f = 0x10;
        op(&mut c, &mut m, 0x04, 1, 1);
        assert_eq!(c.regs.b, 0x34);
        assert_eq!(c.regs.f, 0x10);
    }

    #[test]
    fn dec_b() {
        // normal decrement
        let (mut c, mut m) = init();
        c.regs.b = 0x33;
        c.regs.f = 0x10;
        op(&mut c, &mut m, 0x05, 1, 1);
        assert_eq!(c.regs.b, 0x32);
        assert_eq!(c.regs.f, 0x50);

        // carry in lower 4
        let (mut c, mut m) = init();
        c.regs.b = 0x30;
        c.regs.f = 0x10;
        op(&mut c, &mut m, 0x05, 1, 1);
        assert_eq!(c.regs.b, 0x2f);
        assert_eq!(c.regs.f, 0x70);

        // zero flag
        let (mut c, mut m) = init();
        c.regs.b = 0x01;
        c.regs.f = 0x00;
        op(&mut c, &mut m, 0x05, 1, 1);
        assert_eq!(c.regs.b, 0x00);
        assert_eq!(c.regs.f, 0xc0);

        // wrap around
        let (mut c, mut m) = init();
        c.regs.b = 0x00;
        c.regs.f = 0x10;
        op(&mut c, &mut m, 0x05, 1, 1);
        assert_eq!(c.regs.b, 0xff);
        assert_eq!(c.regs.f, 0x70);
    }

    #[test]
    fn ld_b_n() {
        let (mut c, mut m) = init();
        m.wb(c.regs.pc + 1, 0x36);
        op(&mut c, &mut m, 0x06, 2, 2);
        assert_eq!(c.regs.b, 0x36);
    }

    #[test]
    fn rlca() {
        let (mut c, mut m) = init();
        c.regs.a = 0x01;
        op(&mut c, &mut m, 0x07, 1, 1);
        assert_eq!(c.regs.a, 0x02);
        assert_eq!(c.regs.f, 0x00);

        c.regs.a = 0x8f;
        op(&mut c, &mut m, 0x07, 1, 1);
        assert_eq!(c.regs.a, 0x1f);
        assert_eq!(c.regs.f, 0x10);
    }

    #[test]
    fn ld_n_sp() {
        let (mut c, mut m) = init();
        m.ww(c.regs.pc + 1, 0xf0f0);
        c.regs.sp = 0x7893;
        op(&mut c, &mut m, 0x08, 3, 5);
        assert_eq!(m.rw(0xf0f0), 0x7893);
    }

    #[test]
    fn add_hl_bc() {
        let (mut c, mut m) = init();
        c.regs.b = 0xf0;
        c.regs.c = 0xe0;
        c.regs.h = 0x87;
        c.regs.l = 0x10;
        c.regs.f = 0;

        // carry, no half carry
        op(&mut c, &mut m, 0x09, 1, 2);
        assert_eq!(c.regs.l, 0xf0);
        assert_eq!(c.regs.h, 0x77);
        assert_eq!(c.regs.f, 0x10);
    }

    #[test]
    fn ld_a_bc() {
        let (mut c, mut m) = init();
        c.regs.b = 0xd8;
        c.regs.c = 0x80;
        m.wb(0xd880, 0x93);
        op(&mut c, &mut m, 0x0a, 1, 2);
        assert_eq!(c.regs.a, 0x93);
    }

    #[test]
    fn dec_bc() {
        let (mut c, mut m) = init();
        c.regs.b = 0x20;
        c.regs.c = 0x33;
        op(&mut c, &mut m, 0x0b, 1, 2);
        assert_eq!(c.regs.c, 0x32);
        assert_eq!(c.regs.b, 0x20);

        c.regs.b = 0x01;
        c.regs.c = 0x00;
        op(&mut c, &mut m, 0x0b, 1, 2);
        assert_eq!(c.regs.b, 0x00);
        assert_eq!(c.regs.c, 0xff);

        c.regs.b = 0x00;
        c.regs.c = 0x00;
        op(&mut c, &mut m, 0x0b, 1, 2);
        assert_eq!(c.regs.c, 0xff);
        assert_eq!(c.regs.b, 0xff);
    }

    #[test]
    fn ld_c_n() {
        let (mut c, mut m) = init();
        m.wb(c.regs.pc + 1, 0x20);
        op(&mut c, &mut m, 0x0e, 2, 2);
        assert_eq!(c.regs.c, 0x20);
    }

    #[test]
    fn rrca() {
        let (mut c, mut m) = init();
        c.regs.a = 0x02;
        c.regs.f = 0x00;
        op(&mut c, &mut m, 0x0f, 1, 1);
        assert_eq!(c.regs.a, 1);
        assert_eq!(c.regs.f, 0);

        c.regs.a = 0x01;
        op(&mut c, &mut m, 0x0f, 1, 1);
        assert_eq!(c.regs.a, 0x80);
        assert_eq!(c.regs.f, 0x10);
    }

    ////////////////////////////////////////////////////////////////////////////
    // 0x10
    ////////////////////////////////////////////////////////////////////////////

    #[test]
    fn ld_de_nn() {
        let (mut c, mut m) = init();
        m.ww(c.regs.pc + 1, 0x8739);
        op(&mut c, &mut m, 0x11, 3, 3);
        assert_eq!(c.regs.d, 0x87);
        assert_eq!(c.regs.e, 0x39);
    }

    #[test]
    fn ld_de_a() {
        let (mut c, mut m) = init();
        c.regs.a = 0x22;
        c.regs.d = 0xd9;
        c.regs.e = 0x88;
        op(&mut c, &mut m, 0x12, 1, 2);
        assert_eq!(m.rb(0xd988), 0x22);
    }

    #[test]
    fn rla() {
        let (mut c, mut m) = init();
        c.regs.a = 0x01;
        c.regs.f = 0x10;
        op(&mut c, &mut m, 0x17, 1, 1);
        assert_eq!(c.regs.a, 0x03);
        assert_eq!(c.regs.f, 0x00);

        c.regs.a = 0x8f;
        op(&mut c, &mut m, 0x17, 1, 1);
        assert_eq!(c.regs.a, 0x1e);
        assert_eq!(c.regs.f, 0x10);
    }

    #[test]
    fn jr_n() {
        let (mut c, mut m) = init();
        m.wb(c.regs.pc + 1, 0xfe);
        op(&mut c, &mut m, 0x18, 0, 3);

        m.wb(c.regs.pc + 1, 0x02);
        op(&mut c, &mut m, 0x18, 4, 3);
    }

    ////////////////////////////////////////////////////////////////////////////
    // 0x30
    ////////////////////////////////////////////////////////////////////////////

    #[test]
    fn ld_a_n() {
        let (mut c, mut m) = init();
        c.regs.a = 0x01;
        m.wb(c.regs.pc + 1, 0x20);
        op(&mut c, &mut m, 0x3e, 2, 2);
        assert_eq!(c.regs.a, 0x20);
    }

    #[test]
    fn scf() {
        let (mut c, mut m) = init();
        c.regs.f = 0x10;
        op(&mut c, &mut m, 0x37, 1, 1);
        assert_eq!(c.regs.f, 0x10);
        c.regs.f = 0x60;
        op(&mut c, &mut m, 0x37, 1, 1);
        assert_eq!(c.regs.f, 0x10);
        c.regs.f = 0x80;
        op(&mut c, &mut m, 0x37, 1, 1);
        assert_eq!(c.regs.f, 0x90);
    }

    #[test]
    fn ccf() {
        let (mut c, mut m) = init();
        c.regs.f = 0x10;
        op(&mut c, &mut m, 0x3f, 1, 1);
        assert_eq!(c.regs.f, 0x00);
        c.regs.f = 0x60;
        op(&mut c, &mut m, 0x3f, 1, 1);
        assert_eq!(c.regs.f, 0x10);
        c.regs.f = 0x80;
        op(&mut c, &mut m, 0x3f, 1, 1);
        assert_eq!(c.regs.f, 0x90);
    }

    ////////////////////////////////////////////////////////////////////////////
    // 0x80
    ////////////////////////////////////////////////////////////////////////////

    #[test]
    fn add_a_b() {
        let (mut c, mut m) = init();
        c.regs.a = 0x02;
        c.regs.b = 0x01;
        c.regs.f = super::Z | super::N | super::H | super::C;
        op(&mut c, &mut m, 0x80, 1, 1);
        assert_eq!(c.regs.a, 0x03);
        assert_eq!(c.regs.f, 0x00);

        c.regs.a = 0x0f;
        c.regs.b = 0x01;
        op(&mut c, &mut m, 0x80, 1, 1);
        assert_eq!(c.regs.a, 0x10);
        assert_eq!(c.regs.f & super::H, super::H);

        c.regs.a = 0xf0;
        c.regs.b = 0x10;
        op(&mut c, &mut m, 0x80, 1, 1);
        assert_eq!(c.regs.a, 0x00);
        assert_eq!(c.regs.f & super::C, super::C);
        assert_eq!(c.regs.f & super::Z, super::Z);
    }

    #[test]
    fn adc_a_b() {
        let (mut c, mut m) = init();
        c.regs.a = 0x02;
        c.regs.b = 0x01;
        c.regs.f = super::Z | super::N | super::H | super::C;
        op(&mut c, &mut m, 0x88, 1, 1);
        assert_eq!(c.regs.a, 0x04);
        assert_eq!(c.regs.f, 0x00);

        c.regs.a = 0x0f;
        c.regs.b = 0x01;
        op(&mut c, &mut m, 0x88, 1, 1);
        assert_eq!(c.regs.a, 0x10);
        assert_eq!(c.regs.f, super::H);

        c.regs.a = 0xf0;
        c.regs.b = 0x10;
        op(&mut c, &mut m, 0x88, 1, 1);
        assert_eq!(c.regs.a, 0x00);
        assert_eq!(c.regs.f, super::C | super::Z);
    }

    ////////////////////////////////////////////////////////////////////////////
    // 0x90
    ////////////////////////////////////////////////////////////////////////////

    #[test]
    fn sub_a_b() {
        let (mut c, mut m) = init();
        c.regs.a = 0x02;
        c.regs.b = 0x01;
        c.regs.f = super::Z | super::N | super::H | super::C;
        op(&mut c, &mut m, 0x90, 1, 1);
        assert_eq!(c.regs.a, 0x01);
        assert_eq!(c.regs.f, super::N);

        c.regs.a = 0xf1;
        c.regs.b = 0x02;
        op(&mut c, &mut m, 0x90, 1, 1);
        assert_eq!(c.regs.a, 0xef);
        assert_eq!(c.regs.f, super::N | super::H);

        c.regs.a = 0x10;
        c.regs.b = 0x10;
        op(&mut c, &mut m, 0x90, 1, 1);
        assert_eq!(c.regs.a, 0x00);
        assert_eq!(c.regs.f, super::N | super::Z);

        c.regs.a = 0x10;
        c.regs.b = 0x20;
        op(&mut c, &mut m, 0x90, 1, 1);
        assert_eq!(c.regs.a, 0xf0);
        assert_eq!(c.regs.f, super::N | super::C);
    }

    #[test]
    fn sbc_a_b() {
        let (mut c, mut m) = init();
        c.regs.a = 0x02;
        c.regs.b = 0x01;
        c.regs.f = super::Z | super::N | super::H | super::C;
        op(&mut c, &mut m, 0x98, 1, 1);
        assert_eq!(c.regs.a, 0x00);
        assert_eq!(c.regs.f, super::N | super::Z);

        c.regs.a = 0xf1;
        c.regs.b = 0x02;
        op(&mut c, &mut m, 0x98, 1, 1);
        assert_eq!(c.regs.a, 0xef);
        assert_eq!(c.regs.f, super::N | super::H);

        c.regs.a = 0x10;
        c.regs.b = 0x10;
        op(&mut c, &mut m, 0x98, 1, 1);
        assert_eq!(c.regs.a, 0x00);
        assert_eq!(c.regs.f, super::N | super::Z);

        c.regs.a = 0x10;
        c.regs.b = 0x20;
        op(&mut c, &mut m, 0x98, 1, 1);
        assert_eq!(c.regs.a, 0xf0);
        assert_eq!(c.regs.f, super::N | super::C);
    }

    ////////////////////////////////////////////////////////////////////////////
    // 0xa0
    ////////////////////////////////////////////////////////////////////////////

    #[test]
    fn xor_b() {
        let (mut c, mut m) = init();
        c.regs.a = 0x01;
        c.regs.b = 0x01;
        op(&mut c, &mut m, 0xa8, 1, 1);
        assert_eq!(c.regs.a, 0);
        assert_eq!(c.regs.f, 0x80);
    }

    ////////////////////////////////////////////////////////////////////////////
    // 0xb0
    ////////////////////////////////////////////////////////////////////////////

    #[test]
    fn or_b() {
        let (mut c, mut m) = init();
        c.regs.a = 0x01;
        c.regs.b = 0x02;
        op(&mut c, &mut m, 0xb0, 1, 1);
        assert_eq!(c.regs.a, 0x03);
        assert_eq!(c.regs.f, 0);
    }

    #[test]
    fn cp_b() {
        let (mut c, mut m) = init();
        c.regs.a = 0x01;
        c.regs.b = 0x01;
        op(&mut c, &mut m, 0xb8, 1, 1);
        assert_eq!(c.regs.f, super::Z | super::N);

        c.regs.a = 0x02;
        c.regs.b = 0x01;
        op(&mut c, &mut m, 0xb8, 1, 1);
        assert_eq!(c.regs.f, super::N);

        c.regs.a = 0x00;
        c.regs.b = 0x01;
        op(&mut c, &mut m, 0xb8, 1, 1);
        assert_eq!(c.regs.f, super::C | super::N | super::H);

        c.regs.a = 0x01;
        c.regs.b = 0x10;
        op(&mut c, &mut m, 0xb8, 1, 1);
        assert_eq!(c.regs.f, super::C | super::N);
    }

    ////////////////////////////////////////////////////////////////////////////
    // 0xc0
    ////////////////////////////////////////////////////////////////////////////

    #[test]
    fn pop_bc() {
        let (mut c, mut m) = init();
        c.regs.b = 0x01;
        c.regs.c = 0x01;
        c.regs.sp = 0xd111;
        m.ww(0xd111, 0x1234);
        op(&mut c, &mut m, 0xc1, 1, 3);
        assert_eq!(c.regs.b, 0x12);
        assert_eq!(c.regs.c, 0x34);
        assert_eq!(c.regs.sp, 0xd113);
    }

    #[test]
    fn rlc_b() {
        let (mut c, mut m) = init();
        c.regs.b = 0x01;
        m.wb(c.regs.pc + 1, 0x00);
        op(&mut c, &mut m, 0xcb, 2, 2);
        assert_eq!(c.regs.b, 0x02);
        assert_eq!(c.regs.f, 0x00);

        c.regs.b = 0x00;
        m.wb(c.regs.pc + 1, 0x00);
        op(&mut c, &mut m, 0xcb, 2, 2);
        assert_eq!(c.regs.b, 0x00);
        assert_eq!(c.regs.f, 0x80);

        c.regs.b = 0x81;
        m.wb(c.regs.pc + 1, 0x00);
        op(&mut c, &mut m, 0xcb, 2, 2);
        assert_eq!(c.regs.b, 0x03);
        assert_eq!(c.regs.f, 0x10);
    }

    #[test]
    fn rl_b() {
        let (mut c, mut m) = init();
        c.regs.b = 0x01;
        c.regs.f = 0x00;
        m.wb(c.regs.pc + 1, 0x10);
        op(&mut c, &mut m, 0xcb, 2, 2);
        assert_eq!(c.regs.b, 0x02);
        assert_eq!(c.regs.f, 0x00);

        c.regs.b = 0x00;
        m.wb(c.regs.pc + 1, 0x10);
        op(&mut c, &mut m, 0xcb, 2, 2);
        assert_eq!(c.regs.b, 0x00);
        assert_eq!(c.regs.f, 0x80);

        c.regs.b = 0x81;
        c.regs.f = 0;
        m.wb(c.regs.pc + 1, 0x10);
        op(&mut c, &mut m, 0xcb, 2, 2);
        assert_eq!(c.regs.b, 0x02);
        assert_eq!(c.regs.f, 0x10);
    }

    #[test]
    fn sla_e() {
        let (mut c, mut m) = init();
        c.regs.e = 0x01;
        m.wb(c.regs.pc + 1, 0x23);
        op(&mut c, &mut m, 0xcb, 2, 2);
        assert_eq!(c.regs.e, 0x02);
        assert_eq!(c.regs.f, 0x00);

        c.regs.e = 0x00;
        m.wb(c.regs.pc + 1, 0x23);
        op(&mut c, &mut m, 0xcb, 2, 2);
        assert_eq!(c.regs.e, 0x00);
        assert_eq!(c.regs.f, 0x80);

        c.regs.e = 0x81;
        c.regs.f = 0;
        m.wb(c.regs.pc + 1, 0x23);
        op(&mut c, &mut m, 0xcb, 2, 2);
        assert_eq!(c.regs.e, 0x02);
        assert_eq!(c.regs.f, 0x10);
    }

    #[test]
    fn sra_e() {
        let (mut c, mut m) = init();
        c.regs.a = 0x81;
        m.wb(c.regs.pc + 1, 0x2f);
        op(&mut c, &mut m, 0xcb, 2, 2);
        assert_eq!(c.regs.a, 0xc0);
        assert_eq!(c.regs.f, 0x10);

        c.regs.a = 0x00;
        m.wb(c.regs.pc + 1, 0x2f);
        op(&mut c, &mut m, 0xcb, 2, 2);
        assert_eq!(c.regs.a, 0x00);
        assert_eq!(c.regs.f, 0x80);
    }

    #[test]
    fn srl_a() {
        let (mut c, mut m) = init();
        c.regs.a = 0x81;
        m.wb(c.regs.pc + 1, 0x3f);
        op(&mut c, &mut m, 0xcb, 2, 2);
        assert_eq!(c.regs.a, 0x40);
        assert_eq!(c.regs.f, 0x10);

        c.regs.a = 0x00;
        m.wb(c.regs.pc + 1, 0x3f);
        op(&mut c, &mut m, 0xcb, 2, 2);
        assert_eq!(c.regs.a, 0x00);
        assert_eq!(c.regs.f, 0x80);
    }

    #[test]
    fn bit_0b() {
        let (mut c, mut m) = init();
        c.regs.b = 0x01;
        c.regs.f = 0;
        m.wb(c.regs.pc + 1, 0x40);
        op(&mut c, &mut m, 0xcb, 2, 2);
        assert_eq!(c.regs.f, 0x20);

        c.regs.b = 0x00;
        c.regs.f = 0x10;
        m.wb(c.regs.pc + 1, 0x40);
        op(&mut c, &mut m, 0xcb, 2, 2);
        assert_eq!(c.regs.f, 0xb0);
    }

    ////////////////////////////////////////////////////////////////////////////
    // 0xe0
    ////////////////////////////////////////////////////////////////////////////

    #[test]
    fn ld_nn_a() {
        let (mut c, mut m) = init();
        c.regs.a = 0x01;
        m.ww(c.regs.pc + 1, 0xd0d0);
        m.wb(0xd0d0, 0x02);
        op(&mut c, &mut m, 0xea, 3, 4);
        assert_eq!(m.rb(0xd0d0), 0x01);
    }

    ////////////////////////////////////////////////////////////////////////////
    // 0xf0
    ////////////////////////////////////////////////////////////////////////////

    #[test]
    fn ld_a_nn() {
        let (mut c, mut m) = init();
        c.regs.a = 0x01;
        m.ww(c.regs.pc + 1, 0xd0d0);
        m.wb(0xd0d0, 0x02);
        op(&mut c, &mut m, 0xfa, 3, 4);
        assert_eq!(c.regs.a, 0x02);
    }

    #[test]
    fn cp_an() {
        let (mut c, mut m) = init();
        c.regs.a = 0x01;
        m.wb(c.regs.pc + 1, 0x01);
        op(&mut c, &mut m, 0xfe, 2, 2);
        assert_eq!(c.regs.f, 0xc0);
    }
}
