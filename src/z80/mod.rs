use std::fmt;

use gb;
use mem;

pub use cpu::z80::daa::DAA_TABLE;
pub use cpu::z80::imp::exec;

mod imp;
mod daa;

/// This class represents the registers of the Z80 GB cpu.
///
/// - a-l : are registers
/// - pc : the program counter
/// - sp : the stack pointer,
/// - ime : flag for whether interrupts are tunred on or not
/// - halt : flag as to whether a halt has happened or should
/// - stop : flag as to whether a stop has happened or should
pub struct Registers {
    ime: uint,
    halt: uint,
    stop: uint,

    priv a: u8,
    priv b: u8,
    priv c: u8,
    priv d: u8,
    priv e: u8,
    priv f: u8,
    priv h: u8,
    priv l: u8,

    priv sp: u16,
    priv pc: u16,

    priv delay: uint,
}

impl Registers {
    pub fn new(target: gb::Target) -> Registers {
        let mut r = Registers {
            ime: 0, halt: 0, stop: 0,

            // See: http://nocash.emubase.de/pandocs.htm#powerupsequence
            a: 0x01, b: 0x00, d: 0x00, h: 0x01,
            f: 0xb0, c: 0x13, e: 0xd8, l: 0x4d,
            sp: 0xfffe, pc: 0x0100,

            delay: 0,
        };

        match target {
            gb::GameBoy => {}

            // These two cases were lifted from visualboyadvance
            gb::GameBoyColor => {
                r.a = 0x11; r.f = 0xb0;
                r.b = 0x00; r.c = 0x00;
                r.d = 0xff; r.e = 0x56;
                r.h = 0x00; r.l = 0x0d;
            }

            gb::SuperGameBoy => {
                r.a = 0x01; r.f = 0xb0;
                r.b = 0x00; r.c = 0x13;
                r.d = 0x00; r.e = 0xd8;
                r.h = 0x01; r.l = 0x4d;
            }
        }

        return r;
    }

    pub fn bump(&mut self) -> u16 {
        let ret = self.pc;
        self.pc += 1;
        return ret;
    }

    fn bc(&self) -> u16 { ((self.b as u16) << 8) | (self.c as u16) }
    fn de(&self) -> u16 { ((self.d as u16) << 8) | (self.e as u16) }
    fn hl(&self) -> u16 { ((self.h as u16) << 8) | (self.l as u16) }

    fn hlmm(&mut self) {
        self.l -= 1;
        if self.l == 0xff {
            self.h -= 1;
        }
    }

    fn hlpp(&mut self) {
        self.l += 1;
        if self.l == 0 {
            self.h += 1;
        }
    }

    fn ret(&mut self, m: &mut mem::Memory) {
        self.pc = m.rw(self.sp);
        self.sp += 2;
    }

    pub fn rst(&mut self, i: u16, m: &mut mem::Memory) {
        self.sp -= 2;
        m.ww(self.sp, self.pc);
        self.pc = i;
    }

    pub fn int_step(&mut self) {
        match self.delay {
            0 => {}
            1 => { self.delay = 0; self.ime = 1; }
            2 => { self.delay = 1; }
            _ => {}
        }
    }

    // Schedule an enabling of interrupts
    pub fn ei(&mut self, m: &mut mem::Memory) {
        if self.delay == 2 || m.rb(self.pc) == 0x76 {
            self.delay = 1;
        } else {
            self.delay = 2;
        }
    }

    pub fn di(&mut self) {
        self.ime = 0;
        self.delay = 0;
    }

    pub fn is_loopback(&self, m: &mem::Memory) -> bool {
        m.rb(self.pc) == 0x18 && // jr
        m.rb(self.pc + 1) == 0xfe // jump back to self
    }
}

impl fmt::Default for Registers {
    fn fmt(r: &Registers, f: &mut fmt::Formatter) {
        write!(f.buf, "a:{:2x} b:{:2x} c:{:2x} d:{:2x} e:{:2x} \
                       f:{:2x} h:{:2x} l:{:2x} pc:{:4x} sp:{:4x} \
                       ime:{} halt:{} stop:{}",
               r.a, r.b, r.c, r.d, r.e, r.f, r.h, r.l, r.pc, r.sp,
               r.ime, r.halt, r.stop);
    }
}

impl fmt::Signed for Registers {
    fn fmt(r: &Registers, f: &mut fmt::Formatter) {
        write!(f.buf, "a:{} b:{} c:{} d:{} e:{} \
                       f:{} h:{} l:{} pc:{} sp:{}",
               r.a, r.b, r.c, r.d, r.e, r.f, r.h, r.l, r.pc, r.sp);
    }
}

#[cfg(test)]
mod test {
    use super::Registers;
    use GB = gb::GameBoy;

    #[test]
    fn init_values() {
        let regs = Registers::new(GB);

        assert_eq!(regs.a, 0x01);
        assert_eq!(regs.f, 0xb0);
        assert_eq!(regs.b, 0x00);
        assert_eq!(regs.c, 0x13);
        assert_eq!(regs.d, 0x00);
        assert_eq!(regs.e, 0xd8);
        assert_eq!(regs.h, 0x01);
        assert_eq!(regs.l, 0x4d);

        assert_eq!(regs.pc, 0x100);
        assert_eq!(regs.sp, 0xfffe);
    }
}
