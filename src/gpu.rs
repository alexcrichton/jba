static VRAM_SIZE: uint = 8 << 10; // 8K
static OAM_SIZE: uint = 0xa0;     // 0xffe00 - 0xffe9f is OAM

pub struct Gpu {
    vram: [u8, ..VRAM_SIZE],
    oam: [u8, ..OAM_SIZE],
}

#[allow(unused_variable)]
impl Gpu {
    pub fn new() -> Gpu {
        Gpu {
            vram: [0, ..VRAM_SIZE],
            oam: [0, ..OAM_SIZE],
        }
    }
    pub fn rb(&self, addr: u16) -> u8 { fail!() }
    pub fn wb(&mut self, addr: u16, val: u8) { fail!() }
    pub fn update_tile(&mut self, addr: u16) { fail!() }
}
