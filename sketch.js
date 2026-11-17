// H7: ask the phone to treat this page like a music player, so silent mode may not mute it.
// Not tested on a phone yet. If it changes nothing, delete this line.
if ('audioSession' in navigator) navigator.audioSession.type = 'playback';

// the browser's own sound system. smplr plays through it.
let audio = new AudioContext();

// ---------- MUSIC SEQUENCER ----------

// C major scale
let songNotes = [
  'C5', 'E5', 'G5', 'E5',
  'A5', 'G5', 'E5', 'D5',

  'C5', 'E5', 'G5', 'A5',
  'C6', 'A5', 'G5', 'E5',

  'D5', 'G5', 'A5', 'G5',
  'E5', 'D5', 'C5', 'D5',

  'E5', 'G5', 'A5', 'C6',
  'A5', 'G5', 'E5', 'C5'
];

// 1 = quarter note
// 0.5 = eighth note
// 2 = half note
let songRhythm = [
  0.5, 0.5, 1, 1,
  0.5, 0.5, 1, 1,

  0.5, 0.5, 1, 1,
  1, 0.5, 0.5, 1,

  0.5, 0.5, 1, 1,
  0.5, 0.5, 1, 1,

  0.5, 0.5, 1, 1,
  1, 0.5, 0.5, 1
];

let tempo = 120; // bpm
let currentNote = 0;
let nextNoteTime = 0;

// phones only start sound inside a tap. p5-phone's tap message starts this sound system
// right there (it starts any AudioContext the sketch makes), then calls userSetupComplete().
let unlocked = false; // has the tap turned the sound on?
function userSetupComplete() {
  unlocked = true;

  if (instrumentReady) {
    startSong();
  }
}

// the feel of the piece. change these before you change anything else.
// the scale: C major pentatonic, two octaves. five notes to an octave, none of them clash.
// (it cannot be called scale. p5.js already has a function with that name.)
let scaleNotes = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6'];
let instrumentName = 'synth_bass_1';  // try 'vibraphone', 'kalimba', 'celesta' or 'acoustic_grand_piano'
let velocity = 100;                   // how hard each note is struck, from 0 to 127

let instrument;              // from smplr
let instrumentReady = false; // true once its recordings have arrived
let loadProblem = '';
let position = 0.5;          // from 0 to 1. where the dial points
let noteIndex = -1;          // which note of the scale the dial is on. -1 is none yet
let soundPlayed = false;     // has any sound played yet?

async function setup() {
  createCanvas(windowWidth, windowHeight);
  lockGestures();

  // on a laptop, show a QR code of this page so you can open it on your phone.
  // it only shows on a public https address, like the examples site.
  // in the web editor or on 127.0.0.1 the address would not open on a phone.
  if (location.protocol === 'https:' && window.self === window.top) {
    showDesktopQr();
  }

  angleMode(DEGREES);
  setupInput();

  // smplr is a newer kind of library, a module, so it is loaded here and not in index.html
  let smplr = await import('https://cdn.jsdelivr.net/npm/smplr@1.0.0/dist/index.mjs');
  instrument = smplr.Soundfont(audio, { instrument: instrumentName });

  // there is no await here, so draw() starts straight away and says 'Loading instrument…'
  instrument.ready.then(function () {
    instrumentReady = true;

    if (unlocked) 
      {
        startSong();
      }
  }).catch(function (error) {
    loadProblem = 'The instrument did not load. Check the network.';
    console.log(error);
  });
}

function draw() {
  background(20);

  // 1. read the input: where the dial points, from 0 to 1. -1 means no new reading
  let raw = readPosition();
  if (raw >= 0) {
    position = raw;
  }

  // map rotation to tempo
  // 0 = 80 BPM
  // 1 = 180 BPM
  tempo = map(position, 0, 1, 80, 180);

  // play the next sequence in the song
  updateSong();

  drawDial();
  drawInput();

  // the labels sit in the top 70 pixels, the same in every version
  fill(255);
  noStroke();
  textSize(16);

  text(inputReading(), 20, 30);
  text(inputStatus(), 20, 52);

  text('Tempo: ' + round(tempo) + ' BPM', 20, 80);
  text('Note: ' + songNotes[currentNote], 20, 102);
  
  drawNotes();
}

// strike one note of the scale
function playNote(n) {
  if (!instrumentReady) return;

  instrument.start({ note: scaleNotes[n], velocity: velocity });
  soundPlayed = true;
}

