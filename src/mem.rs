//! Represents the Memory Management Unit (MMU) for the GB
//!
//! This houses the logic for reading/writing to memory and managing the
//! Memory Bank Controller (MBC) logic.
//!
//! For more information about how these work, see this url:
//!     http://nocash.emubase.de/pandocs.htm#memorybankcontrollers

use gpu;
use input;
use rtc;
use timer;

static RAM_SIZE: uint = 32 << 10;  // 32 K max on MBC3, 8 KB * 4 banks
static WRAM_SIZE: uint = 32 << 10; // CGB has 32K (8 banks * 4 KB/bank), GB has 8K
static HIRAM_SIZE: uint = 0x7f;    // hiram is from 0xff80 - 0xfffe

pub struct Memory {
    /// Interrupt flags, http://nocash.emubase.de/pandocs.htm#interrupts.
    /// The master enable flag is on the cpu
    if_: u8,
    ie_: u8,

    /// Flag if this cartridge uses a battery or not
    priv battery: bool,
    /// Flag if this is a CGB cartridge or not
    priv cgb: bool,
    /// Flag if this is a SGB cartridge or not
    priv sgb: bool,

    priv rom: ~[u8],
    priv ram: [u8, ..RAM_SIZE],
    priv wram: [u8, ..WRAM_SIZE],
    priv hiram: [u8, ..HIRAM_SIZE],
    /// The number of the rom bank currently swapped in
    priv rombank: u8,
    /// The number of the ram bank currently swapped in
    priv rambank: u8,
    /// The number of the wram bank currently swapped in
    priv wrambank: u8,
    /// A flag whether ram is enabled or not.
    priv ramon: bool,
    /// Flag whether in ROM banking (0) or RAM banking mode
    priv mode: bool,
    /// MBC of the current cartridge,
    priv mbc: Mbc,

    // Owned components
    rtc: rtc::Rtc,
    input: input::Input,
    timer: timer::Timer,
    gpu: gpu::Gpu,
}

#[deriving(Eq)]
enum Mbc {
    Unknown,
    Omitted,
    Mbc1,
    Mbc2,
    Mbc3,
}

impl Memory {
    pub fn new() -> Memory {
        Memory {
            if_: 0, ie_: 0, battery: false, cgb: false, sgb: false,
            rom: ~[], ram: [0, ..RAM_SIZE], wram: [0, ..WRAM_SIZE],
            hiram: [0, ..HIRAM_SIZE], rombank: 1, rambank: 0, wrambank: 1,
            ramon: false, mode: false, mbc: Unknown,

            rtc: rtc::Rtc::new(),
            input: input::Input::new(),
            timer: timer::Timer::new(),
            gpu: gpu::Gpu::new(),
        }
    }

    pub fn reset(&mut self) {
        *self = Memory::new();
    }

    /// Returns the cartridge's listed amount of ram that it should have. This
    /// doesn't represent the actual size of the ram array internally, but just
    /// to what extent the cartridge will use it.
    pub fn ram_size(&self) -> uint {
        // See http://nocash.emubase.de/pandocs.htm#thecartridgeheader
        match self.rom[0x149] {
            0x00 =>  0,
            0x01 =>  2 << 10, // 2KB
            0x02 =>  8 << 10, // 8KB
            0x03 => 32 << 10, // 32KB
            _ => { dfail!("Unknown ram size"); 0 }
        }
    }

