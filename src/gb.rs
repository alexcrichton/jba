use std::mem;

use cpu::Cpu;
use input;
use mem::Memory;

pub use self::Target::{GameBoy, GameBoyColor, SuperGameBoy};

#[derive(PartialEq, Eq, Copy)]
pub enum Target {
    GameBoy,
    GameBoyColor,
    SuperGameBoy,
}

pub struct Gb {
    cpu: Cpu,
    mem: Memory,
    fps: u32,
    cycles: u32,
}

impl Gb {
    pub fn new(target: Target) -> Gb {
        let mut gb = Gb {
            mem: Memory::new(target),
            cpu: Cpu::new(target),
            fps: 0,
            cycles: 0,
        };
        gb.mem.power_on();
        return gb;
    }

    pub fn load(&mut self, rom: Vec<u8>) {
        self.mem.load_cartridge(rom);
    }

    pub fn frame(&mut self) {
        // http://imrannazar.com/GameBoy-Emulation-in-JavaScript:-GPU-Timings
        // for the timing for this constant
        self.cycles += 70224;

        while self.cycles <= 70224 {
            let time = self.cpu.exec(&mut self.mem);
            self.mem.timer.step(time, &mut self.mem.if_, self.mem.speed);
            self.mem.gpu.step(time, &mut self.mem.if_);
            self.cycles -= time;
        }

        self.fps += 1;
    }

    pub fn image(&self) -> &[u8] {
        self.mem.gpu.image_data.as_slice()
    }

    pub fn frames(&mut self) -> u32 {
        mem::replace(&mut self.fps, 0)
    }

    pub fn keydown(&mut self, key: input::Button) {
        self.mem.input.keydown(key, &mut self.mem.if_);
    }

    pub fn keyup(&mut self, key: input::Button) {
        self.mem.input.keyup(key);
    }

    #[cfg(test)]
    pub fn test_done(&self) -> bool {
        !self.mem.sound_on && self.cpu.is_loopback(&self.mem)
    }
}
