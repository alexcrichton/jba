#[crate_id = "jba-rs"];
#[feature(macro_rules)];

extern mod extra;
extern mod native;
//extern mod glfw = "lib";

use std::os;
use std::io::File;

macro_rules! dfail( ($($e:tt)*) => ({
    if cfg!(not(ndebug)) {
        fail!($($e)*);
    }
}) )

mod gb;
mod cpu;
mod gpu;
mod timer;
mod input;
mod rtc;
mod mem;

#[start]
#[cfg(not(test))]
fn start(argc: int, argv: **u8) -> int {
    do native::start(argc, argv) {
        main();
    }
}

fn main() {
    let args = os::args();
    if args.len() != 2 {
        println!("usage: {} <rom>", args[0]);
        return
    }
    let rom = File::open(&Path::new(args[1])).read_to_end();

    let mut gb = gb::Gb::new();
    gb.load(rom);

    let mut last = extra::time::precise_time_ns();
    loop {
        gb.frame();
        let cur = extra::time::precise_time_ns();
        if cur - last >= 1000000000 {
            println!("{}", gb.frames());
            last = cur;
        }
    }
}