    pub fn power_on(&mut self) {
        // See http://nocash.emubase.de/pandocs.htm#powerupsequence
        self.wb(0xff05, 0x00); // TIMA
        self.wb(0xff06, 0x00); // TMA
        self.wb(0xff07, 0x00); // TAC
        self.wb(0xff10, 0x80); // NR10
        self.wb(0xff11, 0xbf); // NR11
        self.wb(0xff12, 0xf3); // NR12
        self.wb(0xff14, 0xbf); // NR14
        self.wb(0xff16, 0x3f); // NR21
        self.wb(0xff17, 0x00); // NR22
        self.wb(0xff19, 0xbf); // NR24
        self.wb(0xff1a, 0x7f); // NR30
        self.wb(0xff1b, 0xff); // NR31
        self.wb(0xff1c, 0x9F); // NR32
        self.wb(0xff1e, 0xbf); // NR33
        self.wb(0xff20, 0xff); // NR41
        self.wb(0xff21, 0x00); // NR42
        self.wb(0xff22, 0x00); // NR43
        self.wb(0xff23, 0xbf); // NR30
        self.wb(0xff24, 0x77); // NR50
        self.wb(0xff25, 0xf3); // NR51
        self.wb(0xff26, 0xf1); // NR52
        self.wb(0xff40, 0x91); // LCDC
        self.wb(0xff42, 0x00); // SCY
        self.wb(0xff43, 0x00); // SCX
        self.wb(0xff45, 0x00); // LYC
        self.wb(0xff47, 0xfc); // BGP
        self.wb(0xff48, 0xff); // OBP0
        self.wb(0xff49, 0xff); // OBP1
        self.wb(0xff4a, 0x00); // WY
        self.wb(0xff4b, 0x00); // WX
        self.wb(0xffff, 0x00); // IE
    }

    /// Loads a string of data as a cartridge into this memory. The data
    /// provided will be used as ROM.
    pub fn load_cartridge(&mut self, rom: ~[u8]) {
        self.rom = rom;
        // See http://nocash.emubase.de/pandocs.htm#thecartridgeheader for
        // header information.

        self.battery = true;
        self.mbc = Unknown;
        match self.rom[0x0147] {
            0x00 |      // rom only
            0x08 => {   // rom + ram
                self.battery = false;
                self.mbc = Omitted;
            }

            0x09 => {   // rom + ram + battery
                self.mbc = Omitted;
            }

            0x01 |      // rom + mbc1
            0x02 => {   // rom + mbc1 + ram
                self.battery = false;
                self.mbc = Mbc1;
            }
            0x03 => {   // rom + mbc1 + ram + batt
                self.mbc = Mbc1;
            }

            0x05 => {   // rom + mbc2
                self.battery = false;
                self.mbc = Mbc2;
            }
            0x06 => {   // rom + mbc2 + batt
                self.mbc = Mbc2;
            }

            0x11 |      // rom + mbc3
            0x12 => {   // rom + mbc3 + ram
                self.battery = false;
                self.mbc = Mbc3;
            }
            0x0f |      // rom + mbc3 + timer + batt
            0x10 |      // rom + mbc3 + timer + ram + batt
            0x13 => {   // rom + mbc3 + ram + batt
                self.mbc = Mbc3;
            }

            _ => { fail!("unknown cartridge inserted: {:x}", self.rom[0x0147]); }
        }

        self.cgb = self.rom[0x0143] & 0x80 == 0x80;
        self.sgb = self.rom[0x0146] == 0x03;
    }

    /// Reads a word at the given address (2 bytes)
    pub fn rw(&self, addr: u16) -> u16 {
        (self.rb(addr) as u16) | ((self.rb(addr + 1) as u16) << 8)
    }

    /// Writes a word at the given address (2 bytes)
    pub fn ww(&mut self, addr: u16, val: u16) {
        self.wb(addr, val as u8);
        self.wb(addr + 1, (val >> 8) as u8);
    }

