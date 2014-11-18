use gpu;
use input;

fn pack(a: u8, b: u8) -> u16 {
    ((a as u16) << 8) | (b as u16)
}

enum State {
    Default,
    Reset,
    Read,
}

pub struct Sgb {
    ram: [u8, ..0x1000],
    state: State,
    datai: uint,
    read: uint,
    packets: uint,
    byte: u8,
    bit: u8,
    command: u8,
    data: [u8, ..8 * 16],

    // The SGB has 8 palettes of 16 colors each. The first four are for the game
    // screen and the last four are for the border. We don't care about the
    // border. Also, only the first four colors of each palette is used to color
    // the game screen.
    //
    // This means that we need 4 palettes, each of 8 bytes (2 bytes per color).
    // This array provides the 32 bytes needed.
    //
    // Each element is one color (16 bits), and each quadruple is one palette.
    pal: [u16, ..16],
}

impl Sgb {
    pub fn new() -> Sgb {
        Sgb {
            ram: [0, ..0x1000],
            state: State::Default,
            packets: 0,
            datai: 0,
            byte: 0,
            read: 0,
            bit: 0,
            command: 0,
            data: [0, ..8 * 16],
            pal: [0, ..16],
        }
    }

    pub fn receive(&mut self, val: u8,
                   gpu: &mut gpu::Gpu,
                   input: &mut input::Input) {
        match self.state {
            State::Default => {
                if val == 0 {
                    self.state = State::Reset;
                    self.packets = 0;
                } else if val == 3 {
                    input.joypad_sel = (input.joypad_sel + 1) % 4;
                }
            }

            State::Reset => {
                if val == 3 {
                    self.state = State::Read;
                    if self.packets == 0 {
                        self.packets = 1;
                        self.datai = 0;
                    }
                    self.byte = 0;
                    self.read = 0;
                } else if val != 0 {
                    self.state = State::Default;
                }
            }

            State::Read => {
                if val == 0 {
                    self.state = State::Reset;
                    if self.datai == self.packets * 16 {
                        self.packets = 0;
                    }
                } else if val == 3 {
                    // we just received the reset bit
                    if self.read == 128 {
                        // Have we read all the packets?
                        if self.datai == self.packets * 16 {
                            self.process(gpu, input);
                            self.state = State::Default;

                        // We have to read another packet
                        } else {
                            self.read = 0;
                        }

                    // we just received a data bit!
                    } else {
                        self.byte |= self.bit << (self.read % 8);
                        self.read += 1;
                        if self.read % 8 == 0 {
                            if self.datai == 0 {
                                self.packets = (self.byte % 8) as uint;
                                self.command = self.byte / 8;
                            }
                            self.data[self.datai] = self.byte;
                            self.datai += 1;
                            self.byte = 0;
                        }
                    }
                } else {
                    self.bit = val & 1;
                }
            }
        }
    }

    fn process(&mut self, gpu: &mut gpu::Gpu, input: &mut input::Input) {
        // http://nocash.emubase.de/pandocs.htm#sgbfunctions

        match self.command {
            0x00 => self.update_pal(0, 1, gpu),
            0x01 => self.update_pal(2, 3, gpu),
            0x02 => self.update_pal(0, 3, gpu),
            0x03 => self.update_pal(1, 2, gpu),
            0x04 => self.attr_blk(gpu),
            0x0A => self.pal_set(gpu),
            0x0B => self.pal_trn(gpu),
            0x17 => self.mask_en(gpu),

            // Not really sure what this one does... Ignoring for now.
            0x0F => {} // DATA_SND SUPER NES WRAM Transfer 1

            0x11 => { input.joypad_sel = 0; } // MLT_REG Controller 2 Request

            // Ignore these because they have to do with rendering the
            // background which is currently not supported
            0x13 => {} // CHR_TRN Transfer Character Font Data
            0x14 => {} // PCT_TRN Set Screen Data Color Data

            0x05 => dpanic!(), // ATTR_LIN "Line" Area Designation Mode
            0x06 => dpanic!(), // ATTR_DIV "Divide" Area Designation Mode
            0x07 => dpanic!(), // ATTR_CHR "1CHR" Area Designation Mode
            0x08 => dpanic!(), // SOUND Sound On/Off
            0x09 => dpanic!(), // SOU_TRN Transfer Sound PRG/DATA
            0x0C => dpanic!(), // ATRC_EN Enable/disable Attraction Mode
            0x0D => dpanic!(), // TEST_EN Speed Function
            0x0E => dpanic!(), // ICON_EN SGB Function
            0x10 => dpanic!(), // DATA_TRN SUPER NES WRAM Transfer 2
            0x12 => dpanic!(), // JUMP Set SNES Program Counter
            0x15 => dpanic!(), // ATTR_TRN Set Attribute from ATF
            0x16 => dpanic!(), // ATTR_SET Set Data to ATF
            0x18 => dpanic!(), // OBJ_TRN Super NES OBJ Mode

            _ => dpanic!(),
        }
    }

    // Implements the PALXX commands received to the SGB. This function will
    // update the SGB palettes specified with the data provided in the packet
    // transfer.
    fn update_pal(&mut self, p1: uint, p2: uint, gpu: &mut gpu::Gpu) {
        // Color 0 specified applies to all palettes
        for i in range(0u, 4) {
            self.pal[i * 4] = pack(self.data[2], self.data[1]);
        }

        for i in range(1u, 3) {
            self.pal[p1 * 4 + i] = pack(self.data[1 + i * 2 + 1],
                                        self.data[1 + i * 2]);
        }
        for i in range(0u, 3) {
            self.pal[p2 * 4 + i] = pack(self.data[1 + (i + 4) * 2 + 1],
                                        self.data[1 + (i + 4) * 2]);
        }
        // recompile these palettes
        self.update_palettes(gpu);
    }

