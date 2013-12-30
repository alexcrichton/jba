use mem;
use timer;

mod z80;

pub struct Cpu {
    priv regs: z80::Registers,
    priv ticks: uint,
}

pub enum Interrupts {
    IntVblank  = 0x01,
    IntLCDStat = 0x02,
    IntTimer   = 0x04,
    IntSerial  = 0x08,
    IntJoypad  = 0x10,
}

impl Cpu {
    pub fn new() -> Cpu {
        Cpu { regs: z80::Registers::new(), ticks: 0 }
    }

    pub fn reset(&mut self) {
        self.ticks = 0;
        self.regs.reset();
    }

    pub fn exec(&mut self, mem: &mut mem::Memory,
                timer: &mut timer::Timer) -> uint {
        // When the CPU halts, it simply goes into a "low power mode" that
        // doesn't execute any more instructions until an interrupt comes in.
        // Deferring until this interrupt happens is fairly difficult, so we
        // just don't execute any instructions. We simulate that the 'nop'
        // instruction continuously happens until an interrupt comes in which
        // will disable the halt flag
        let ticks = if self.regs.halt == 0 {
            let instruction = mem.rb(self.regs.bump());
            z80::exec(instruction, &mut self.regs, mem)
        } else {
            1
        };

        let ticks = ticks * 4;

        // See http://nocash.emubase.de/pandocs.htm#interrupts
        if self.regs.ime != 0 {
            let ints = mem.if_ & mem.ie_;

            if ints != 0 {
            }
        }

        self.ticks += ticks;
        timer.step(ticks / 4, mem);
        return ticks;
    }
}
