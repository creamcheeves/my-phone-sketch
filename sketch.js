// H7: ask the phone to treat this page like a music player, so silent mode may not mute it.
// Not tested on a phone yet. If it changes nothing, delete this line.
if ('audioSession' in navigator) navigator.audioSession.type = 'playback';

// the browser's sound system. smplr plays through it.
let audio = new AudioContext();

// -- MUSIC SEQUENCER --

// c minor pentatonic scale
let scaleNotes = ['C3', 'Eb3', 'F3', 'G3', 'Bb3', 'C4', 'Eb4', 'F4', 'G4', 'Bb4', 'C5'];

let songNotes = [
  'C4', 'Eb4', 'G4', 'Eb4',
  'C4', 'G3', 'Bb3', 'G3',

  'C4', 'Eb4', 'F4', 'G4',
  'Bb4', 'G4', 'F4', 'Eb4',

  'C4', 'Eb4', 'G4', 'C5',
  'Bb4', 'G4', 'Eb4', 'C4',

  'G3', 'Bb3', 'C4', 'Eb4',
  'F4', 'Eb4', 'C4', 'G3'
];

// rhythm is the delay following the note that plays from the above array
let songRhythm = [
  0.5, 0.5, 0.5, 3,
  2, 0.5, 0.5, 2,

  1, 1, 1, 1,
  1, 0.5, 0.5, 1,

  0.5, 0.5, 0.5, 3,
  2, 0.5, 0.5, 2,

  1, 1, 1, 2,
  1, 0.5, 0.5, 1
];

let tempo = 120; // bpm
let tempoMin = 50;
let tempoMax = 240;
let ambienceVelocity = 25;
let ambienceMin = 0;
let ambienceMax = 60;
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

let velocity = 50;                   // how hard each note is struck, from 0 to 127

let mainSynthInstrument;      // from smplr; following instrument-controlled variables operate off of this one
let ambienceInstrument;
let instrumentReady = false;  // true once its recordings have arrived
let loadProblem = '';
let position = 0.5;           // from 0 to 1, current scale of bpm
let ambiencePosition = 0.5;   // from 0 to 1, current scale of ambience volume
let soundPlayed = false;      // has any sound played yet?

// -- PARTICLES --

let particles = [];

// limit color palette for retro-eqsue vibe additions
let particleColors = [
  '#ff3864',
  '#ffbd35',
  '#38e8cf',
  '#648cff',
  '#c56bff',
  '#ffffff'
];

let titleColor = '#ffffff';

const SHARE_HOST = 'https://p5-phone-share.npuckett.workers.dev';   // the class server

async function setup() {
  createCanvas(windowWidth, windowHeight);
  lockGestures();

  // on a laptop, show a QR code of this page so you can open it on your phone.
  // it only shows on a public https address, like the examples site.
  // in the web editor or on 127.0.0.1 the address would not open on a phone.
  if (location.protocol === 'https:' && window.self === window.top) {
    // showDesktopQr();
  }

  angleMode(DEGREES);
  setupInput();

  // -- MUSIC SETUP --
  let smplr = await import('https://cdn.jsdelivr.net/npm/smplr@1.0.0/dist/index.mjs');

  // -- MAIN INSTRUMENT SETUP --
  mainSynthInstrument = smplr.Soundfont(audio, { instrument: 'lead_3_calliope' });

  // there is no await here, so draw() starts straight away and says 'Loading instrument…'
  mainSynthInstrument.ready.then(function () {
    instrumentReady = true;

    if (unlocked) 
      {
        startSong();
      }
  }).catch(function (error) {
    loadProblem = 'The instrument did not load. Check the network.';
    console.log(error);
  });

  // -- OTHER INSTRUMENT SETUP --
  // -- instrument options at https://cdn.jsdelivr.net/npm/smplr@1.0.0/dist/index.mjs -- 
  ambienceInstrument = smplr.Soundfont(audio, { instrument: 'synth_strings_1' });

  
  // -- SERVER SETUP --
  shareSetup({
    host: SHARE_HOST,
    room: 'a1-anvil',
    app: 'phlever',
    me: { timeInSketch: 0, role: "listener", value: 0 }
  });
}

//  -------------------------
//  --    DRAW FUNCTION    --
//  -------------------------