// the dial. the scale runs around it, low on the left, high on the right.
function drawDial() {
  let cx = width / 2;
  let cy = 70 + (height - 70 - 90) / 2;
  let r = min(width, height - 160) * 0.38;

  // each note of the scale has a mark. the one playing is lit.
  textAlign(CENTER, CENTER);
  textSize(12);
  for (let i = 0; i < scaleNotes.length; i++) {
    let a = map(i + 0.5, 0, scaleNotes.length, -135, 135);
    let x = cx + r * sin(a);
    let y = cy - r * cos(a);
    noStroke();
    if (i === noteIndex) {
      fill(255, 200, 0);
      circle(x, y, 30);
      fill(20);
    } else {
      fill(60);
      circle(x, y, 30);
      fill(200);
    }
    text(scaleNotes[i], x, y);
  }

  // the pointer
  let pointer = map(position, 0, 1, -135, 135);
  stroke(255);
  strokeWeight(4);
  line(cx, cy, cx + r * 0.75 * sin(pointer), cy - r * 0.75 * cos(pointer));
  noStroke();
  fill(255);
  circle(cx, cy, 14);

  textSize(40);
  if (loadProblem !== '') {
    textSize(16);
    text(loadProblem, cx, cy + r * 0.45);
  } else if (!instrumentReady) {
    textSize(20);
    text('Loading instrument…', cx, cy + r * 0.45);
  } else if (noteIndex >= 0) {
    text(scaleNotes[noteIndex], cx, cy + r * 0.45);
  }
  textAlign(LEFT, BASELINE);
}

// the notes along the bottom. the input part adds its own lines.
function drawNotes() {
  let lines = findings.slice(); // a copy, so the list below can grow

  // H6, H8: until the first sound plays, say what usually silences a phone
  if (!soundPlayed) {
    lines.push('No sound? Check silent mode.');
  }

  fill(160);
  noStroke();
  textSize(13);
  let y = height - 12;
  for (let i = lines.length - 1; i >= 0; i--) {
    text(lines[i], 20, y);
    y = y - 18;
  }
}

// start the song
function startSong() {
  currentNote = 0;
  nextNoteTime = millis();
}

// update and play the song
function updateSong() {
  if (!unlocked || !instrumentReady) return;

  let currentTime = millis();

  if (currentTime >= nextNoteTime) {

    // play the current note
    instrument.start({
      note: songNotes[currentNote],
      velocity: velocity
    });

    // timer for the next note
    let beatDuration = 60000 / tempo;
    nextNoteTime = currentTime + (beatDuration * songRhythm[currentNote]);

    currentNote++;

    if (currentNote >= songNotes.length) { currentNote = 0; }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ---------- the input: motion. this is the only part that changes between versions. ----------
// From the p5-phone Orientation Basic example.
// rotationX is how far the phone has flipped when held in portrait mode, from -180 to 180 degrees. For the upper half of the arc, which is all that matters for this project, it runs from 0 to 180.
// Pulling it toward you (screen facing you) increases the rotation.

let findings = ['A full turn runs through the scale. Past 360 it jumps back to the bottom.'];

// a laptop has no motion sensors. this turns true when the first real reading arrives.
let motionArrived = false;
window.addEventListener('devicemotion', function (event) {
  let g = event.accelerationIncludingGravity;
  if (g && g.x !== null) {
    motionArrived = true;
  }
});

function setupInput() {
  // angleMode(DEGREES) is already on, in setup()
  enablePermissionsTap(['motion', 'sound'], 'Tap to turn on motion and sound');
}

// where the phone points the dial, from 0 to 1. -1 if there are no motion readings
function readPosition() {
  if (!window.sensorsEnabled || !motionArrived) return -1;

  // convert the phone's rotation into a value usable by the program
  return constrain((180 - rotationX) / 180, -1, 1);
}

function inputReading() {
  return 'turn: ' + round(rotationX) + '°';
}

function inputStatus() {
  if (!window.sensorsEnabled) {
    return 'tap to turn on motion and sound';
  }
  if (!motionArrived) {
    return 'no motion sensors here. on a laptop, open this on a phone';
  }
  return 'lay the phone flat and turn it like a dial';
}

// the turn needs nothing extra on screen. the dial's pointer is the turn.
function drawInput() {
}