    /// Reads a byte at the given address
    pub fn rb(&self, addr: u16) -> u8 {
        // More information about mappings can be found online at
        //      http://nocash.emubase.de/pandocs.htm#memorymap
        match addr >> 12 {
            // Always mapped in as first bank of cartridge
            0x0 | 0x1 | 0x2 | 0x3 => self.rom[addr],

            // Swappable banks of ROM, there may be a total of more than 2^16
            // bytes in the ROM, so we use u32 here.
            0x4 | 0x5 | 0x6 | 0x7 => {
                self.rom[((self.rombank as u32) << 14) |
                         ((addr as u32) & 0x3fff)]
            }

            0x8 | 0x9 => self.gpu.vram[addr & 0x1fff],

            0xa | 0xb => {
                // Swappable banks of RAM
                if self.ramon {
                    if self.rtc.current & 0x08 != 0{
                        self.rtc.regs[self.rtc.current & 0x7]
                    } else {
                        self.ram[((self.rambank as u16) << 12) | (addr & 0x1fff)]
                    }
                } else {
                    0xff
                }
            }

            // e000-fdff same as c000-ddff
            0xe | 0xc => self.wram[addr & 0xfff],
            0xd => self.wram[((self.wrambank as u16) << 12) | (addr & 0xfff)],

            0xf => {
                if addr < 0xfe00 { // mirrored RAM
                    self.rb(addr & 0xdfff)
                } else if addr < 0xfea0 { // sprite attribute table (oam)
                    self.gpu.oam[addr & 0xff]
                } else if addr < 0xff00 { // unusable ram
                    0xff
                } else if addr < 0xff80 { // I/O ports
                    self.ioreg_rb(addr)
                } else if addr < 0xffff { // High RAM
                    self.hiram[addr & 0x7f]
                } else {
                    self.ie_
                }
            }

            _ => { dfail!(); 0 }
        }
    }

    /// Reads a value from a known IO type register
    fn ioreg_rb(&self, addr: u16) -> u8 {
        match (addr >> 4) & 0xf {
            // joypad data, http://nocash.emubase.de/pandocs.htm#joypadinput
            // interrupts, http://nocash.emubase.de/pandocs.htm#interrupts
            // timer, http://nocash.emubase.de/pandocs.htm#timeranddividerregisters
            //
            // TODO: serial data transfer
            // http://nocash.emubase.de/pandocs.htm#serialdatatransferlinkcable
            0x0 => {
                match addr & 0xf {
                    0x0 => self.input.rb(addr),
                    0x4 => self.timer.div,
                    0x5 => self.timer.tima,
                    0x6 => self.timer.tma,
                    0x7 => self.timer.tac,
                    0xf => self.if_,

                    _ => 0xff,
                }
            }

            // Sound info: http://nocash.emubase.de/pandocs.htm#soundcontroller
            0x1 | 0x2 | 0x3 => 0xff,

            0x4 => {
                if self.cgb && addr == 0xff4d {
                    dfail!("can't double speed yet");
                }
                self.gpu.rb(addr)
            }
            0x5 | 0x6 => self.gpu.rb(addr),

            0x7 => {
                if self.cgb && addr == 0xff70 {
                    self.wrambank as u8
                } else {
                    dfail!(); 0xff
                }
            }

            _ => { dfail!(); 0xff }
        }
    }