    // Implements the ATTR_BLK functionality from the SGB. This will define
    // regions of the attribute block to map to certain SGB palettes.
    //
    // The way this works is that there's a 20x18 block which describes all this.
    // Each element in this block corresponds to an 8x8 block on the GB screen.
    // All colors displayed on this 8x8 block on the GB screen are one of
    // four gray shades. Using this mapping:
    //
    // white -> color 0
    // light gray -> color 1
    // dark gray -> color 2
    // black -> color 3
    //
    // All colors are mapped through the corresponding palette in the SGB. This
    // adds color to the screen.
    //
    // There are only four palettes that modify the screen, and each of these
    // will have four colors (so each gray shade can map to a color).
    fn attr_blk(&mut self, gpu: &mut gpu::Gpu) {
        for i in range(0, self.data[1]) {
            // extract all data from what was received
            let off = 2 + (i as uint) * 6;
            let x1 = self.data[off + 2] as int;
            let y1 = self.data[off + 3] as int;
            let x2 = self.data[off + 4] as int;
            let y2 = self.data[off + 5] as int;
            let insideon = self.data[off] & 1 != 0;
            let borderon = self.data[off] & 2 != 0;
            let outsideon = self.data[off] & 4 != 0;

            let insidepal = self.data[off + 1] & 3;
            let borderpal = (self.data[off + 1] >> 2) & 3;
            let outsidepal = (self.data[off + 1] >> 4) & 3;

            // Apply to the attribute file for each block of data
            for y in range(0i, 18) {
                for x in range(0i, 20) {
                    if x > x1 && x < x2 && y > y1 && y < y2 {
                        if insideon {
                            gpu.sgb.atf[(y * 20 + x) as uint] = insidepal;
                        }
                    } else if x < x1 || x > x2 || y < y1 || y > y2 {
                        if outsideon {
                            gpu.sgb.atf[(y * 20 + x) as uint] = outsidepal;
                        }
                    } else if borderon {
                        gpu.sgb.atf[(y * 20 + x) as uint] = borderpal;
                    }
                }
            }
        }
    }

    // Implements the PAL_SET command received by the SGB. This command will set
    // the current four SGB palettes for the game based on the input given.
    // The data received is indices into the SGB VRAM
    fn pal_set(&mut self, gpu: &mut gpu::Gpu) {
        // Each tile in SGB RAM is 8 bytes (4 colors)
        let pali = [
            pack(self.data[2], self.data[1]) as uint * 8,
            pack(self.data[4], self.data[3]) as uint * 8,
            pack(self.data[6], self.data[5]) as uint * 8,
            pack(self.data[8], self.data[7]) as uint * 8,
        ];

        // i = palette number, j = color number (4 palettes, 4 colors)
        for i in range(0u, 4) {
            for j in range(0u, 4) {
                self.pal[i * 4 + j] = pack(self.ram[pali[i] + 2 * j + 1],
                                           self.ram[pali[i] + 2 * j]);
            }
        }

        // Not really sure what to do with this yet. Make sure we don't miss
        // any functionality by throwing an exception.
        if self.data[9] & 0x80 != 0 {
            dpanic!("unsure what an attribute file is just yet");
        }
        // Recompile the palettes
        self.update_palettes(gpu);
    }

    // Implements the MASK_EN command received to the SGB. This will be used in
    // toggling whether the screen should continue to be updated or not.
    fn mask_en(&mut self, gpu: &mut gpu::Gpu) {
        match self.data[1] {
            0 => { gpu.lcdon = true; }
            1 => { gpu.lcdon = false; }
            2 => { gpu.white(); }
            3 => { gpu.white(); }
            _ => {}
        }
    }

    // Implements the PAL_TRN request for the SGB. This will transfer data in
    // VRAM over into the SGB's own VRAM. This cached copy is then used later
    // for loading SGB palettes.
    fn pal_trn(&mut self, gpu: &mut gpu::Gpu) {
        // This is completely different from what's documented on the website,
        // but it's what's implemented in macboyadvance and it seems to work.
        let mapbase = gpu.bgbase();
        let patbase = if gpu.tiledata {0x0000} else {0x1000};
        let mut offset = 0;
        let mut sgboffset = 0;

        // Why 13x20? Talk to the macboyadvance people.
        for _ in range(0i, 13) {
            for _ in range(0i, 20) {
                let tilei = gpu.vram()[mapbase + offset];
                offset += 1;
                let tilei = gpu.add_tilei(0, tilei);
                for k in range(0u, 16) {
                    if sgboffset >= 4096 { break }
                    self.ram[sgboffset] = gpu.vram()[patbase + tilei * 16 + k];
                    sgboffset += 1;
                }
            }
            offset += 12;
        }
    }

    // Update the SGB palettes based on what's in memory. This only updates the
    // four relevant palettes with their first four colors because these are the
    // only ones that are used in colorizing the game screen.
    fn update_palettes(&self, gpu: &mut gpu::Gpu) {
        for i in range(0u, 4) {
            for j in range(0u, 4) {
                let color = self.pal[i * 4 + j];
                gpu.sgb.pal[i][j] = [
                    (((color >>  0) & 0x1f) as u8) << 3,
                    (((color >>  5) & 0x1f) as u8) << 3,
                    (((color >> 10) & 0x1f) as u8) << 3,
                    255,
                ];
            }
        }
    }
}
