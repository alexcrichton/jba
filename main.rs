#[no_std];
#[crate_id = "jba-rs"];

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