    /// Writes a byte at the given address
    pub fn wb(&mut self, addr: u16, val: u8) {
        // More information about mappings can be found online at
        //      http://nocash.emubase.de/pandocs.htm#memorymap
        match addr >> 12 {
            0x0 | 0x1 => {
                match self.mbc {
                    Mbc1 | Mbc3 => {
                        self.ramon = val & 0xf == 0xa;
                    }
                    Mbc2 => {
                        if addr & 0x100 == 0 {
                            self.ramon = !self.ramon;
                        }
                    }
                    _ => {}
                }
            }

            0x2 | 0x3 => {
                match self.mbc {
                    Mbc1 => {
                        self.rombank = (self.rombank & 0x60) | (val & 0x1f);
                        if self.rombank == 0 {
                            self.rombank = 1;
                        }
                    }
                    Mbc2 => {
                        if addr & 0x100 != 0 {
                            self.rombank = val & 0xf;
                        }
                    }
                    Mbc3 => {
                        let val = val & 0x7f;
                        self.rombank = val + if val != 0 {0} else {1};
                    }
                    _ => {}
                }
            }

            0x4 | 0x5 => {
                match self.mbc {
                    Mbc1 => {
                        if !self.mode { // ROM banking mode
                            self.rombank = (self.rombank & 0x1f) |
                                           ((val & 0x3) << 5);
                        } else { // RAM banking mode
                            self.rambank = val & 0x3;
                        }
                    }
                    Mbc3 => {
                        self.rtc.current = val & 0xf;
                        self.rambank = val & 0x3
                    }
                    _ => {}
                }
            }

            0x6 | 0x7 => {
                match self.mbc {
                    Mbc1 => {
                        self.mode = val & 0x1 != 0;
                    }
                    Mbc3 => {
                        self.rtc.latch(val);
                    }
                    _ => {}
                }
            }

            0x8 | 0x9 => {
                self.gpu.vram[addr & 0x1fff] = val;
                if addr < 0x9800 {
                    self.gpu.update_tile(addr);
                }
            }

            0xa | 0xb => {
                if self.ramon {
                    if self.rtc.current & 0x8 != 0 {
                        self.rtc.wb(addr, val);
                    } else {
                        let val = if self.mbc == Mbc2 {val & 0xf} else {val};
                        self.ram[((self.rambank as u16) << 12) |
                                 (addr & 0x1fff)] = val;
                    }
                }
            }

            0xc | 0xe => { self.wram[addr & 0xfff] = val; }
            0xd => {
                self.wram[((self.wrambank as u16) << 12) | (addr & 0xfff)] = val;
            }

            0xf => {
                if addr < 0xfe00 {
                    self.wb(addr & 0xdfff, val); // mirrored RAM
                } else if addr < 0xfea0 {
                    self.gpu.oam[addr & 0xff] = val;
                } else if addr < 0xff00 {
                    // unusable ram
                } else if addr < 0xff80 {
                    self.ioreg_wb(addr, val);
                } else if addr < 0xffff {
                    self.hiram[addr & 0x7f] = val;
                } else {
                    self.ie_ = val;
                }
            }

            _ => dfail!()
        }
    }

    fn ioreg_wb(&mut self, addr: u16, val: u8) {
        match (addr >> 4) & 0xf {
            // TODO: serial data transfer
            // http://nocash.emubase.de/pandocs.htm#serialdatatransferlinkcable
            0x0 => {
                match addr & 0xf {
                    0x0 => self.input.wb(addr, val),
                    0x4 => { self.timer.div = 0; }
                    0x5 => { self.timer.tima = val; }
                    0x6 => { self.timer.tma = val; }
                    0x7 => {
                        self.timer.tac = val;
                        self.timer.update();
                    }
                    0xf => { self.if_ = val; }
                    _ => {}
                }
            }

            // Sound info: http://nocash.emubase.de/pandocs.htm#soundcontroller
            // TODO: sound registers
            0x1 | 0x2 | 0x3 => {}

            0x4 => {
                // See http://nocash.emubase.de/pandocs.htm#cgbregisters
                if self.cgb && addr == 0xff4d {
                    dfail!("can't go double speed just yet");
                }
                self.gpu.wb(addr, val);
            }

            // WRAM banks only for CGB mode, see
            //      http://nocash.emubase.de/pandocs.htm#cgbregisters
            0x7 => {
                if self.cgb && addr == 0xff70 {
                    let val = val & 0x7; /* only bits 0-2 are used */
                    self.wrambank = if val != 0 {val} else {1};
                }
            }

            _ => { dfail!("unimplemented address {:x}", addr); }
        }
    }
}

#[cfg(test)]
mod test {
    use std::vec;
    use super::Memory;

    #[test]
    fn mirroring() {
        let mut mem = Memory::new();
        mem.wb(0xcae0, 0x31);
        assert_eq!(mem.rb(0xcae0), 0x31);
        assert_eq!(mem.rb(0xeae0), 0x31);

        mem.wb(0xd032, 0x32);
        assert_eq!(mem.rb(0xd032), 0x32);
        assert_eq!(mem.rb(0xf032), 0x32);

        mem.wb(0xe8a9, 0x33);
        assert_eq!(mem.rb(0xe8a9), 0x33);
        assert_eq!(mem.rb(0xc8a9), 0x33);
    }

