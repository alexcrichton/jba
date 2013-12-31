#[crate_id = "jba-rs"];
#[allow(dead_code)];

#[feature(macro_rules)];

extern mod native;
//extern mod glfw = "lib";

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
}
