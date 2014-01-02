use glfw;
use gl;
use std::libc;
use std::cast;
use std::mem;
use std::ptr;
use std::vec;
use std::str;
use gl::types::{GLuint, GLint, GLboolean, GLenum, GLchar};

use input;
use gpu;
use gb::Gb;

enum Direction {
    Down(input::Button),
    Up(input::Button),
}

// Vertex data
static VERTEX_DATA: [gl::types::GLfloat, ..12] = [
     1.0, 1.0,
     1.0, -1.0,
    -1.0, -1.0,

     -1.0, 1.0,
     -1.0, -1.0,
    1.0, 1.0,
];

// Shader sources
static VS_SRC: &'static str =
   "#version 150\n\
in vec2 position;\n\
void main() {\n\
gl_Position = vec4(position, 0.0, 1.0);\n\
}";

static FS_SRC: &'static str =
   "#version 150\n\
out vec4 out_color;\n\
void main() {\n\
out_color = vec4(1.0, 1.0, 1.0, 1.0);\n\
}";

pub fn run(gb: Gb) {
    do glfw::start {
        let mut gb = gb;
        let (keys, keyc) = Chan::new();
        let (focus, focusc) = Chan::new();

        glfw::window_hint::context_version(3, 2);
        glfw::window_hint::opengl_profile(glfw::OpenGlCoreProfile);
        glfw::window_hint::opengl_forward_compat(true);

        let window = glfw::Window::create(gpu::WIDTH as u32,
                                          gpu::HEIGHT as u32,
                                          "JBA",
                                          glfw::Windowed);
        let window = window.expect("Failed to create GLFW window.");
        window.make_context_current();
        window.set_key_callback(~Keypress(keyc));
        window.set_focus_callback(~Focus(focusc));

        gl::load_with(glfw::get_proc_address);

        // Create GLSL shaders
        let vs = compile_shader(VS_SRC, gl::VERTEX_SHADER);
        let fs = compile_shader(FS_SRC, gl::FRAGMENT_SHADER);
        let program = link_program(vs, fs);

        let mut vao = 0;
        let mut vbo = 0;
        let mut tex = 0;

        unsafe {
            // Create Vertex Array Object
            gl::GenVertexArrays(1, &mut vao);
            gl::BindVertexArray(vao);

            // Create a Vertex Buffer Object and copy the vertex data to it
            gl::GenBuffers(1, &mut vbo);
            gl::BindBuffer(gl::ARRAY_BUFFER, vbo);
            gl::BufferData(gl::ARRAY_BUFFER,
                           (VERTEX_DATA.len() * mem::size_of::<gl::types::GLfloat>()) as gl::types::GLsizeiptr,
                           cast::transmute(&VERTEX_DATA[0]),
                           gl::STATIC_DRAW);

            gl::GenTextures(1, &mut tex);
            gl::BindTexture(gl::TEXTURE_2D, tex);
            gl::TexImage2D(gl::TEXTURE_2D, 0, gl::RGB as i32,
                           gpu::WIDTH as i32, gpu::HEIGHT as i32, 0,
                           gl::RGBA8, gl::UNSIGNED_BYTE,
                           gb.image().as_ptr() as *libc::c_void);

            // Use shader program
            gl::UseProgram(program);
            "out_color".with_c_str(|ptr| gl::BindFragDataLocation(program, 0, ptr));

            //// Specify the layout of the vertex data
            let pos_attr = "position".with_c_str(|ptr| gl::GetAttribLocation(program, ptr));
            gl::EnableVertexAttribArray(pos_attr as GLuint);
            gl::VertexAttribPointer(pos_attr as GLuint, 2, gl::FLOAT,
                                    gl::FALSE as GLboolean, 0, ptr::null());
        }

        let mut focused = true;
        while !window.should_close() {
            if focused {
                gb.frame();
                //upload_frame(&gb);

                // Clear the screen to black
                gl::ClearColor(0.3, 0.3, 0.3, 1.0);
                gl::Clear(gl::COLOR_BUFFER_BIT);

                // Draw a triangle from the 3 vertices
                gl::DrawArrays(gl::TRIANGLES, 0, 6);

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
        let mut tex: gl::types::GLuint = 0;
        gl::GenTextures(1, &mut tex);
        gl::BindTexture(gl::TEXTURE_2D, tex);
        gl::TexImage2D(gl::TEXTURE_2D, 0, gl::RGB as i32,
                       gpu::WIDTH as i32, gpu::HEIGHT as i32, 0,
                       gl::RGBA8, gl::UNSIGNED_BYTE,
                       gb.image().as_ptr() as *libc::c_void);
        gl::GenerateMipmap(gl::TEXTURE_2D);

        let mut foo: gl::types::GLuint = 0;
        let vertices = [
            0.0f32, 0.0, 0.0,
            1.0, 0.0, 0.0,
            1.0, 1.0, 0.0,
            0.0, 0.5, 0.0,
            0.0, 0.0, 0.0,
        ];
        gl::GenBuffers(1, &mut foo);
        gl::BindBuffer(gl::ARRAY_BUFFER, foo);
        gl::BufferData(gl::ARRAY_BUFFER,
                       (vertices.len() * mem::size_of::<f32>()) as i64,
                       vertices.as_ptr() as *libc::c_void,
                       gl::STATIC_DRAW);

        gl::DrawElements(gl::TRIANGLES, 3, gl::UNSIGNED_INT, 0 as *libc::c_void);

        //gl::Begin(gl::TRIANGLES);
        //gl::TexCoord2f(0.0, 0.0);
        //gl::Vertex3f(0.0, 0.0, 0.0);
        //gl::TexCoord2f(1.0, 0.0);
        //gl::Vertex3f(1.0, 0.0, 0.0);
        //gl::TexCoord2f(1.0, 1.0);
        //gl::Vertex3f(1.0, 1.0, 0.0);
        //gl::TexCoord2f(0.0, 1.0);
        //gl::Vertex3f(0.0, 1.0, 0.0);
        //gl::End();
    }
}

fn compile_shader(src: &str, ty: GLenum) -> GLuint {
    let shader = gl::CreateShader(ty);
    unsafe {
        // Attempt to compile the shader
        src.with_c_str(|ptr| gl::ShaderSource(shader, 1, &ptr, ptr::null()));
        gl::CompileShader(shader);

        // Get the compile status
        let mut status = gl::FALSE as GLint;
        gl::GetShaderiv(shader, gl::COMPILE_STATUS, &mut status);

        // Fail on error
        if status != (gl::TRUE as GLint) {
            let mut len = 0;
            gl::GetShaderiv(shader, gl::INFO_LOG_LENGTH, &mut len);
            let mut buf = vec::from_elem(len as uint - 1, 0u8); // subtract 1 to skip the trailing null character
            gl::GetShaderInfoLog(shader, len, ptr::mut_null(), buf.as_ptr() as *mut GLchar);
            fail!();
        }
    }
    shader
}

fn link_program(vs: GLuint, fs: GLuint) -> GLuint {
    let program = gl::CreateProgram();
    gl::AttachShader(program, vs);
    gl::AttachShader(program, fs);
    gl::LinkProgram(program);
    unsafe {
        // Get the link status
        let mut status = gl::FALSE as GLint;
        gl::GetProgramiv(program, gl::LINK_STATUS, &mut status);

        // Fail on error
        if status != (gl::TRUE as GLint) {
            let mut len: GLint = 0;
            gl::GetProgramiv(program, gl::INFO_LOG_LENGTH, &mut len);
            let mut buf = vec::from_elem(len as uint - 1, 0u8); // subtract 1 to skip the trailing null character
            gl::GetProgramInfoLog(program, len, ptr::mut_null(), buf.as_ptr() as *mut GLchar);
            fail!();
        }
    }
    program
}
