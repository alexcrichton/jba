pub struct Memory {
    a: int,
    if_: uint,
    ie_: uint,
}

impl Memory {
    pub fn rb(&self, addr: u16) -> u8 { addr as u8 }
    pub fn wb(&self, _addr: u16, _val: u8) { }
}
