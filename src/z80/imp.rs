use cpu::z80;
use mem;

pub fn exec(inst: u8, r: &mut z80::Registers, m: &mut mem::Memory) -> uint {
    macro_rules! ld_16( ($reg1:ident, $reg2:ident) => ({
        r.$reg2 = m.rb(r.bump());
        r.$reg1 = m.rb(r.bump());
        3
    }) )
    macro_rules! inc_16( ($reg1:ident, $reg2: ident) => ({
        r.$reg2 += 1;
        if r.$reg2 == 0 { r.$reg1 += 1; }
        2
    }) )

    match inst {
        0x00 => 1,                                                  // nop
        0x01 => ld_16!(b, c),                                       // ld_bcnn
        0x02 => { m.wb(r.bc(), r.a); 2 }                            // ld_bca
        0x03 => inc_16!(b, c),                                      // inc_bc
        _ => 0,
    }
}

//pub fn exec_cb(inst: u8, regs: &mut z80::Registers, mem: &mut mem::Memory) {
//    match inst {
//
//    }
//}
//