    #[test]
    fn hiram() {
        let mut mem = Memory::new();
        mem.wb(0xff89, 0x78);
        assert_eq!(mem.rb(0xff89), 0x78);

        mem.wb(0xfff3, 0x83);
        assert_eq!(mem.rb(0xfff3), 0x83);
    }

    #[test]
    fn vram() {
        let mut mem = Memory::new();
        mem.wb(0xc089, 0x78);
        assert_eq!(mem.rb(0xc089), 0x78);

        mem.wb(0xd5f3, 0x83);
        assert_eq!(mem.rb(0xd5f3), 0x83);
    }

    #[test]
    fn oam() {
        let mut mem = Memory::new();
        mem.wb(0xfe03, 0x32);
        assert_eq!(mem.rb(0xfe03), 0x32);

        mem.wb(0xfe9f, 0x33);
        assert_eq!(mem.rb(0xfe9f), 0x33);
    }

    // 0xc000-0xcfff is wram bank 0
    // 0xd000-0xdfff is wram bank 1 (switchable 1-7 if CGB)
    #[test]
    fn wram_banks() {
        let mut mem = Memory::new();
        /* If not CGB, don't swap out banks */
        mem.cgb = false;
        mem.wb(0xff70, 0x01);
        mem.wb(0xd000, 0x54);
        mem.wb(0xff70, 0x02); /* if CGB, would switch banks */
        assert_eq!(mem.rb(0xd000), 0x54);

        mem.cgb = true;
        mem.wb(0xff70, 0x02); /* now switch WRAM banks */
        assert_eq!(mem.rb(0xd000), 0x00);

        mem.wb(0xff70, 0x01); /* back to first bank */
        assert_eq!(mem.rb(0xd000), 0x54);

        /* make sure bank 0 is never visible in 0xd000 */
        mem.wb(0xc000, 0x23);
        mem.wb(0xff70, 0x00);
        assert_eq!(mem.rb(0xd000), 0x54);
    }

    macro_rules! load( ($($k:expr => $v:expr),+) => ({
        let mut m = Memory::new();
        let mut ram = vec::from_elem(0x1000000, 0u8);
        $(ram[$k] = $v;)+
        m.load_cartridge(ram);
        m
    }) )

    #[test]
    fn nombc_rom() {
        let mem = load!(
            0x0147 => 0x00,
            0x2283 => 0x31,
            0x0998 => 0x29,
            0x7fff => 0x24
        );
        assert_eq!(mem.mbc, super::Omitted);

        assert_eq!(mem.rb(0x2283), 0x31);
        assert_eq!(mem.rb(0x0998), 0x29);
        assert_eq!(mem.rb(0x7fff), 0x24);
    }

    #[test]
    fn nombc_ram() {
        let mut mem = load!(
            0x0147 => 0x00
        );
        assert_eq!(mem.mbc, super::Omitted);

        mem.ramon = true;
        assert_eq!(mem.rb(0xa042), 0x00);

        mem.wb(0xa042, 0xa3);
        assert_eq!(mem.rb(0xa042), 0xa3);

        mem.ww(0xa042, 0xdead);
        assert_eq!(mem.rw(0xa042), 0xdead);
    }

    #[test]
    fn mbc1_rom() {
        let mem = load!(
            0x0147 => 0x01,
            0x2283 => 0x31,
            0x0998 => 0x28,
            0x7fff => 0x24
        );
        assert_eq!(mem.mbc, super::Mbc1);

        assert_eq!(mem.rb(0x2283), 0x31);
        assert_eq!(mem.rb(0x998), 0x28);
        assert_eq!(mem.rb(0x7fff), 0x24);
    }

    #[test]
    fn mbc1_rom_pages() {
        let mut mem = load!(
            0x0147 => 0x01,
            0x80f3 => 0x24,
            0xd0e8 => 0x25
        );
        assert_eq!(mem.mbc, super::Mbc1);

        mem.wb(0x2001, 0x02); // Trigger the 2nd rom page
        assert_eq!(mem.rb(0x40f3), 0x24);

        mem.wb(0x2001, 0x03); // Trigger the 3rd rom page
        assert_eq!(mem.rb(0x50e8), 0x25);

        mem.wb(0x2001, 0xe2); // Ignore the upper bits
        assert_eq!(mem.rb(0x40f3), 0x24);
    }

