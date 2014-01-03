#[crate_id = "jba-rs"];
#[feature(macro_rules)];

extern mod extra;
extern mod native;

use std::os;
use std::io::File;
use opts = extra::getopts::groups;

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

#[cfg(glfw)] #[path = "gl.rs"] mod app;

#[start]
#[cfg(not(test))]
fn start(argc: int, argv: **u8) -> int {
    do native::start(argc, argv) {
        main();
    }
}

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
    ];
    let matches = match opts::getopts(args.tail(), opts) {
        Ok(m) => { m }
        Err(f) => { fail!(f.to_err_msg()) }
    };
    if matches.opt_present("h") || matches.opt_present("help") ||
       matches.free.len() == 0 {
        return usage(args[0], opts);
    }

    let rom = File::open(&Path::new(matches.free[0].as_slice())).read_to_end();

    let mut gb = gb::Gb::new(match matches.opt_str("gb") {
        Some(~"gb") => gb::GameBoy,
        Some(~"cgb") => gb::GameBoyColor,
        Some(~"sgb") => gb::SuperGameBoy,
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

    app::run(gb);
}
