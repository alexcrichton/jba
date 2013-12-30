#[no_std];
#[crate_id = "jba-rs"];
#[allow(dead_code)];

#[feature(macro_rules)];

extern mod native;
//extern mod glfw = "lib";

mod gb;
mod cpu;
mod gpu;
mod timer;
mod mem;

#[start]
fn start(argc: int, argv: **u8) -> int {
    do native::start(argc, argv) {
        main();
    }
}

fn main() {
}