    #[test]
    fn mbc1_ram_disabled() {
        let mut mem = load!(0x0147 => 0x01);
        assert_eq!(mem.mbc, super::Mbc1);
        mem.wb(0xa032, 0x24);
        assert_eq!(mem.rb(0xa032), 0xff);

        mem.wb(0x0032, 0x0e); // Must have lower 4 bits 0xa
        mem.wb(0xa032, 0x24);
        assert_eq!(mem.rb(0xa032), 0xff);

        mem.wb(0x0032, 0xa); // Must have lower 4 bits 0xa
        mem.wb(0xa032, 0x24);
        assert_eq!(mem.rb(0xa032), 0x24);
    }

    #[test]
    fn mbc1_read_hiram() {
        let mut mem = load!(0x0147 => 0x01);
        assert_eq!(mem.mbc, super::Mbc1);
        mem.ramon = true;
        assert_eq!(mem.rb(0xa042), 0x00);

        mem.wb(0xa042, 0xa3);
        assert_eq!(mem.rb(0xa042), 0xa3);

        mem.ww(0xa042, 0xdead);
        assert_eq!(mem.rw(0xa042), 0xdead);
    }

    #[test]
    fn mbc1_ram_banks() {
        let mut mem = load!(0x0147 => 0x01);
        assert_eq!(mem.mbc, super::Mbc1);
        mem.wb(0x0000, 0xa); // enable ram
        mem.wb(0x6000, 0x1); // enable ram bank selection mode

        mem.wb(0xa042, 0xa3);
        assert_eq!(mem.rb(0xa042), 0xa3);

        mem.wb(0x4000, 0x2); // switch to second bank
        assert_eq!(mem.rb(0xa042), 0x0);
        mem.wb(0xa043, 0xbe);
        assert_eq!(mem.rb(0xa043), 0xbe);

        mem.wb(0x4000, 0x0); // back to zeroth bank
        assert_eq!(mem.rb(0xa042), 0xa3);
        mem.wb(0x4000, 0x2); // back to second bank
        assert_eq!(mem.rb(0xa043), 0xbe);

        // Only uses lower 2 bits
        mem.wb(0x4000, 0xfc);
        assert_eq!(mem.rb(0xa042), 0xa3);
        mem.wb(0x4000, 0xfe);
        assert_eq!(mem.rb(0xa043), 0xbe);
    }

    #[test]
    fn mbc1_switch_high_ram() {
        // low 14 bits are address into bank
        // low 5 bits of bank address set via 0x2000-0x3fff
        // high 2 bits of bank address set via 0x4000-0x5fff
        // = 21 bits total
        let mut mem = load!(
            0x0147 => 0x01,
            (0x2 << 19) | (0x14 << 14) | 0x0eef => 0x43,
            (0x1 << 19) | (0x05 << 14) | 0x1bc4 => 0x78
        );
        assert_eq!(mem.mbc, super::Mbc1);

        mem.wb(0x2000, 0xf4); // low 5 bits, making sure extra chopped off
        mem.wb(0x4000, 0xfe); // high 2 bits, making sure extra chopped off

        assert_eq!(mem.rb(0x4eef), 0x43);

        mem.wb(0x2000, 0x05); // low 5 bits
        mem.wb(0x4000, 0x01); // high 2 bits

        assert_eq!(mem.rb(0x5bc4), 0x78);
    }

    #[test]
    fn mbc2_read_rom() {
        let mem = load!(
            0x0147 => 0x05,
            0x2283 => 0x31,
            0x0998 => 0x28,
            0x7fff => 0x24
        );
        assert_eq!(mem.mbc, super::Mbc2);

        assert_eq!(mem.rb(0x2283), 0x31);
        assert_eq!(mem.rb(0x998), 0x28);
        assert_eq!(mem.rb(0x7fff), 0x24);
    }

