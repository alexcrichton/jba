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
}

impl Registers {
    pub fn new() -> Registers {
        Registers {
            ime: 0, halt: 0, stop: 0,

            a: 0, b: 0, d: 0, h: 0, f: 0, c: 0, e: 0, l: 0,
            sp: 0, pc: 0,
        }
    }

    pub fn reset(&mut self) {
        self.ime = 0;
        self.halt = 0;
        self.stop = 0;

        // See: http://nocash.emubase.de/pandocs.htm#powerupsequence
        // We initialize A to 0x11 instead of 0x01 because we're emulating
        // CGB hardware and this is how the difference is detected
        self.a = 0x11;
        self.b = 0x00;
        self.d = 0x00;
        self.h = 0x01;
        self.f = 0xb0;
        self.c = 0x13;
        self.e = 0xd8;
        self.l = 0x4d;

        self.sp = 0xfffe;
        self.pc = 0x0100;
    }

    pub fn bump(&mut self) -> u16 {
        let ret = self.pc;
        self.pc += 1;
        return ret;
    }

    fn af(&self) -> u16 { ((self.a as u16) << 8) | (self.f as u16) }
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
}
