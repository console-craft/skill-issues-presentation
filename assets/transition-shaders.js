// Signal/plunge adapted from HyperFrames 0.9.23 glitch and cinematic-zoom;
// Whip uses the whip-pan concept; CRT is custom.
// The glitch's brightness flicker is omitted; intensity comes from distortion, not strobes.
const header = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_from, u_to;
uniform float u_progress;
uniform vec2 u_resolution;
`;

export const fragments = {
  signal: header + `
float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float p = u_progress;
  float intensity = p * (1.0 - p) * 4.0;
  float row = floor(v_uv.y * 60.0) / 60.0;
  float tear = (rand(vec2(row, floor(p * 17.0))) - 0.5) * 0.18 * intensity;
  vec2 block = floor(v_uv * vec2(12.0, 8.0));
  float scramble = step(0.83, rand(block + vec2(floor(p * 11.0)))) * intensity;
  vec2 displacement = (vec2(rand(block * 2.1), rand(block * 3.7)) - 0.5) * 0.35 * scramble;
  vec2 uv = clamp(v_uv + vec2(tear, 0.0) + displacement, 0.0, 1.0);
  float split = intensity * 0.035;
  vec3 color = vec3(texture2D(u_from, uv + vec2(split, 0.0)).r,
                    texture2D(u_from, uv).g,
                    texture2D(u_from, uv - vec2(split, 0.0)).b);
  color -= step(0.5, fract(v_uv.y * u_resolution.y * 0.5)) * 0.05 * intensity;
  float levels = mix(256.0, 8.0, intensity * 0.5);
  color = floor(color * levels) / levels;
  gl_FragColor = mix(vec4(color, 1.0), texture2D(u_to, v_uv), smoothstep(0.25, 0.9, p));
}`,
  plunge: header + `
void main() {
  float p = u_progress;
  vec2 d = v_uv - vec2(0.5);
  vec2 fromUV = vec2(0.5) + d / (1.0 + p * 0.9);
  vec2 toUV = vec2(0.5) + d / (1.0 + (1.0 - p) * 1.3);
  float fromSpread = p * 0.7;
  float toSpread = (1.0 - p) * 0.5;
  vec3 fromColor = vec3(0.0);
  vec3 toColor = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    float f = float(i) / 12.0;
    fromColor.r += texture2D(u_from, fromUV - d * fromSpread * 1.08 * f).r;
    fromColor.g += texture2D(u_from, fromUV - d * fromSpread * f).g;
    fromColor.b += texture2D(u_from, fromUV - d * fromSpread * 0.92 * f).b;
    toColor.r += texture2D(u_to, toUV + d * toSpread * 1.08 * f).r;
    toColor.g += texture2D(u_to, toUV + d * toSpread * f).g;
    toColor.b += texture2D(u_to, toUV + d * toSpread * 0.92 * f).b;
  }
  gl_FragColor = vec4(mix(fromColor, toColor, smoothstep(0.15, 0.85, p)) / 12.0, 1.0);
}`,
  crt: header + `
void main() {
  float p = u_progress;
  if (p >= 0.46 && p <= 0.54) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  float phase = p < 0.5 ? p : 1.0 - p;
  float squeeze = 1.0 - smoothstep(0.08, 0.42, phase);
  float height = mix(0.003, 1.0, squeeze * squeeze);
  float width = mix(0.65, 1.0, squeeze);
  vec2 d = v_uv - 0.5;
  vec2 uv = clamp(d / vec2(width, height) + 0.5, 0.0, 1.0);
  float mask = (1.0 - smoothstep(height * 0.5, height * 0.5 + 0.002, abs(d.y)))
             * (1.0 - smoothstep(width * 0.5, width * 0.5 + 0.002, abs(d.x)));
  float glow = smoothstep(0.12, 0.42, phase) * (1.0 - smoothstep(0.42, 0.46, phase));
  float line = exp(-abs(d.y) * 220.0) * (1.0 - smoothstep(width * 0.5, width * 0.5 + 0.006, abs(d.x)));
  vec3 scene = p < 0.5 ? texture2D(u_from, uv).rgb : texture2D(u_to, uv).rgb;
  gl_FragColor = vec4(scene * mask + vec3(0.08, 0.75, 1.0) * line * glow * 0.85, 1.0);
}`,
  whip: header + `
vec3 strip(vec2 uv) {
  if (uv.x < 1.0) return texture2D(u_from, clamp(uv, 0.0, 1.0)).rgb;
  return texture2D(u_to, clamp(uv - vec2(1.0, 0.0), 0.0, 1.0)).rgb;
}
void main() {
  float p = u_progress;
  if (p <= 0.0) { gl_FragColor = texture2D(u_from, v_uv); return; }
  if (p >= 1.0) { gl_FragColor = texture2D(u_to, v_uv); return; }
  float shift = smoothstep(0.05, 0.95, p);
  float speed = sin(p * 3.14159265);
  float blur = 0.42 * speed * speed;
  float split = speed * 0.008;
  vec3 color = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    float offset = shift + (float(i) / 11.0 - 0.5) * blur;
    color.r += strip(v_uv + vec2(offset + split, 0.0)).r;
    color.g += strip(v_uv + vec2(offset, 0.0)).g;
    color.b += strip(v_uv + vec2(offset - split, 0.0)).b;
  }
  gl_FragColor = vec4(color / 12.0, 1.0);
}`,
};