    #[test]
    fn mbc2_write_lower_4_bits() {
        let mut mem = load!(0x0147 => 0x05);
        assert_eq!(mem.mbc, super::Mbc2);

        mem.ramon = true;
        assert_eq!(mem.rb(0xa042), 0x00);

        mem.wb(0xa042, 0xa3);
        assert_eq!(mem.rb(0xa042), 0x3);

        mem.ww(0xa042, 0xdead);
        assert_eq!(mem.rw(0xa042), 0x0e0d);
    }

    #[test]
    fn mbc2_toggles_ram_operation() {
        let mut mem = load!(0x0147 => 0x05);
        assert_eq!(mem.mbc, super::Mbc2);

        mem.ramon = false;
        mem.wb(0x0000, 0x42);
        assert!(mem.ramon);

        mem.wb(0x0100, 0x42);
        assert!(mem.ramon);

        mem.wb(0x0200, 0x42);
        assert!(!mem.ramon);

        mem.wb(0x0300, 0x42);
        assert!(!mem.ramon);
    }

    #[test]
    fn mbc2_select_bank_number() {
        let mut mem = load!(
            0x0147 => 0x05,
            0xd429 => 0x28,
            0x8094 => 0x24,
            0x74ae => 0x27
        );
        assert_eq!(mem.mbc, super::Mbc2);

        assert_eq!(mem.rb(0x74ae), 0x27);

        mem.wb(0x2100, 0xf2); // switch to the second bank
        assert_eq!(mem.rb(0x4094), 0x24);
        mem.wb(0x2000, 0xf0); // make sure bank switch ignored
        assert_eq!(mem.rb(0x4094), 0x24);

        mem.wb(0x2100, 0xf3); // switch to the third bank
        assert_eq!(mem.rb(0x5429), 0x28);
    }

    #[test]
    fn mbc3_switching_rom_banks() {
        let mut mem = load!(
            0x0147 => 0x0f,
            0x7ffe => 0x90,
            0x8024 => 0x94,
            0xd428 => 0x91,
            0x1fe3ea => 0x28
        );
        assert_eq!(mem.mbc, super::Mbc3);

        assert_eq!(mem.rb(0x7ffe), 0x90);

        mem.wb(0x2000, 0x2); // enable the 2nd rom bank
        assert_eq!(mem.rb(0x4024), 0x94);

        mem.wb(0x2000, 0x3); // enable the 3rd rom bank
        assert_eq!(mem.rb(0x5428), 0x91);

        mem.wb(0x2000, 0xff); // enable the 256th rom bank
        assert_eq!(mem.rb(0x63ea), 0x28);
    }

    #[test]
    fn mbc3_read_rtc() {
        let mut mem = load!(0x0147 => 0x0f);
        assert_eq!(mem.mbc, super::Mbc3);

        mem.wb(0x0000, 0xa); // enable ram

        mem.rtc.regs[0] = 0x34;
        mem.wb(0x4000, 0x8);
        assert_eq!(mem.rb(0xa000), 0x34);

        mem.rtc.regs[4] = 0x33;
        mem.wb(0x4000, 0xc);
        assert_eq!(mem.rb(0xa000), 0x33);
    }

    #[test]
    fn mbc3_swapping_ram_banks() {
        let mut mem = load!(0x0147 => 0x0f);
        assert_eq!(mem.mbc, super::Mbc3);

        mem.wb(0x0000, 0xa); // enable ram

        mem.wb(0x4000, 0x3);
        mem.wb(0xa000, 0x42);
        assert_eq!(mem.rb(0xa000), 0x42);

        mem.wb(0x4000, 0x0);
        mem.wb(0xa000, 0x41);
        assert_eq!(mem.rb(0xa000), 0x41);

        mem.wb(0x4000, 0x3);
        assert_eq!(mem.rb(0xa000), 0x42);
    }
}