function draw() {
  background(20);
  const everyone = [me].concat(guests);

  // read the input: where the dial points, from 0 to 1. -1 means no new reading
  let raw = readPosition();
  if (raw >= 0) {
    me.value = raw;
  }

  // determine if you are the conductor
  let greaterThanMe = 0;
  for (let i = 0; i < everyone.length; i++)
  {
    const person = everyone[i];

    if (person != me && person.timeInSketch > me.timeInSketch)
    {
      greaterThanMe++;
    }
  }
  
  // role assignment based on queue
  if (greaterThanMe == 0)
  {
    me.role = "conductor";
  }
  if (greaterThanMe == 1)
  {
    me.role = "ambience director";
  }
  if (me.timeInSketch == 0)
  {
    me.role = "listener";
  }

  // conductor's position is the one that matters for bpm
  let isConductor = false;
  for (let i = 0; i < everyone.length; i++)
  {
    const person = everyone[i];

    if (person.role == "conductor")
    {
      position = person.value;
      isConductor = true;
    }
  }
  if (!isConductor)
  {
    position = 0.5;
  }

  // ambient director's position is the one that matters for ambience volume
  let isAmbienceDirector = false;
  for (let i = 0; i < everyone.length; i++)
  {
    const person = everyone[i];

    if (person.role == "ambience director")
    {
      ambiencePosition = person.value;
      isAmbienceDirector = true;
    }
  }
  if (!isAmbienceDirector)
  {
    ambiencePosition = 0.5;
  }

  // map rotation to values
  // 0 = 80 BPM
  // 1 = 180 BPM
  tempo = map(position, 0, 1, tempoMin, tempoMax);
  // 0 = 0 velocity
  // 1 = 60 velocity
  ambienceVelocity = map(ambiencePosition, 0, 1, ambienceMin, ambienceMax);

  // play the next sequence in the song
  updateSong();
  updateParticles();

  // outside border
  noFill();
  stroke(255);
  strokeWeight(4);
  rect(2, 2, width - 4, height - 4);

  // title
  strokeWeight(height * 0.01);
  textSize(height * 0.08);
  textAlign(CENTER, CENTER);
  fill(titleColor);
  text('↨ PHLEVER ↨', width / 2, height * 0.1);

  showDesktopQr();

  // text for instructions
  fill(255);
  textAlign(CENTER, TOP);
  noStroke();

  let tSize = 0;
  if (width > height)
  {
    tSize = height * 0.04;
  } else {
    tSize = width * 0.03;
  }

  textSize(tSize);

  text(inputStatus(), width / 2, height * 0.18);
  text(roleDescription(), width / 2, height * 0.3);

  // update your time in sketch value
  me.timeInSketch = millis();
  if (!motionArrived) {
    // only allow people who have readings to become a conductor
    me.timeInSketch = 0;
  }

  let doDebugging = false;
  if (!doDebugging) return;

  // -- DEBUGGING INFORMATION, NOT SHOWN ON FINAL VERSION --
  text("debugging!", 20, 58);
  text(inputReading(), 20, 80);
  text('Tempo: ' + round(tempo) + ' BPM', 20, 102);
  text("Ambience volume: " + round(ambienceVelocity), 20, 124);
  
  let textY = 146;

  // write all of the people in the room
  for (let i = 0; i < everyone.length; i++)
  {
    const person = everyone[i];

    if (person === me)
    {
      text("me: " + (shareClientId || '').slice(0, 4) + "'s role: " + person.role, 20, textY);
    }
    else
    {
      text("other: " + person.id.slice(0, 4) + "'s role: " + person.role, 20, textY);
    }

    textY += 22;
  }
}

// play one note
function playNote(n) {
  if (!instrumentReady) return;

  mainSynthInstrument.start({ note: scaleNotes[n], velocity: velocity });
  soundPlayed = true;
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
    let beatDuration = 60000 / tempo;
    let noteDuration = (beatDuration * songRhythm[currentNote]) / 1000;

    // play the current note
    mainSynthInstrument.start({
      note: songNotes[currentNote],
      velocity: velocity,
      duration: noteDuration * 0.85
    });

    ambienceInstrument.start({
      note: songNotes[currentNote],
      velocity: ambienceVelocity,
      duration: noteDuration * 2
    });

    createBeatParticles();
    titleColor = random(particleColors);

    // timer for the next note
    nextNoteTime = currentTime + (beatDuration * songRhythm[currentNote]);

    currentNote++;

    if (currentNote >= songNotes.length) { currentNote = 0; }
  }
}

function createBeatParticles() {
  // A few squares per beat
  let amount = random(2, 5);

  for (let i = 0; i < amount; i++) {
    particles.push({
      x: random(width),
      y: height + random(0, 20),

      size: random(width * 0.02, width * 0.15),

      // Mostly upward, with some sideways movement
      vx: random(-1.5, 1.5) * (position * 2),
      vy: random(-4, -7) * (position * 2),

      gravity: 0.06,

      rotation: random(360),
      rotationSpeed: random(-4, 4),

      alpha: 255,

      color: random(particleColors)
    });
  }
}

function updateParticles() {
  rectMode(CENTER);
  noStroke();

  for (let i = particles.length - 1; i >= 0; i--) 
  {
    let p = particles[i];

    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravity;
    p.rotation += p.rotationSpeed;
    p.alpha -= 2.5;

    push();

    translate(p.x, p.y);
    rotate(p.rotation);

    // main square
    let c = color(p.color);
    c.setAlpha(max(0, p.alpha));

    fill(c);
    noStroke();
    rect(0, 0, p.size, p.size);

    // outline that stays fully visible
    noFill();
    stroke(255, 255, 255, 255);
    strokeWeight(2);
    rect(0, 0, p.size, p.size);

    pop();

    // remove faded particles
    if (p.alpha <= 0 || p.y > height + 30) 
    {
      particles.splice(i, 1);
    }
  }

  rectMode(CORNER);
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
  enablePermissionsTap(['motion', 'sound', 'share'], 'Tap to turn on motion and sound');
}

function readPosition() {
  if (!window.sensorsEnabled || !motionArrived) return -1;

  // convert the phone's rotation into a value usable by the program
  return constrain((180 - rotationX) / 180, -1, 1);
}

function inputReading() {
  return 'Turn: ' + round(rotationX) + '°';
}

function inputStatus() {
  if (!window.sensorsEnabled) {
    return 'Tap to turn on motion and sound';
  }

  if (!motionArrived) {
    return 'No motion sensors detected. Phlever requires rotational input!';
  }

  return 'Set the bottom of your phone on a surface in portrait mode,\nthen push or pull it from the top as though it were a lever.';
}

function roleDescription() 
{
  if (me.role == "listener")
  {
    return "You are a listener.\nEnjoy the show, or wait for your turn as conductor!";
  }
  if (me.role == "conductor")
  {
    return "You are the conductor.\nYou control the tempo of the music with your Phlever.";
  }
  if (me.role == "ambience director")
  {
    return "You are the ambience director.\nYou control the volume of the ambient sound with your Phlever.";
  }
}