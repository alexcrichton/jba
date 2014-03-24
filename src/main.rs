#[crate_id = "jba-rs"];
#[feature(macro_rules, phase)];
#[allow(deprecated_owned_vector)];

#[phase(syntax, link)] extern crate log;
extern crate time;
extern crate getopts;
extern crate native;

use std::os;
use std::io::File;
use opts = getopts;

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
mod test;

#[cfg(glfw)] #[path = "gl.rs"] mod app;

#[start]
#[cfg(not(test))]
fn start(argc: int, argv: **u8) -> int { native::start(argc, argv, main) }

fn usage(prog: &str, opts: &[opts::OptGroup]) {
    let h = opts::usage(format!("usage: {} [options] <rom>", prog), opts);
    println!("{}", h);
}

fn main() {
    let args = os::args();
    let opts = ~[
        opts::optflag("h", "help", "show this message"),
        opts::optflag("", "fps", "don't run a display, just print FPS"),
        opts::optopt("g", "gb", "type of gameboy to run", "[gb|cgb|sgb]"),
        opts::optopt("", "test", "run a test rom", "TESTFILE"),
    ];
    let matches = match opts::getopts(args.tail(), opts) {
        Ok(m) => { m }
        Err(f) => { fail!(f.to_err_msg()) }
    };
    if matches.opt_present("h") || matches.opt_present("help") ||
       matches.free.len() == 0 {
        return usage(args[0], opts);
    }

    let rom = File::open(&Path::new(matches.free.get(0).as_slice())).read_to_end();
    let rom = match rom {
        Ok(rom) => rom,
        Err(e) => {
            println!("failed to read {}: {}", matches.free.get(0).as_slice(), e);
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
            return usage(args[0], opts);
        }
        None => {
            match mem::Memory::guess_target(rom) {
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

    match matches.opt_str("test") {
        Some(file) => return test::run(&mut gb, file),
        None => {}
    }

    app::run(gb);
}
