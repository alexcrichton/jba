pub use cpu::z80::imp::exec;
pub use cpu::z80::daa::DAA_TABLE;

mod imp;
mod daa;

pub struct Registers {
    ime: uint,
    halt: uint,
    stop: uint,

    a: u8,
    b: u8,
    c: u8,
    d: u8,
    e: u8,
    f: u8,
    h: u8,
    l: u8,

    sp: u16,
    pc: u16,
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

    pub fn af(&self) -> u16 { ((self.a as u16) << 8) | (self.f as u16) }
    pub fn bc(&self) -> u16 { ((self.b as u16) << 8) | (self.c as u16) }
    pub fn de(&self) -> u16 { ((self.d as u16) << 8) | (self.e as u16) }
    pub fn hl(&self) -> u16 { ((self.h as u16) << 8) | (self.l as u16) }

    pub fn bump(&mut self) -> u16 {
        let ret = self.pc;
        self.pc += 1;
        return ret;
    }
}
