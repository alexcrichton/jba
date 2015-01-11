//! Real Time Clock (RTC) for GB

pub struct Rtc {
    pub current: u8,
    pub regs: [u8; 8],

    s: u8,
    m: u8,
    h: u8,
    d: u16,
    t: u8,
    carry: u8,
    stop: u8,
    readylatch: bool,
}

impl Rtc {
    pub fn new() -> Rtc {
        Rtc {
            s: 0, m: 0, h: 0, d: 0, t: 0, carry: 0, current: 0,
            regs: [0; 8], stop: 0, readylatch: false,
        }
    }

    pub fn latch(&mut self, value: u8) {
        if self.readylatch {
            if value == 1 {
                self.regs[0] = self.s;
                self.regs[1] = self.m;
                self.regs[2] = self.h;
                self.regs[3] = self.d as u8;
                self.regs[4] = ((self.d >> 8) as u8) | (self.stop << 6) |
                               (self.carry << 7);
                self.regs[5] = 0xff;
                self.regs[6] = 0xff;
                self.regs[7] = 0xff;
            }
            self.readylatch = false;
        } else {
            self.readylatch = if value == 0 {true} else {false};
        }
    }

    pub fn wb(&mut self, _addr: u16, value: u8) {
        match self.current & 0x7 {
            0 => { self.s = value % 60; self.regs[0] = self.s; }
            1 => { self.m = value % 60; self.regs[1] = self.m; }
            2 => { self.h = value % 24; self.regs[2] = self.h; }
            3 => {
                self.regs[3] = value;
                self.d = (self.d & 0x100) | (value as u16);
            }
            4 => {
                self.regs[4] = value;
                self.d = (self.d & 0xff) | (((value as u16) & 1) << 8);
                self.stop = (value >> 6) & 1;
                self.carry = (value >> 7) & 1;
            }
            _ => {}
        }
    }

    #[allow(dead_code)]
    pub fn step(&mut self) {
        if self.stop != 0 { return }

        self.t += 1;
        if self.t >= 60 {
            self.s += 1;
            if self.s >= 60 {
                self.m += 1;
                if self.m >= 60 {
                    self.d += 1;
                    if self.d >= 365 {
                        self.d = 0;
                        self.carry = 1;
                    }
                    self.m = 0;
                }
                self.s = 0;
            }
            self.t = 0;
        }
    }
}

#[cfg(test)]
mod test {
    use super::Rtc;
    #[test]
    fn latching_values() {
        let mut rtc = Rtc::new();

        rtc.s = 0x20;
        rtc.h = 0x10;
        rtc.m = 0x08;
        rtc.d = 0x49;
        rtc.carry = 1;
        rtc.stop = 0;

        // Initially 0, no latching
        rtc.latch(0);
        for i in range(0, 8) {
            assert_eq!(rtc.regs[i], 0x00);
        }

        // Random number, still no latching
        rtc.latch(0x10);
        for i in range(0, 8) {
            assert_eq!(rtc.regs[i], 0x00);
        }

        // Actually do the latching
        rtc.latch(0);
        rtc.latch(1);

        assert_eq!(rtc.regs[0], 0x20);
        assert_eq!(rtc.regs[1], 0x08);
        assert_eq!(rtc.regs[2], 0x10);
        assert_eq!(rtc.regs[3], 0x49);
        assert_eq!(rtc.regs[4], 0x80);
        assert_eq!(rtc.regs[5], 0xff);
        assert_eq!(rtc.regs[6], 0xff);
        assert_eq!(rtc.regs[7], 0xff);

        rtc.stop = 1;
        rtc.d    = 0x1ff;

        rtc.latch(0);
        rtc.latch(1);

        assert_eq!(rtc.regs[3], 0xff);
        assert_eq!(rtc.regs[4], 0xc1);
    }

    #[test]
    fn test_writing_values() {
        let mut rtc = Rtc::new();
        rtc.current = 0x8;
        rtc.wb(0, 0x22);
        assert_eq!(rtc.s, 0x22);
        assert_eq!(rtc.regs[0], 0x22);

        rtc.current = 0x9;
        rtc.wb(0, 65);
        assert_eq!(rtc.m, 5);
        assert_eq!(rtc.regs[1], 5);

        rtc.current = 0xa;
        rtc.wb(0, 25);
        assert_eq!(rtc.h, 1);
        assert_eq!(rtc.regs[2], 1);

        rtc.current = 0xb;
        rtc.wb(0, 0xff);
        assert_eq!(rtc.d, 0xff);
        assert_eq!(rtc.regs[3], 0xff);

        rtc.d = 0x100;
        rtc.wb(0, 0xae);
        assert_eq!(rtc.d, 0x1ae);
        assert_eq!(rtc.regs[3], 0xae);

        rtc.current = 0xc;
        rtc.wb(0, 0xc1);
        assert_eq!(rtc.d & 0x100, 0x100);
        assert_eq!(rtc.carry, 1);
        assert_eq!(rtc.stop, 1);

        rtc.wb(0, 0x80);
        assert_eq!(rtc.d & 0x100, 0);
        assert_eq!(rtc.carry, 1);
        assert_eq!(rtc.stop, 0);
    }

}
