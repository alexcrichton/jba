use glfw;
use gl;
use std::libc;

use input;
use gpu;
use gb::Gb;

enum Direction {
    Down(input::Button),
    Up(input::Button),
}

pub fn run(gb: Gb) {
    do glfw::start {
        let mut gb = gb;
        let (keys, keyc) = Chan::new();
        let (focus, focusc) = Chan::new();

        gl::load_with(glfw::get_proc_address);
        let window = glfw::Window::create(gpu::WIDTH as u32,
                                          gpu::HEIGHT as u32,
                                          "JBA",
                                          glfw::Windowed);
        let window = window.expect("Failed to create GLFW window.");
        window.make_context_current();
        window.set_key_callback(~Keypress(keyc));
        window.set_focus_callback(~Focus(focusc));

        let mut focused = true;
        while !window.should_close() {
            if focused {
                gb.frame();
                upload_frame(&gb);
                window.swap_buffers();
                glfw::poll_events();
            } else {
                glfw::wait_events();
            }

            loop {
                match keys.try_recv() {
                    Some(Down(key)) => gb.keydown(key),
                    Some(Up(key)) => gb.keyup(key),
                    None => break
                }
            }
            loop {
                match focus.try_recv() {
                    Some(b) => { focused = b; }
                    None => break
                }
            }
        }
    }
}

struct Keypress(Chan<Direction>);
impl glfw::KeyCallback for Keypress {
    fn call(&self, _window: &glfw::Window, key: glfw::Key,
            _scancode: libc::c_int,
            action: glfw::Action, _modifiers: glfw::Modifiers) {
        let f = match action {
            glfw::Release => Up,
            glfw::Press => Down,
            glfw::Repeat => return,
        };

        let button = match key {
            glfw::KeyZ => input::A,
            glfw::KeyX => input::B,
            glfw::KeyEnter => input::Select,
            glfw::KeyComma => input::Start,

            glfw::KeyLeft => input::Left,
            glfw::KeyRight => input::Right,
            glfw::KeyDown => input::Down,
            glfw::KeyUp => input::Up,

            _ => return
        };

        let Keypress(ref chan) = *self;
        chan.send(f(button));
    }
}

struct Focus(Chan<bool>);
impl glfw::WindowFocusCallback for Focus {
    fn call(&self, _window: &glfw::Window, focused: bool) {
        let Focus(ref chan) = *self;
        chan.send(focused);
    }
}

fn upload_frame(gb: &Gb) {
    unsafe {
        gl::BindTexture(gl::TEXTURE_2D, 13);
        gl::TexImage2D(gl::TEXTURE_2D, 0, gl::RGB as i32,
                       gpu::WIDTH as i32, gpu::HEIGHT as i32, 0,
                       gl::RGBA8, gl::UNSIGNED_BYTE,
                       gb.image().as_ptr() as *libc::c_void);
        gl::Begin(gl::TRIANGLES);
        gl::TexCoord2f(0.0, 0.0);
        gl::Vertex3f(0.0, 0.0, 0.0);
        gl::TexCoord2f(1.0, 0.0);
        gl::Vertex3f(1.0, 0.0, 0.0);
        gl::TexCoord2f(1.0, 1.0);
        gl::Vertex3f(1.0, 1.0, 0.0);
        gl::TexCoord2f(0.0, 1.0);
        gl::Vertex3f(0.0, 1.0, 0.0);
        gl::End();
    }
}
