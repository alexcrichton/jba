#![feature(macro_rules, phase)]

#[phase(plugin, link)] extern crate log;
extern crate time;
extern crate getopts;

use std::os;
use std::io::File;
use getopts as opts;

macro_rules! dfail( ($($e:tt)*) => ({
    if cfg!(not(ndebug)) {
        fail!($($e)*);
    }
}) )

mod cpu;
mod gb;
mod gpu;
mod input;
mod mem;
mod rtc;
mod sgb;
mod timer;
#[cfg(test)] mod tests;

#[path = "gl.rs"] mod app;

fn usage(prog: &str, opts: &[opts::OptGroup]) {
    let h = opts::usage(format!("usage: {} [options] <rom>", prog).as_slice(), opts);
    println!("{}", h);
}

fn main() {
    let args = os::args();
    let opts = [
        opts::optflag("h", "help", "show this message"),
        opts::optflag("", "fps", "don't run a display, just print FPS"),
        opts::optopt("g", "gb", "type of gameboy to run", "[gb|cgb|sgb]"),
    ];
    let matches = match opts::getopts(args.tail(), opts) {
        Ok(m) => m,
        Err(f) => fail!("{}", f),
    };
    if matches.opt_present("h") || matches.opt_present("help") ||
       matches.free.len() == 0 {
        return usage(args[0].as_slice(), opts);
    }

    let rom = File::open(&Path::new(matches.free[0].as_slice())).read_to_end();
    let rom = match rom {
        Ok(rom) => rom,
        Err(e) => {
            println!("failed to read {}: {}", matches.free[0].as_slice(), e);
            return
        }
    };

    let mut gb = gb::Gb::new(match matches.opt_str("gb").as_ref().map(|s| s.as_slice()) {
        Some("gb") => gb::GameBoy,
        Some("cgb") => gb::GameBoyColor,
        Some("sgb") => gb::SuperGameBoy,
        Some(s) => {
            println!("Invalid gameboy type: {}", s);
            println!("Supported types: gb, cgb, sgb");
            return usage(args[0].as_slice(), opts);
        }
        None => {
            match mem::Memory::guess_target(rom.as_slice()) {
                Some(target) => target,
                None => gb::GameBoyColor,
            }
        }
    });
    gb.load(rom);

    // TODO: needs native timers
    if matches.opt_present("fps") {
        let mut last = time::precise_time_ns();
        loop {
            gb.frame();
            let cur = time::precise_time_ns();
            if cur - last >= 1000000000 {
                println!("{}", gb.frames());
                last = cur;
            }
        }
    }

    app::run(gb);
}
