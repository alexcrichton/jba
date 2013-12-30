pub struct Cpu {
    a: int,
}

pub enum Interrupts {
    IntVblank  = 0x01,
    IntLCDStat = 0x02,
    IntTimer   = 0x04,
    IntSerial  = 0x08,
    IntJoypad  = 0x10,
}

mod z80 {
    pub struct Registers {
        priv m: uint,
        priv ime: uint,
        priv halt: uint,
        priv stop: uint,

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
                m: 0, ime: 0, halt: 0, stop: 0,

                a: 0, b: 0, d: 0, h: 0, f: 0, c: 0, e: 0, l: 0,
                sp: 0, pc: 0,
            }
        }

        pub fn af(&self) -> u16 { ((self.a as u16) << 8) | (self.f as u16) }
        pub fn bc(&self) -> u16 { ((self.b as u16) << 8) | (self.c as u16) }
        pub fn de(&self) -> u16 { ((self.d as u16) << 8) | (self.e as u16) }
        pub fn hl(&self) -> u16 { ((self.h as u16) << 8) | (self.l as u16) }
    }
}
